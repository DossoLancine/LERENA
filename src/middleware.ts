import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    const isB2BRoute = path.startsWith('/dashboard') || path.startsWith('/agent')
    if (isB2BRoute && !token) {
      return NextResponse.redirect(new URL('/pro/login', req.url))
    }

    if (path.startsWith('/dashboard') && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (path.startsWith('/agent') && token?.role !== 'AGENT' && token?.role !== 'MANAGER') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    const isClientRoute = path.startsWith('/tickets') || path.startsWith('/favorites') || path.startsWith('/profile')
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
  matcher: ['/dashboard/:path*', '/agent/:path*', '/tickets/:path*', '/favorites/:path*', '/profile/:path*']
}
