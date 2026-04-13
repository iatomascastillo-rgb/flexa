export const dynamic = 'force-dynamic'

import { createHmac, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'

// ── Seguridad del state OAuth ─────────────────────────────────────────────────
//
// El `state` previene dos ataques:
//
// 1. CSRF: un atacante no puede iniciar un flow OAuth y redirigir al admin a
//    un callback con un `code` malicioso — el state no coincidiría.
//
// 2. Cross-tenant: el state incluye el studioId y studio slug firmados con
//    HMAC-SHA256 usando AUTH_SECRET. Si alguien altera el state para cambiar
//    el estudio, la firma falla y el callback rechaza la solicitud.
//
// Formato: base64url( studioId:studio:nonce:timestamp ) + "." + HMAC(payload)
// Expira en 10 minutos — suficiente para completar el login en MP.
//
// No se almacena en DB — la firma hace de nonce implícito.
// Replay en ventana de 10 min es teóricamente posible pero requiere interceptar
// el URL del navegador via HTTPS, lo cual ya es el threat model de TLS.

export function buildOAuthState(studioId: string, studio: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET no configurado')

  const nonce   = randomBytes(16).toString('hex')
  const ts      = Date.now().toString()
  const payload = `${studioId}:${studio}:${nonce}:${ts}`
  const sig     = createHmac('sha256', secret).update(payload).digest('hex')

  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

// ── GET /api/[studio]/mp-oauth/connect ───────────────────────────────────────
//
// Solo STUDIO_ADMIN puede iniciar el flujo.
// Genera el state y redirige a MP Authorization.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  const clientId = process.env.MP_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: 'MercadoPago OAuth no está configurado en este servidor.' },
      { status: 503 },
    )
  }

  const appUrl       = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri  = `${appUrl}/api/mp-oauth/callback`
  const state        = buildOAuthState(studioId, studio)

  const authUrl = new URL('https://auth.mercadopago.com/authorization')
  authUrl.searchParams.set('client_id',    clientId)
  authUrl.searchParams.set('response_type','code')
  authUrl.searchParams.set('platform_id',  'mp')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state',        state)

  return NextResponse.redirect(authUrl.toString())
}
