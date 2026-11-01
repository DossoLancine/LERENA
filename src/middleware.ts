import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { twoFactorRequiredFor } from "@/lib/two-factor-policy"

export default withAuth(
  function middleware(req) {
    // Une session révoquée ou expirée garde un jeton vide : elle compte comme « non connecté »
    const token = req.nextauth.token?.id ? req.nextauth.token : null
    const path = req.nextUrl.pathname

    const isB2BRoute = ['/dashboard', '/agent', '/reception', '/org-admin', '/admin'].some(p => path.startsWith(p))
    if (isB2BRoute && !token) {
      return NextResponse.redirect(new URL('/pro/login', req.url))
    }

    // Sécurité du compte (changement de mot de passe, double authentification) : il faut être connecté
    if (path.startsWith('/account') && !token) {
      return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${encodeURIComponent(path)}`, req.url))
    }

    // Mot de passe provisoire : à changer avant d'accéder à son espace
    if (isB2BRoute && (token as any)?.mcp) {
      return NextResponse.redirect(new URL('/account/password?required=1', req.url))
    }

    // Administration de la plateforme et des réseaux : double authentification obligatoire en production
    const needsTwoFactor = twoFactorRequiredFor(token?.role as string | undefined)
    if ((path.startsWith('/admin') || path.startsWith('/org-admin')) && needsTwoFactor && !(token as any)?.tfa) {
      return NextResponse.redirect(new URL('/account/security?required=1', req.url))
    }

    if (path.startsWith('/dashboard') && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (path.startsWith('/agent') && token?.role !== 'AGENT' && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Mes tickets et Profil restent ouverts aux visiteurs (tickets sans compte, préférences d'affichage)
    if (path.startsWith('/reception') && token?.role !== 'RECEPTION' && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (path.startsWith('/org-admin') && token?.role !== 'ORG_ADMIN' && token?.role !== 'VIEWER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (path.startsWith('/admin') && token?.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    const isClientRoute = path.startsWith('/favorites')
    if (isClientRoute && !token) {
      return NextResponse.redirect(new URL('/auth/login', req.url))
    }
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        return true // Le middleware s'occupe des redirections
      },
    },
    // Clé obligatoire (aucune valeur de secours) : sans elle, aucune session n’est reconnue
    secret: process.env.NEXTAUTH_SECRET,
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/agent/:path*', '/reception/:path*', '/org-admin/:path*', '/admin/:path*', '/favorites/:path*', '/account/:path*']
}
