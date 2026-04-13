export const dynamic = 'force-dynamic'

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

// ── Verificación del state firmado ────────────────────────────────────────────
//
// Valida que el state:
//   1. Tiene firma HMAC válida (no fue alterado)
//   2. No venció (< 10 minutos desde que se generó)
//   3. El studio del state coincide con el admin logueado (anti cross-tenant)
//
// Retorna { studioId, studio } si es válido, null si no.

function verifyOAuthState(
  state: string,
  sessionStudioId: string,
): { studioId: string; studio: string } | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null

  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const lastColon = decoded.lastIndexOf(':')
    if (lastColon < 0) return null

    const payload = decoded.slice(0, lastColon)
    const sig     = decoded.slice(lastColon + 1)
    const parts   = payload.split(':')
    if (parts.length !== 4) return null

    const [studioId, studio, , ts] = parts

    // ── 1. Verificar firma (timing-safe) ──────────────────────────────────
    const expectedSig = createHmac('sha256', secret).update(payload).digest('hex')
    const sigBuffer   = Buffer.from(sig, 'hex')
    const expBuffer   = Buffer.from(expectedSig, 'hex')
    if (sigBuffer.length !== expBuffer.length) return null
    if (!timingSafeEqual(sigBuffer, expBuffer)) return null

    // ── 2. Verificar expiración (10 minutos) ─────────────────────────────
    const age = Date.now() - parseInt(ts, 10)
    if (age > 10 * 60 * 1000) return null

    // ── 3. Verificar que el admin logueado pertenece al estudio del state ─
    // Previene que un admin de estudio A complete el OAuth para estudio B.
    if (studioId !== sessionStudioId) return null

    return { studioId, studio }
  } catch {
    return null
  }
}

// ── Intercambio code → token ──────────────────────────────────────────────────

interface MpTokenResponse {
  access_token:  string
  refresh_token: string
  expires_in:    number   // segundos
  token_type:    string
  scope:         string
  user_id:       number
}

async function exchangeCodeForToken(code: string, redirectUri: string): Promise<MpTokenResponse> {
  const clientId     = process.env.MP_CLIENT_ID
  const clientSecret = process.env.MP_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('MP_CLIENT_ID o MP_CLIENT_SECRET no configurados')
  }

  // MP_CLIENT_SECRET nunca sale del servidor — este fetch es server-side.
  const res = await fetch('https://api.mercadopago.com/oauth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  redirectUri,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP OAuth error ${res.status}: ${text.slice(0, 300)}`)
  }

  return res.json() as Promise<MpTokenResponse>
}

// ── GET /api/mp-oauth/callback ────────────────────────────────────────────────
//
// URL única registrada en MP — no incluye [studio] para poder registrarla
// en el panel de MP sin depender de cada estudio.
//
// Flujo:
//   1. Verificar que el admin sigue logueado (sesión activa)
//   2. Verificar state (CSRF + expiración + cross-tenant)
//   3. Intercambiar code por access_token (server-side)
//   4. Guardar token en StudioSettings
//   5. Redirigir al panel de configuración con mensaje de éxito

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // ── MP rechazó o el usuario canceló ──────────────────────────────────────
  if (error || !code || !state) {
    const reason = error ?? 'cancelado'
    console.warn('[mp-oauth/callback] Flow cancelado o error de MP:', reason)
    // No podemos saber el studio sin un state válido — redirigir a raíz
    return NextResponse.redirect(
      new URL('/?mp_error=cancelled', req.nextUrl.origin),
    )
  }

  // ── 1. Verificar sesión ───────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') {
    return NextResponse.redirect(
      new URL('/login?error=unauthorized', req.nextUrl.origin),
    )
  }

  // ── 2. Verificar state ────────────────────────────────────────────────────
  const verified = verifyOAuthState(state, session.user.studioId)
  if (!verified) {
    console.warn('[mp-oauth/callback] State inválido o expirado para user:', session.user.id)
    return NextResponse.redirect(
      new URL(`/${session.user.studioId}/admin/settings/mercadopago?error=state`, req.nextUrl.origin),
    )
  }

  const { studioId, studio } = verified
  const appUrl      = (process.env.APP_URL ?? `https://${req.headers.get('host')}`).replace(/\/$/, '')
  const redirectUri = `${appUrl}/api/mp-oauth/callback`

  // ── 3. Intercambiar code por token ────────────────────────────────────────
  let tokenData: MpTokenResponse
  try {
    tokenData = await exchangeCodeForToken(code, redirectUri)
  } catch (err) {
    console.error('[mp-oauth/callback] Error intercambiando code:', err)
    return NextResponse.redirect(
      new URL(`/${studio}/admin/settings/mercadopago?error=token`, req.nextUrl.origin),
    )
  }

  // ── 4. Guardar token en DB ────────────────────────────────────────────────
  // El access_token y refresh_token solo se almacenan server-side.
  // expires_in está en segundos desde ahora.
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000)

  try {
    await prisma.studioSettings.upsert({
      where:  { studioId },
      update: {
        mpAccessToken:    tokenData.access_token,
        mpRefreshToken:   tokenData.refresh_token,
        mpTokenExpiresAt: expiresAt,
      },
      create: {
        studioId,
        mpAccessToken:    tokenData.access_token,
        mpRefreshToken:   tokenData.refresh_token,
        mpTokenExpiresAt: expiresAt,
      },
    })
  } catch (err) {
    console.error('[mp-oauth/callback] Error guardando token:', err)
    return NextResponse.redirect(
      new URL(`/${studio}/admin/settings/mercadopago?error=db`, req.nextUrl.origin),
    )
  }

  console.log(`[mp-oauth/callback] Token guardado para estudio ${studio} (MP user ${tokenData.user_id})`)

  // ── 5. Redirigir con éxito ────────────────────────────────────────────────
  return NextResponse.redirect(
    new URL(`/${studio}/admin/settings/mercadopago?saved=1`, req.nextUrl.origin),
  )
}
