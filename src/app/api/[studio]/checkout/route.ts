export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Tipos MP ──────────────────────────────────────────────────────────────────

interface MpPreferenceResponse {
  id: string
  init_point: string         // URL de pago producción
  sandbox_init_point: string // URL de pago sandbox (TEST credentials)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Último día del mes actual a las 23:59:59 hora Argentina (UTC-3).
 * = 1ro del mes siguiente a las 02:59:59 UTC.
 */
function endOfCurrentMonthAR(): Date {
  const arNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth() + 1, 1, 2, 59, 59, 999))
}

// ── POST /api/[studio]/checkout ───────────────────────────────────────────────
//
// Body esperado: { packageId: string }
// Respuesta:     { checkoutUrl: string }
//
// Seguridad:
//   - studioId siempre del servidor (session + tenant), NUNCA del body
//   - Precio siempre de la DB, NUNCA del body del cliente
//   - MP_ACCESS_TOKEN solo en server-side (no NEXT_PUBLIC)
//   - Si falla MP después de crear el UserPackage → se cancela para no dejar basura

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  // ── Autenticación ──────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Solo alumnos pueden comprar paquetes (admins usan asignación manual)
  if (session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Solo alumnos pueden comprar paquetes' }, { status: 403 })
  }

  // ── Tenant ─────────────────────────────────────────────────────────────────
  const tenant = await getTenantBySlug(studio)
  if (!tenant) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }
  if (session.user.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // ── Parsear body — solo packageId del cliente ──────────────────────────────
  let packageId: string
  try {
    const body = (await req.json()) as { packageId?: unknown }
    if (!body.packageId || typeof body.packageId !== 'string') {
      return NextResponse.json({ error: 'packageId requerido' }, { status: 400 })
    }
    packageId = body.packageId
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // ── Buscar paquete en DB — precio SIEMPRE del servidor ─────────────────────
  const pkg = await prisma.package.findFirst({
    where: { id: packageId, studioId: tenant.studioId, active: true },
    select: { id: true, name: true, classCount: true, price: true },
  })
  if (!pkg) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 })
  }

  // ── Verificar MP configurado ───────────────────────────────────────────────
  // Prioridad: token del estudio → fallback al token global (MP_ACCESS_TOKEN)
  const studioSettings = await prisma.studioSettings.findUnique({
    where: { studioId: tenant.studioId },
    select: { mpAccessToken: true },
  })
  const accessToken = studioSettings?.mpAccessToken ?? process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    console.error('[checkout] MP_ACCESS_TOKEN no configurado para estudio:', tenant.studioId)
    return NextResponse.json({ error: 'Pago no disponible. El estudio aún no configuró MercadoPago.' }, { status: 503 })
  }

  // ── Crear UserPackage PENDING ──────────────────────────────────────────────
  // Se crea antes de llamar a MP para tener el ID como external_reference.
  // Si MP falla, se cancela para no acumular registros PENDING sin preferencia.
  const userPackage = await prisma.userPackage.create({
    data: {
      studioId: tenant.studioId,
      userId: session.user.id,
      packageId: pkg.id,
      paymentMethod: 'MERCADOPAGO',
      paymentStatus: 'PENDING',
      classesTotal: pkg.classCount,
      classesRemaining: 0, // se actualiza al activar con el webhook
      expiresAt: endOfCurrentMonthAR(),
    },
  })

  // ── Construir URL base ─────────────────────────────────────────────────────
  // APP_URL en producción (ej: "https://pilates.flexa.app")
  // En desarrollo: si no hay APP_URL, usar localhost (sin notification_url para MP)
  const appBaseUrl = (process.env.APP_URL ?? `http://${req.headers.get('host')}`).replace(/\/$/, '')
  const isLocalhost = appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1')

  // ── Crear preferencia en MercadoPago ──────────────────────────────────────
  // precio en la DB está en centavos ARS → convertir a pesos (MP acepta enteros)
  const unitPrice = Math.max(1, Math.round(pkg.price / 100))

  const preferenceBody: Record<string, unknown> = {
    items: [
      {
        title: pkg.name,
        quantity: 1,
        unit_price: unitPrice,
        currency_id: 'ARS',
      },
    ],
    external_reference: userPackage.id,
    statement_descriptor: 'FLEXA PILATES',
  }

  // back_urls y auto_return solo funcionan con URLs públicas (no localhost)
  // En producción/ngrok → redirigir automáticamente al aprobar
  if (!isLocalhost) {
    preferenceBody.back_urls = {
      success: `${appBaseUrl}/${studio}/paquetes?payment=success`,
      failure: `${appBaseUrl}/${studio}/paquetes?payment=failure`,
      pending: `${appBaseUrl}/${studio}/paquetes?payment=pending`,
    }
    preferenceBody.auto_return = 'approved'
    preferenceBody.notification_url = `${appBaseUrl}/api/webhooks/mercadopago`
  }

  let preference: MpPreferenceResponse
  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceBody),
      cache: 'no-store',
    })

    if (!mpRes.ok) {
      const errText = await mpRes.text()
      throw new Error(`MP API ${mpRes.status}: ${errText.slice(0, 500)}`)
    }

    preference = (await mpRes.json()) as MpPreferenceResponse
  } catch (err) {
    console.error('[checkout] Error creando preferencia MP:', err)

    // Cancelar el UserPackage para no dejar registros PENDING huérfanos
    await prisma.userPackage.update({
      where: { id: userPackage.id },
      data: { paymentStatus: 'CANCELLED' },
    })

    return NextResponse.json({ error: 'Error al procesar el pago. Intentá de nuevo o contactá soporte.' }, { status: 502 })
  }

  // MP_SANDBOX=true → usar sandbox_init_point (credenciales de prueba)
  // MP_SANDBOX no seteado o false → usar init_point (producción)
  const isSandbox = process.env.MP_SANDBOX === 'true' || accessToken.startsWith('TEST-')
  const checkoutUrl = isSandbox ? preference.sandbox_init_point : preference.init_point

  return NextResponse.json({ checkoutUrl })
}
