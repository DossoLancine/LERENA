import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { oauthProviders } from '@/lib/auth-methods'

// Fournisseurs Google et Microsoft lus dans la console à chaque requête : ils s'activent sans redéploiement
export const dynamic = 'force-dynamic'

type Ctx = { params: { nextauth: string[] } }

async function handler(req: Request, ctx: Ctx) {
  const extra = await oauthProviders().catch(() => [])
  return NextAuth(req as never, ctx as never, { ...authOptions, providers: [...authOptions.providers, ...extra] })
}

export { handler as GET, handler as POST }
