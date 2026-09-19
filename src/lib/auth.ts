import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Identifiants manquants')
        }

        const email = credentials.email.trim().toLowerCase()
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: email },
              { email: credentials.email.trim() }
            ]
          }
        })

        if (!user || !user.password) {
          throw new Error('Utilisateur non trouvé')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error('Mot de passe incorrect')
        }

        return {
          id: (user as any).id,
          name: user.name,
          email: user.email,
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
  secret: process.env.NEXTAUTH_SECRET || "default_secret_for_dev",
}
