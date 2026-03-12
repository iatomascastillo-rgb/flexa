import { auth } from '@/lib/auth'

// El middleware corre en Edge Runtime — lee el JWT del cookie directamente,
// sin DB lookups. Si el token tiene role → pasa. Si no → redirige a login.

export default auth((req) => {
  const session = req.auth
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/superadmin')) {
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('studio', 'flexa')
      loginUrl.searchParams.set('callbackUrl', '/superadmin')
      return Response.redirect(loginUrl)
    }
  }
})

export const config = {
  matcher: ['/superadmin/:path*'],
}
