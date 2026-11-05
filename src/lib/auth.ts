import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { clearFailures, clientIp, isLocked, LOCKED_MESSAGE, recordFailure } from "./login-guard"
import { decryptSecret, hashRecoveryCode, verifyTotp } from "./totp"
import { STAFF_ROLES, type Role } from "./constants"
import { normalizePhone } from "./phone"
import { verifyOtp } from "./otp"
import { hashSecret, isPlausibleSecret } from "./secrets"
import { openSession, passwordlessAllowed, ssoAllowed, type SignInMethod } from "./auth-methods"
import { TERMS_VERSION } from "@/app/legal/content"

// Clé de signature des sessions : obligatoire, jamais écrite dans le code
const secret = process.env.NEXTAUTH_SECRET
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET manquant : définissez-le dans les variables d’environnement')
}

// Même message que le compte existe ou non : on ne révèle pas quels e-mails ou numéros sont inscrits
const INVALID = 'Identifiant ou mot de passe incorrect'
// Message attendu par les pages de connexion pour afficher le champ « code de vérification »
export const TWO_FACTOR_REQUIRED = '2FA_REQUIRED'

// Rôles sensibles (double authentification recommandée, obligatoire en production) : voir two-factor-policy
export { TWO_FACTOR_ROLES } from '@/lib/two-factor-policy'

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

/** Utilisateur tel que transmis au jeton de session. */
function sessionUser(user: { id: string; name: string | null; email: string | null; image: string | null; role: string; sessionVersion: number; mustChangePassword: boolean; twoFactorEnabled: boolean }, sid: string) {
  return {
    id: user.id, name: user.name, email: user.email, image: user.image, role: user.role,
    sid, sv: user.sessionVersion, mcp: user.mustChangePassword, tfa: user.twoFactorEnabled
  } as any
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
        const sid = await openSession(user.id, 'PASSWORD', { userAgent: ua, ip })
        return sessionUser(user, sid)
      }
    }),

    // Code reçu par SMS ou WhatsApp (visiteurs) : connexion sans mot de passe, compte créé au premier code
    CredentialsProvider({
      id: 'phone-code',
      name: 'Code',
      credentials: { phone: { type: 'text' }, code: { type: 'text' }, acceptTerms: { type: 'text' }, name: { type: 'text' } },
      async authorize(credentials, req) {
        const phone = normalizePhone(credentials?.phone)
        const code = credentials?.code?.trim() ?? ''
        if (!phone || !/^\d{6}$/.test(code)) throw new Error('Code incorrect ou expiré')
        const headers = req?.headers as Record<string, unknown> | undefined
        const ip = clientIp(headers)
        if (await isLocked(phone, ip)) throw new Error(LOCKED_MESSAGE)
        let user = await prisma.user.findUnique({ where: { phone } })
        // Nouveau numéro : les conditions doivent être acceptées avant de consommer le code
        if (!user && credentials?.acceptTerms !== 'true') throw new Error('TERMS_REQUIRED')
        if (!(await verifyOtp(phone, 'LOGIN', code))) {
          await recordFailure(phone, ip)
          throw new Error('Code incorrect ou expiré')
        }
        if (user && !passwordlessAllowed(user.role)) throw new Error('Les comptes d’équipe se connectent avec leur mot de passe, sur l’espace Pro.')
        if (!user) {
          const name = credentials?.name?.trim().slice(0, 80) || null
          user = await prisma.user.create({ data: { phone, name, role: 'CLIENT', termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } })
        }
        await clearFailures(phone)
        const ua = typeof headers?.['user-agent'] === 'string' ? (headers['user-agent'] as string) : null
        return sessionUser(user, await openSession(user.id, 'PHONE_CODE', { userAgent: ua, ip }))
      }
    }),

    // Lien reçu par e-mail (visiteurs) : valable 15 minutes, une seule fois
    CredentialsProvider({
      id: 'email-link',
      name: 'Lien',
      credentials: { token: { type: 'text' } },
      async authorize(credentials, req) {
        const token = credentials?.token
        if (!isPlausibleSecret(token)) throw new Error('Lien invalide ou expiré')
        const entry = await prisma.loginToken.findUnique({ where: { tokenHash: hashSecret(token) } })
        if (!entry || entry.usedAt || entry.expiresAt < new Date()) throw new Error('Lien invalide ou expiré : demandez-en un nouveau.')
        const claimed = await prisma.loginToken.updateMany({ where: { id: entry.id, usedAt: null }, data: { usedAt: new Date() } })
        if (claimed.count !== 1) throw new Error('Ce lien a déjà servi : demandez-en un nouveau.')
        let user = await prisma.user.findUnique({ where: { email: entry.email } })
        if (user && !passwordlessAllowed(user.role)) throw new Error('Les comptes d’équipe se connectent avec leur mot de passe, sur l’espace Pro.')
        if (!user) {
          if (!entry.acceptTerms) throw new Error('Lien invalide ou expiré')
          user = await prisma.user.create({ data: { email: entry.email, role: 'CLIENT', termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } })
        }
        const headers = req?.headers as Record<string, unknown> | undefined
        const ua = typeof headers?.['user-agent'] === 'string' ? (headers['user-agent'] as string) : null
        return sessionUser(user, await openSession(user.id, 'EMAIL_LINK', { userAgent: ua, ip: clientIp(headers) }))
      }
    })
  ],
  callbacks: {
    /**
     * Google ou Microsoft : adresse vérifiée exigée. Google crée un compte visiteur au besoin ;
     * Microsoft (entreprises) n'ouvre que les comptes d'équipe déjà inscrits avec cette adresse.
     */
    async signIn({ account, profile, user }) {
      if (account?.type !== 'oauth') return true
      const p = (profile ?? {}) as { email?: string; email_verified?: boolean; name?: string; picture?: string }
      const email = (user?.email ?? p.email ?? '').toLowerCase()
      const back = account.provider === 'azure-ad' ? '/pro/login' : '/auth/login'
      if (!email || (account.provider === 'google' && p.email_verified === false)) return `${back}?error=SSO_NO_EMAIL`
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } })
      if (existing) return ssoAllowed(existing.role) ? true : `${back}?error=SSO_ROLE`
      if (account.provider !== 'google') return `${back}?error=SSO_UNKNOWN`
      await prisma.user.create({ data: { email, name: user?.name ?? p.name ?? null, image: user?.image ?? p.picture ?? null, role: 'CLIENT', termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } })
      return true
    },
    async jwt({ token, user, trigger, account }) {
      const t = token as any
      if (account?.type === 'oauth') {
        const email = (user?.email ?? token.email ?? '').toLowerCase()
        const dbUser = email ? await prisma.user.findUnique({ where: { email } }) : null
        if (!dbUser || !ssoAllowed(dbUser.role)) return {} as any
        let info: { userAgent?: string | null; ip?: string | null } = {}
        try {
          const { headers } = await import('next/headers')
          const h = headers()
          info = { userAgent: h.get('user-agent'), ip: (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || null }
        } catch { /* hors requête */ }
        const method: SignInMethod = account.provider === 'azure-ad' ? 'MICROSOFT' : 'GOOGLE'
        const u = sessionUser(dbUser, await openSession(dbUser.id, method, info))
        Object.assign(t, { id: u.id, role: u.role, sid: u.sid, sv: u.sv, mcp: u.mcp, tfa: u.tfa, name: u.name, chk: Date.now(), act: Date.now() })
        return token
      }
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
