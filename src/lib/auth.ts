import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { clearFailures, clientIp, isLocked, LOCKED_MESSAGE, recordFailure } from "./login-guard"

// Clé de signature des sessions : obligatoire, jamais écrite dans le code
const secret = process.env.NEXTAUTH_SECRET
if (!secret && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET manquant : définissez-le dans les variables d’environnement')
}

// Même message que le compte existe ou non : on ne révèle pas quels e-mails ou numéros sont inscrits
const INVALID = 'Identifiant ou mot de passe incorrect'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        identifier: { label: "Téléphone ou Email", type: "text" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error('Identifiants manquants')
        }

        const identifier = credentials.identifier.trim().toLowerCase()
        const ip = clientIp(req?.headers as Record<string, unknown> | undefined)
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
        await clearFailures(identifier)

        return {
          id: (user as any).id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: (user as any).role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        const t = token as any;
        t.role = u.role;
        t.id = u.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session.user as any;
        const t = token as any;
        s.role = t.role;
        s.id = t.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret,
}
