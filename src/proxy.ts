import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET })
  const { pathname } = req.nextUrl

  // ── /superadmin/* → solo SUPER_ADMIN ──────────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    if (token.role !== 'SUPER_ADMIN') return NextResponse.redirect(new URL('/', req.url))
    return NextResponse.next()
  }

  // ── /[studio]/admin/* → STUDIO_ADMIN o SUPER_ADMIN ───────────────────────
  const isAdminRoute = /^\/[^/]+\/admin(\/|$)/.test(pathname)
  if (isAdminRoute) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url))
    if (token.role !== 'STUDIO_ADMIN' && token.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
