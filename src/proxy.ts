import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(req: NextRequest) {
  // NextAuth v5 usa "authjs.session-token" (no "next-auth.session-token" de v4)
  // En HTTPS (producción) el prefijo __Secure- se agrega automáticamente
  const secureCookie = req.url.startsWith('https')
  const cookieName = secureCookie ? '__Secure-authjs.session-token' : 'authjs.session-token'
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? ''
  const token = await getToken({ req, secret, cookieName, salt: cookieName })
  const { pathname } = req.nextUrl

  // ── /superadmin/* → solo SUPER_ADMIN ──────────────────────────────────────
  if (pathname.startsWith('/superadmin')) {
    if (!token || token.role !== 'SUPER_ADMIN') {
      const url = new URL('/login', req.url)
      url.searchParams.set('studio', 'flexa')
      url.searchParams.set('callbackUrl', '/superadmin')
      return NextResponse.redirect(url)
    }
    return NextResponse.next()
  }

  // ── /[studio]/admin/* → STUDIO_ADMIN o SUPER_ADMIN ───────────────────────
  const adminMatch = /^\/([^/]+)\/admin(\/|$)/.exec(pathname)
  if (adminMatch) {
    if (!token) {
      const url = new URL('/login', req.url)
      url.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(url)
    }
    if (token.role !== 'STUDIO_ADMIN' && token.role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(`/${adminMatch[1]}`, req.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
