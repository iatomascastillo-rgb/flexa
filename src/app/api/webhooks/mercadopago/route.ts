export const dynamic = 'force-dynamic'

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── MP Types ──────────────────────────────────────────────────────────────────

interface MpWebhookBody {
  type?: string
  action?: string
  data?: { id?: string | number }
}

interface MpPayment {
  id: number
  status: string               // "approved" | "pending" | "rejected" | ...
  external_reference: string | null  // = userPackageId que seteamos al crear la preferencia
}

// ── Verificación de firma MP (HMAC-SHA256) ────────────────────────────────────
//
// MP envía: x-signature: "ts=<timestamp>,v1=<hmac>"  y  x-request-id: "<id>"
// El manifest que se firma es: "id:<dataId>;request-id:<xRequestId>;ts:<ts>"
// Ref: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
//
// Usamos timingSafeEqual para evitar timing attacks en la comparación.

function verifyMpSignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string,
  secret: string,
): boolean {
  if (!signatureHeader || !requestId) return false

  // Parsear "ts=...,v1=..." sin asumir orden
  const parts: Record<string, string> = {}
  for (const chunk of signatureHeader.split(',')) {
    const eq = chunk.indexOf('=')
    if (eq > 0) parts[chunk.slice(0, eq).trim()] = chunk.slice(eq + 1).trim()
  }

  const { ts, v1 } = parts
  if (!ts || !v1) return false

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`
  const expected = createHmac('sha256', secret).update(manifest).digest('hex')

  // Comparación en tiempo constante
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    // Buffer.from lanza si v1 no es hex válido
    return false
  }
}

// ── POST /api/webhooks/mercadopago ────────────────────────────────────────────

// Advertir en startup si la firma HMAC no está configurada.
// Sin este secret, cualquiera puede enviar eventos de pago falsos.
// Mitigado parcialmente porque el handler re-verifica con la API de MP.
if (!process.env.MP_WEBHOOK_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    // En producción es obligatorio — sin este secret cualquiera puede falsificar pagos.
    // Configurarlo en Vercel → Settings → Environment Variables → MP_WEBHOOK_SECRET.
    console.error('[webhook/mp] CRÍTICO: MP_WEBHOOK_SECRET no configurado en producción')
  } else {
    console.warn('[webhook/mp] MP_WEBHOOK_SECRET no configurado — verificación de firma deshabilitada (solo dev)')
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Leer el studio slug de ?studio=slug (seteado por checkout/route.ts)
  // Permite usar el token del estudio correcto en fetchMpPayment.
  const studioSlug = req.nextUrl.searchParams.get('studio') ?? null

  let body: MpWebhookBody
  try {
    body = (await req.json()) as MpWebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // MP puede enviar type="payment" o action="payment.updated" / "payment.created"
  const isPaymentEvent =
    body.type === 'payment' ||
    body.action === 'payment.created' ||
    body.action === 'payment.updated'

  if (!isPaymentEvent) {
    return NextResponse.json({ ok: true })
  }

  const rawId = body.data?.id
  if (!rawId) {
    return NextResponse.json({ ok: true })
  }

  const mpPaymentIdStr = String(rawId)

  // ── Verificar firma HMAC ──────────────────────────────────────────────────
  // Si MP_WEBHOOK_SECRET está configurado, rechazar solicitudes sin firma válida.
  // Si no está configurado, se omite la verificación HMAC pero el paso siguiente
  // (consultar la API de MP con el access token del estudio) garantiza la seguridad:
  // nadie puede fabricar un paymentId aprobado que no exista en esa cuenta de MP.
  const webhookSecret = process.env.MP_WEBHOOK_SECRET
  if (webhookSecret) {
    const isValid = verifyMpSignature(
      req.headers.get('x-signature'),
      req.headers.get('x-request-id'),
      mpPaymentIdStr,
      webhookSecret,
    )
    if (!isValid) {
      console.warn('[webhook/mp] Invalid signature for payment:', mpPaymentIdStr)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[webhook/mp] MP_WEBHOOK_SECRET no configurado — HMAC omitido, verificando con API de MP')
  }

  // ── Resolver token del estudio ────────────────────────────────────────────
  // El token siempre viene del estudio específico vía ?studio=slug.
  // No hay fallback al token global — evita procesar pagos de un estudio
  // con credenciales de otro en caso de slug faltante o mal configurado.
  if (!studioSlug) {
    console.warn('[webhook/mp] Webhook recibido sin parámetro studio — ignorando')
    return NextResponse.json({ ok: true })
  }

  let accessToken: string | null = null
  try {
    const studioData = await prisma.studio.findUnique({
      where:  { slug: studioSlug },
      select: { settings: { select: { mpAccessToken: true } } },
    })
    accessToken = studioData?.settings?.mpAccessToken ?? null
  } catch (err) {
    console.warn('[webhook/mp] Error al resolver token del estudio:', studioSlug, err)
  }

  // Fallback al token global solo si el estudio no tiene token propio configurado
  // (estudios en período de transición que aún no conectaron su cuenta MP)
  if (!accessToken) {
    accessToken = process.env.MP_ACCESS_TOKEN ?? null
  }

  if (!accessToken) {
    console.error('[webhook/mp] Sin access token para estudio:', studioSlug)
    return NextResponse.json({ ok: true })
  }

  // ── 1. Verificar pago en la API de MercadoPago ────────────────────────────
  let mpPayment: MpPayment
  try {
    mpPayment = await fetchMpPayment(mpPaymentIdStr, accessToken)
  } catch (err) {
    console.error('[webhook/mp] Error fetching payment from MP API:', err)
    // Devolver 200 para que MP no reintente indefinidamente
    return NextResponse.json({ ok: true })
  }

  // Solo procesar pagos aprobados
  if (mpPayment.status !== 'approved') {
    return NextResponse.json({ ok: true })
  }

  const userPackageId = mpPayment.external_reference
  if (!userPackageId) {
    console.error('[webhook/mp] Payment has no external_reference:', mpPaymentIdStr)
    return NextResponse.json({ ok: true })
  }

  // ── 2. IDEMPOTENCIA ───────────────────────────────────────────────────────
  // Verificar que NO existe UserPackage con paymentId=<mpPaymentId> y status=APPROVED.
  // Si ya existe → este webhook ya fue procesado → retornar sin hacer nada.
  const alreadyProcessed = await prisma.userPackage.findFirst({
    where: { paymentId: mpPaymentIdStr, paymentStatus: 'APPROVED' },
    select: { id: true },
  })
  if (alreadyProcessed) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // ── 3. Buscar el UserPackage por external_reference ───────────────────────
  const userPackage = await prisma.userPackage.findUnique({
    where: { id: userPackageId },
    select: {
      id: true,
      userId: true,
      studioId: true,
      classesTotal: true,
      paymentStatus: true,
    },
  })

  if (!userPackage) {
    console.error('[webhook/mp] UserPackage not found:', userPackageId)
    return NextResponse.json({ ok: true })
  }

  // Si ya fue activado por otro medio (transferencia, efectivo), no procesar
  if (userPackage.paymentStatus === 'APPROVED') {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  // ── 4. Activar paquete con liquidación de gracia (Flujo 5) ────────────────
  try {
    await activatePackage({
      userPackageId: userPackage.id,
      userId: userPackage.userId,
      studioId: userPackage.studioId,
      classesTotal: userPackage.classesTotal,
      mpPaymentId: mpPaymentIdStr,
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'IDEMPOTENT') {
      return NextResponse.json({ ok: true, idempotent: true })
    }
    console.error('[webhook/mp] Error activating package:', err)
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
  }

  // ── POST-TRANSACCIÓN: notificar al alumno ─────────────────────────────────
  // Fuera de la transacción y en try/catch — un fallo de notificación nunca
  // debe aparecer como error al webhook de MercadoPago.
  try {
    const [userForEmail, pkgForEmail, studioForEmail] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userPackage.userId },
        select: { email: true, name: true },
      }),
      prisma.userPackage.findUnique({
        where: { id: userPackage.id },
        select: { expiresAt: true, package: { select: { name: true } } },
      }),
      prisma.studio.findUnique({
        where: { id: userPackage.studioId },
        select: { name: true },
      }),
    ])
    if (userForEmail && pkgForEmail) {
      await sendEmail(userForEmail.email, 'pago-aprobado', {
        studentName: userForEmail.name ?? 'Alumna',
        packageName: pkgForEmail.package?.name ?? 'Paquete',
        classesTotal: userPackage.classesTotal,
        expiresAt: pkgForEmail.expiresAt.toLocaleDateString('es-AR', {
          day: 'numeric', month: 'long', year: 'numeric',
        }),
        studioName: studioForEmail?.name ?? '',
      })
    }
  } catch (err) {
    console.error('[webhook/mp] Error sending notification:', err)
  }

  return NextResponse.json({ ok: true })
}

// ── activatePackage ───────────────────────────────────────────────────────────

interface ActivatePackageParams {
  userPackageId: string
  userId: string
  studioId: string
  classesTotal: number
  mpPaymentId: string
}

/**
 * Activa un UserPackage y liquida la deuda de gracia (Flujo 5 del DATABASE.md).
 *
 * Pasos:
 * 1. UserPackage → APPROVED, activatedAt, paymentId
 * 2. CreditTransaction PURCHASE +classesTotal
 * 3. Liquidar deuda pasada (clases en gracia ya asistidas)
 * 4. Vincular reservas futuras en gracia
 * 5. Sobrantes sin cobertura → WAITLIST
 * 6. Actualizar classesRemaining = classesTotal - debtSettled - futureCovered
 * 7. AuditLog PACKAGE_ACTIVATED
 */
async function activatePackage({
  userPackageId,
  userId,
  studioId,
  classesTotal,
  mpPaymentId,
}: ActivatePackageParams): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const now = new Date()

    // FOR UPDATE: prevenir activaciones concurrentes del mismo paquete
    await tx.$queryRaw`
      SELECT id FROM user_packages WHERE id = ${userPackageId} FOR UPDATE
    `

    // ── 0. Idempotencia DENTRO de la transacción ──────────────────────────
    // Re-verificar después del lock para que dos webhooks simultáneos no
    // pasen ambos el check externo y lleguen aquí al mismo tiempo.
    const currentPkg = await tx.userPackage.findUnique({
      where:  { id: userPackageId },
      select: { paymentStatus: true, paymentId: true },
    })
    if (currentPkg?.paymentStatus === 'APPROVED' || currentPkg?.paymentId === mpPaymentId) {
      throw new Error('IDEMPOTENT')
    }

    // ── 1. Activar paquete ────────────────────────────────────────────────
    await tx.userPackage.update({
      where: { id: userPackageId },
      data: {
        paymentStatus: 'APPROVED',
        activatedAt: now,
        paymentId: mpPaymentId,
        // classesRemaining se calcula al final (paso 6)
      },
    })

    // ── 2. CreditTransaction PURCHASE ────────────────────────────────────
    await tx.creditTransaction.create({
      data: {
        studioId,
        userPackageId,
        type: 'PURCHASE',
        amount: classesTotal,
        balanceAfter: classesTotal,
      },
    })

    // ── 3. LIQUIDAR DEUDA — reservas en gracia ya pasadas ─────────────────
    // Buscar clases con userPackageId=null + status=CONFIRMED + date <= hoy
    // ORDER BY createdAt ASC — cubrir las más antiguas primero
    const debtBookings = await tx.booking.findMany({
      where: {
        userId,
        studioId,
        userPackageId: null,
        status: 'CONFIRMED',
        classSession: { date: { lte: now } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    const debtToCover = Math.min(debtBookings.length, classesTotal)

    if (debtToCover > 0) {
      const debtIds = debtBookings.slice(0, debtToCover).map((b) => b.id)

      await tx.booking.updateMany({
        where: { id: { in: debtIds } },
        data: { userPackageId },
      })

      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId,
          type: 'GRACE_DEBT_SETTLEMENT',
          amount: -debtToCover,
          balanceAfter: classesTotal - debtToCover,
        },
      })
    }

    const remainingAfterDebt = classesTotal - debtToCover

    // ── 4. VINCULAR RESERVAS FUTURAS en gracia ────────────────────────────
    // Buscar clases con userPackageId=null + status=CONFIRMED + date > hoy
    // ORDER BY classSession.date ASC — vincular las más próximas primero
    const futureGraceBookings = await tx.booking.findMany({
      where: {
        userId,
        studioId,
        userPackageId: null,
        status: 'CONFIRMED',
        classSession: { date: { gt: now } },
      },
      orderBy: { classSession: { date: 'asc' } },
      select: { id: true },
    })

    const futureToCover = Math.min(futureGraceBookings.length, remainingAfterDebt)

    if (futureToCover > 0) {
      const futureIds = futureGraceBookings.slice(0, futureToCover).map((b) => b.id)

      await tx.booking.updateMany({
        where: { id: { in: futureIds } },
        data: { userPackageId },
      })

      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId,
          type: 'BOOKING_DEDUCT',
          amount: -futureToCover,
          balanceAfter: remainingAfterDebt - futureToCover,
        },
      })
    }

    // ── 5. Sobrantes sin cobertura → WAITLIST ─────────────────────────────
    const uncoveredBookings = futureGraceBookings.slice(futureToCover)
    if (uncoveredBookings.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: uncoveredBookings.map((b) => b.id) } },
        data: { status: 'WAITLIST' },
      })
    }

    // ── 6. Actualizar classesRemaining ────────────────────────────────────
    const finalRemaining = classesTotal - debtToCover - futureToCover

    await tx.userPackage.update({
      where: { id: userPackageId },
      data: { classesRemaining: finalRemaining },
    })

    // ── 7. AuditLog PACKAGE_ACTIVATED ─────────────────────────────────────
    await tx.auditLog.create({
      data: {
        studioId,
        userId,
        action: 'PACKAGE_ACTIVATED',
        entityType: 'UserPackage',
        entityId: userPackageId,
        after: {
          classesTotal,
          debtSettled: debtToCover,
          futureCovered: futureToCover,
          uncoveredMovedToWaitlist: uncoveredBookings.length,
          classesRemaining: finalRemaining,
          mpPaymentId,
        },
      },
    })
  })
}

// ── fetchMpPayment ────────────────────────────────────────────────────────────

/**
 * Obtiene el detalle de un pago desde la API de MercadoPago.
 * Usa el token del estudio si está disponible, de lo contrario el token global.
 */
async function fetchMpPayment(paymentId: string, accessToken: string): Promise<MpPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP API ${res.status}: ${text}`)
  }

  return res.json() as Promise<MpPayment>
}
