export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── POST /api/cron/grace-cutoff ───────────────────────────────────────────────
//
// Se ejecuta el día gracePeriodCutoffDay (default: 10) de cada mes.
// Busca reservas CONFIRMED + userPackageId=null (gracia) del mes corriente
// que siguen sin pagar, y aplica la política del estudio:
//   RELEASE_TO_WAITLIST → reservas futuras pasan a WAITLIST
//   KEEP_AND_ALERT      → se mantienen + notificar admin

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Hora Argentina (UTC-3, sin DST) para calcular el mes corriente
  const nowArt = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const currentYear = nowArt.getUTCFullYear()
  const currentMonth = nowArt.getUTCMonth() // 0-indexed

  // Rango del mes corriente en UTC (medianoche Argentina = 03:00 UTC)
  const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 3, 0, 0))
  const startOfNextMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1, 3, 0, 0)) // JS maneja overflow

  // Solo procesar estudios activos con período de gracia habilitado
  const studios = await prisma.studio.findMany({
    where: {
      active: true,
      settings: { gracePeriodEnabled: true },
    },
    select: {
      id: true,
      settings: {
        select: { graceOnNoPay: true },
      },
    },
  })

  interface StudioResult {
    studioId: string
    releasedToWaitlist: number
    keptAndAlerted: number
    alertUserIds: string[]
    error?: string
  }

  const results: StudioResult[] = []

  for (const studio of studios) {
    const graceOnNoPay = studio.settings?.graceOnNoPay ?? 'RELEASE_TO_WAITLIST'

    try {
      // Buscar reservas en gracia del mes corriente que siguen sin pago
      // Solo reservas FUTURAS — las pasadas son deuda histórica que se liquida con el webhook
      const graceBookings = await prisma.booking.findMany({
        where: {
          studioId: studio.id,
          status: 'CONFIRMED',
          userPackageId: null,
          classSession: {
            date: {
              gte: startOfMonth,
              lt: startOfNextMonth,
              gt: now, // solo futuras — no tocar clases que ya ocurrieron
            },
          },
        },
        select: { id: true, userId: true },
      })

      if (graceBookings.length === 0) {
        results.push({ studioId: studio.id, releasedToWaitlist: 0, keptAndAlerted: 0, alertUserIds: [] })
        continue
      }

      let releasedToWaitlist = 0
      const alertUserIds: string[] = []

      if (graceOnNoPay === 'RELEASE_TO_WAITLIST') {
        // Liberar TODAS las reservas futuras en gracia de este estudio
        const bookingIds = graceBookings.map((b) => b.id)
        const [updateResult] = await prisma.$transaction([
          prisma.booking.updateMany({
            where: {
              id: { in: bookingIds },
              studioId: studio.id, // doble verificación multi-tenant
            },
            data: { status: 'WAITLIST' },
          }),
          prisma.auditLog.create({
            data: {
              studioId: studio.id,
              userId: null, // acción de sistema
              action: 'GRACE_CUTOFF_RELEASE',
              entityType: 'Studio',
              entityId: studio.id,
              after: { releasedToWaitlist: bookingIds.length, graceOnNoPay: 'RELEASE_TO_WAITLIST' },
            },
          }),
        ])
        releasedToWaitlist = updateResult.count
      } else {
        // KEEP_AND_ALERT: mantener las reservas, notificar al admin con la lista
        const uniqueUserIds = [...new Set(graceBookings.map((b) => b.userId))]
        alertUserIds.push(...uniqueUserIds)

        await prisma.auditLog.create({
          data: {
            studioId: studio.id,
            userId: null,
            action: 'GRACE_CUTOFF_ALERT',
            entityType: 'Studio',
            entityId: studio.id,
            after: { alertUserCount: uniqueUserIds.length, graceOnNoPay: 'KEEP_AND_ALERT' },
          },
        })
      }

      results.push({ studioId: studio.id, releasedToWaitlist, keptAndAlerted: graceBookings.length - releasedToWaitlist, alertUserIds })

      // POST-PROCESAMIENTO: notificación al admin — fuera del bloque principal
      try {
        if (graceOnNoPay === 'KEEP_AND_ALERT' && alertUserIds.length > 0) {
          const [admin, studioData, affectedUsers] = await Promise.all([
            prisma.user.findFirst({
              where: { studioId: studio.id, role: 'STUDIO_ADMIN' },
              select: { email: true, name: true },
            }),
            prisma.studio.findUnique({
              where: { id: studio.id },
              select: { name: true },
            }),
            prisma.user.findMany({
              where: { id: { in: alertUserIds }, studioId: studio.id },
              select: {
                id: true,
                name: true,
                _count: { select: { bookings: { where: { status: 'CONFIRMED', userPackageId: null } } } },
              },
            }),
          ])
          if (admin && studioData) {
            await sendEmail(admin.email, 'grace-cutoff-admin', {
              adminName: admin.name ?? 'Admin',
              studioName: studioData.name,
              studentCount: alertUserIds.length,
              students: affectedUsers.map((u) => ({
                name: u.name,
                bookingCount: u._count.bookings,
              })),
            })
          }
        }
      } catch (notifErr) {
        console.error(`[cron/grace-cutoff] Error sending notification studio=${studio.id}:`, notifErr)
      }
    } catch (err) {
      console.error(`[cron/grace-cutoff] Error processing studio=${studio.id}:`, err)
      results.push({
        studioId: studio.id,
        releasedToWaitlist: 0,
        keptAndAlerted: 0,
        alertUserIds: [],
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({ ok: true, studiosProcessed: studios.length, results })
}
