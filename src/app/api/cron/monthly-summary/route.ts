export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Devuelve el rango del mes anterior en UTC (ajustado a zona Argentina UTC-3) */
function lastMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date()
  // Hora Argentina (UTC-3, sin DST)
  const ar = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  const year = ar.getUTCMonth() === 0 ? ar.getUTCFullYear() - 1 : ar.getUTCFullYear()
  const month = ar.getUTCMonth() === 0 ? 11 : ar.getUTCMonth() - 1 // 0-indexed

  // Medianoche Argentina = 03:00 UTC
  const start = new Date(Date.UTC(year, month, 1, 3, 0, 0))
  const end = new Date(Date.UTC(year, month + 1, 1, 3, 0, 0)) // overflow manejado por JS

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const label = `${MESES[month]} ${year}`

  return { start, end, label }
}

// ── POST /api/cron/monthly-summary ────────────────────────────────────────────
//
// Se ejecuta el día 1 de cada mes.
// Envía a cada STUDIO_ADMIN un resumen del mes anterior:
//   - Alumnas activas / nuevas
//   - Ingresos + paquetes pagados
//   - Clases, reservas, gracia

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { start, end, label } = lastMonthRange()

  const studios = await prisma.studio.findMany({
    where: {
      active: true,
      subscription: { status: { in: ['TRIAL', 'ACTIVE'] } },
    },
    select: { id: true, name: true, slug: true },
  })

  interface SummaryResult {
    studioId: string
    studioName: string
    sent: boolean
    error?: string
  }

  const results: SummaryResult[] = []

  for (const studio of studios) {
    try {
      const [
        admin,
        activeStudents,
        newStudents,
        sessions,
        confirmedBookings,
        graceBookings,
        paidPackages,
        noShows,
        cancellations,
        studentsWithoutActivity,
      ] = await Promise.all([
        prisma.user.findFirst({
          where: { studioId: studio.id, role: 'STUDIO_ADMIN' },
          select: { email: true, name: true },
        }),
        // Alumnas activas (total, no solo del mes)
        prisma.user.count({
          where: { studioId: studio.id, role: 'STUDENT', active: true },
        }),
        // Nuevas inscripciones del mes anterior
        prisma.user.count({
          where: {
            studioId: studio.id,
            role: 'STUDENT',
            createdAt: { gte: start, lt: end },
          },
        }),
        // Sesiones no canceladas del mes anterior (con capacidad para calcular ocupación)
        prisma.classSession.findMany({
          where: {
            studioId: studio.id,
            date: { gte: start, lt: end },
            cancelledAt: null,
          },
          select: {
            capacityOverride: true,
            classType: { select: { defaultCapacity: true } },
          },
        }),
        // Reservas confirmadas del mes anterior (pagas)
        prisma.booking.count({
          where: {
            studioId: studio.id,
            status: 'CONFIRMED',
            userPackageId: { not: null },
            classSession: { date: { gte: start, lt: end } },
          },
        }),
        // Reservas en gracia del mes anterior (sin paquete asignado)
        prisma.booking.count({
          where: {
            studioId: studio.id,
            status: 'CONFIRMED',
            userPackageId: null,
            classSession: { date: { gte: start, lt: end } },
          },
        }),
        // Paquetes pagados activados el mes anterior
        prisma.userPackage.findMany({
          where: {
            studioId: studio.id,
            paymentStatus: 'APPROVED',
            paymentMethod: { not: 'ADMIN_GRANT' },
            activatedAt: { gte: start, lt: end },
          },
          select: { package: { select: { price: true } } },
        }),
        // Ausencias (no-shows) del mes anterior
        prisma.booking.count({
          where: {
            studioId: studio.id,
            attendanceStatus: 'NO_SHOW',
            classSession: { date: { gte: start, lt: end } },
          },
        }),
        // Cancelaciones de alumnas del mes anterior
        prisma.booking.count({
          where: {
            studioId: studio.id,
            status: 'CANCELLED',
            cancelledAt: { gte: start, lt: end },
          },
        }),
        // Alumnas activas sin ninguna reserva en el mes anterior
        prisma.user.count({
          where: {
            studioId: studio.id,
            role: 'STUDENT',
            active: true,
            bookings: {
              none: {
                status: 'CONFIRMED',
                classSession: { date: { gte: start, lt: end } },
              },
            },
          },
        }),
      ])

      const totalSessions = sessions.length
      const totalCapacity = sessions.reduce(
        (s, sess) => s + (sess.capacityOverride ?? sess.classType?.defaultCapacity ?? 10),
        0,
      )
      const avgOccupancyPct = totalCapacity > 0
        ? Math.round(((confirmedBookings + graceBookings) / totalCapacity) * 100)
        : 0

      if (!admin) {
        results.push({ studioId: studio.id, studioName: studio.name, sent: false, error: 'No admin found' })
        continue
      }

      const revenue = paidPackages.reduce((sum, p) => sum + (p.package?.price ?? 0), 0)

      await sendEmail(admin.email, 'resumen-mensual-admin', {
        adminName: admin.name ?? 'Admin',
        studioName: studio.name,
        month: label,
        activeStudents,
        newStudents,
        totalSessions,
        avgOccupancyPct,
        confirmedBookings,
        graceBookings,
        noShows,
        cancellations,
        studentsWithoutActivity,
        paidPackages: paidPackages.length,
        revenue: Math.round(revenue / 100), // centavos → pesos
      })

      results.push({ studioId: studio.id, studioName: studio.name, sent: true })
    } catch (err) {
      console.error(`[cron/monthly-summary] Error studio=${studio.id}:`, err)
      results.push({
        studioId: studio.id,
        studioName: studio.name,
        sent: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    month: label,
    studiosProcessed: studios.length,
    studiossent: results.filter((r) => r.sent).length,
    results,
  })
}
