export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

// ── POST /api/webhooks/mercadopago ────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  // ── 1. Verificar pago en la API de MercadoPago ────────────────────────────
  let mpPayment: MpPayment
  try {
    mpPayment = await fetchMpPayment(mpPaymentIdStr)
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
    console.error('[webhook/mp] Error activating package:', err)
    // Retornar 500 para que MP reintente
    return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
  }

  // ── POST-TRANSACCIÓN: notificar al alumno ─────────────────────────────────
  // Fuera de la transacción y en try/catch — un fallo de notificación nunca
  // debe aparecer como error al webhook de MercadoPago.
  try {
    // TODO: reemplazar por sendNotification() cuando se implemente /prompt whatsapp
    // await sendNotification({
    //   userId: userPackage.userId,
    //   studioId: userPackage.studioId,
    //   type: 'PAYMENT_APPROVED',
    //   data: { userPackageId: userPackage.id },
    // })
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
 *
 * TODO (Fase 2): usar el access token del estudio correspondiente en lugar del global.
 * Requiere agregar mpAccessToken a StudioSettings o a una tabla de credenciales.
 */
async function fetchMpPayment(paymentId: string): Promise<MpPayment> {
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN not configured')

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // next: { revalidate: 0 } — no cachear respuestas de MP
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP API ${res.status}: ${text}`)
  }

  return res.json() as Promise<MpPayment>
}
