export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireInstructorAPI } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { todayARStart } from '@/lib/formatters'
import { sendEmail } from '@/lib/email'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params

  const guard = await requireInstructorAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  let body: { bookingId?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  const { bookingId, status } = body

  if (!bookingId || (status !== 'ATTENDED' && status !== 'NO_SHOW')) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, studioId, status: 'CONFIRMED' },
    select: {
      userId: true,
      userPackageId: true,
      classSession: { select: { date: true } },
    },
  })

  if (!booking) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }

  // Enforce time window: only today and yesterday
  const today = todayARStart()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sessionDate = booking.classSession.date

  if (sessionDate.getTime() < yesterday.getTime() || sessionDate.getTime() > today.getTime()) {
    return NextResponse.json({ error: 'Fuera del período de registro permitido' }, { status: 403 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { attendanceStatus: status },
    })

    // ── Recovery credit por no-show ─────────────────────────────────────────
    // Solo si: status = NO_SHOW + tenía crédito + noShowPolicy = LOSE_CREDIT + recovery habilitado
    if (status === 'NO_SHOW' && booking.userPackageId !== null) {
      const settings = await tx.studioSettings.findUnique({
        where: { studioId },
        select: { noShowPolicy: true, recoveryEnabled: true, recoveryDays: true },
      })

      // Verificar idempotencia: no generar recovery si ya existe uno para este booking
      const alreadyHasRecovery = await tx.creditTransaction.findFirst({
        where: { bookingId, type: 'RECOVERY_CREDIT' },
        select: { id: true },
      })

      if (
        settings?.recoveryEnabled &&
        settings.noShowPolicy === 'LOSE_CREDIT' &&
        !alreadyHasRecovery
      ) {
        const now = new Date()
        const base = new Date(now.getTime() + settings.recoveryDays * 24 * 60 * 60 * 1000)
        const expiresAt = new Date(Date.UTC(
          base.getUTCFullYear(),
          base.getUTCMonth(),
          base.getUTCDate() + 1,
          2, 59, 59, 999,
        ))

        const recoveryPackage = await tx.userPackage.create({
          data: {
            studioId,
            userId: booking.userId,
            packageId: null,
            paymentStatus: 'APPROVED',
            paymentMethod: 'ADMIN_GRANT',
            classesTotal: 1,
            classesRemaining: 1,
            expiresAt,
            activatedAt: now,
            isRecovery: true,
          },
          select: { id: true },
        })

        await tx.creditTransaction.create({
          data: {
            studioId,
            userPackageId: recoveryPackage.id,
            type: 'RECOVERY_CREDIT',
            amount: 1,
            balanceAfter: 1,
            bookingId,
            note: `Recuperación automática — ${settings.recoveryDays} días`,
          },
        })
      }
    }
  })

  // ── Alerta Pro: 3er no-show del mes ─────────────────────────────────────────
  if (status === 'NO_SHOW') {
    try {
      const now = new Date()
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const [noShowCount, sub] = await Promise.all([
        prisma.booking.count({
          where: {
            studioId,
            userId: booking.userId,
            attendanceStatus: 'NO_SHOW',
            classSession: { date: { gte: monthStart } },
          },
        }),
        prisma.subscription.findUnique({
          where: { studioId },
          select: { plan: true },
        }),
      ])

      if (noShowCount === 3 && sub?.plan === 'PRO') {
        const [admin, student] = await Promise.all([
          prisma.user.findFirst({
            where: { studioId, role: 'STUDIO_ADMIN' },
            select: { email: true, name: true },
          }),
          prisma.user.findUnique({
            where: { id: booking.userId },
            select: { name: true },
          }),
        ])
        if (admin) {
          await sendEmail(admin.email, 'no-show-pro-alert', {
            adminName: admin.name ?? 'Admin',
            studentName: student?.name ?? 'Una alumna',
            studioSlug: studio,
            noShowCount: 3,
          })
        }
      }
    } catch (err) {
      console.error('[attendance] Error en alerta no-show Pro:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
