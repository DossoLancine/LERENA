import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { clearFailures, clientIp, isLocked, LOCKED_MESSAGE, recordFailure } from "./login-guard"
import { decryptSecret, hashRecoveryCode, verifyTotp } from "./totp"
import { STAFF_ROLES, type Role } from "./constants"

// Clé de signature des sessions : obligatoire, jamais écrite dans le code
const secret = process.env.NEXTAUTH_SECRET
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET manquant : définissez-le dans les variables d’environnement')
}

// Même message que le compte existe ou non : on ne révèle pas quels e-mails ou numéros sont inscrits
const INVALID = 'Identifiant ou mot de passe incorrect'
// Message attendu par les pages de connexion pour afficher le champ « code de vérification »
export const TWO_FACTOR_REQUIRED = '2FA_REQUIRED'

// Rôles pour lesquels la double authentification est obligatoire
export const TWO_FACTOR_ROLES: Role[] = ['SUPER_ADMIN', 'ORG_ADMIN']

// Contrôle des sessions : toutes les 5 minutes, et expiration après 12 h d'inactivité sur les postes du personnel
const CHECK_EVERY_MS = 5 * 60_000
const STAFF_IDLE_MS = 12 * 3600_000

/** Code de l'application d'authentification, ou code de secours (consommé). */
async function checkSecondFactor(user: { id: string; twoFactorSecret: string | null; twoFactorRecovery: string[] }, code: string) {
  if (user.twoFactorSecret && verifyTotp(decryptSecret(user.twoFactorSecret), code)) return true
  const hashed = hashRecoveryCode(code)
  if (user.twoFactorRecovery.includes(hashed)) {
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorRecovery: user.twoFactorRecovery.filter(h => h !== hashed) } })
    return true
  }
  return false
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Téléphone ou Email", type: "text" },
        password: { label: "Mot de passe", type: "password" },
        otp: { label: "Code de vérification", type: "text" }
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('Identifiants manquants')
        }

        const identifier = credentials.identifier.trim().toLowerCase()
        const headers = req?.headers as Record<string, unknown> | undefined
        const ip = clientIp(headers)
        if (await isLocked(identifier, ip)) throw new Error(LOCKED_MESSAGE)

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: identifier },
              { phone: credentials.identifier.trim() }
            ]
          }
        })

        const isValid = !!user?.password && await bcrypt.compare(credentials.password, user.password)
        if (!user || !isValid) {
          await recordFailure(identifier, ip)
          throw new Error(INVALID)
        }

        // Double authentification : mot de passe correct, il faut encore le code de l'application
        if (user.twoFactorEnabled) {
          const otp = credentials.otp?.trim()
          if (!otp) throw new Error(TWO_FACTOR_REQUIRED)
          if (!(await checkSecondFactor(user, otp))) {
            await recordFailure(identifier, ip)
            throw new Error('Code de vérification incorrect')
          }
        }
        await clearFailures(identifier)

        // Une session par appareil : listée et révocable dans « Sécurité du compte »
        const ua = typeof headers?.['user-agent'] === 'string' ? (headers['user-agent'] as string).slice(0, 200) : null
        const [session] = await Promise.all([
          prisma.authSession.create({ data: { userId: user.id, userAgent: ua, ip }, select: { id: true } }),
          prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        ])

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          sid: session.id,
          sv: user.sessionVersion,
          mcp: user.mustChangePassword,
          tfa: user.twoFactorEnabled
        } as any
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const t = token as any
      if (user) {
        const u = user as any
        Object.assign(t, { id: u.id, role: u.role, sid: u.sid, sv: u.sv, mcp: u.mcp, tfa: u.tfa, chk: Date.now(), act: Date.now() })
        return token
      }
      if (!t.id) return token

      // Contrôle régulier (ou à la demande après un changement) : session révoquée, mot de passe changé,
      // compte supprimé ou inactivité prolongée d'un poste du personnel → la session n'est plus valable
      const now = Date.now()
      if (trigger !== 'update' && now - (t.chk ?? 0) < CHECK_EVERY_MS) return token

      if (STAFF_ROLES.includes(t.role) && now - (t.act ?? now) > STAFF_IDLE_MS) return {} as any

      const [dbUser, session] = await Promise.all([
        prisma.user.findUnique({ where: { id: t.id }, select: { role: true, sessionVersion: true, mustChangePassword: true, twoFactorEnabled: true, name: true } }),
        t.sid ? prisma.authSession.findUnique({ where: { id: t.sid }, select: { revokedAt: true } }) : null
      ])
      if (!dbUser || dbUser.sessionVersion !== t.sv || (t.sid && (!session || session.revokedAt))) return {} as any

      Object.assign(t, { role: dbUser.role, mcp: dbUser.mustChangePassword, tfa: dbUser.twoFactorEnabled, name: dbUser.name, chk: now, act: now })
      if (t.sid) await prisma.authSession.update({ where: { id: t.sid }, data: { lastSeenAt: new Date() } }).catch(() => {})
      return token
    },
    async session({ session, token }) {
      const t = token as any
      if (!t.id) return { ...session, user: undefined } as any
      if (session.user) {
        const s = session.user as any
        Object.assign(s, { id: t.id, role: t.role, mustChangePassword: !!t.mcp, twoFactorEnabled: !!t.tfa })
      }
      ;(session as any).sid = t.sid ?? null
      return session
    }
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 3600
  },
  secret,
}
