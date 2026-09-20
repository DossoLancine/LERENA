import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    if (path.startsWith('/dashboard') && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (path.startsWith('/agent') && token?.role !== 'AGENT' && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    const isClientRoute = path.startsWith('/explore') || path.startsWith('/org') || path.startsWith('/tickets') || path.startsWith('/favorites')
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
  matcher: ['/dashboard/:path*', '/agent/:path*', '/explore/:path*', '/org/:path*', '/tickets/:path*', '/favorites/:path*']
}
