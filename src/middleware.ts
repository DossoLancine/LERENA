import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    const isB2BRoute = ['/dashboard', '/agent', '/reception', '/org-admin', '/admin'].some(p => path.startsWith(p))
    if (isB2BRoute && !token) {
      return NextResponse.redirect(new URL('/pro/login', req.url))
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
    secret: process.env.NEXTAUTH_SECRET || "attends-super-secret-jwt-key-2026-xK9mP2nL",
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/agent/:path*', '/reception/:path*', '/org-admin/:path*', '/admin/:path*', '/favorites/:path*']
}
