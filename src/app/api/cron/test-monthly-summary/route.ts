export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { auth } from '@/lib/auth'

// ── GET /api/cron/test-monthly-summary?slug=centro-pilates&to=email@example.com
//
// SUPER_ADMIN (sesión) o CRON_SECRET (header Authorization: Bearer ...).
// Usa el mes ACTUAL para tener datos reales en el test.

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isCronSecret = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
  if (!isCronSecret) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const slug = req.nextUrl.searchParams.get('slug')
  const to = req.nextUrl.searchParams.get('to')

  if (!slug || !to) {
    return NextResponse.json({ error: 'Parámetros requeridos: slug, to' }, { status: 400 })
  }

  const studio = await prisma.studio.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!studio) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }

  // Para el test: usar el mes ACTUAL como rango (para tener datos reales)
  const now = new Date()
  const ar = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const year = ar.getUTCFullYear()
  const month = ar.getUTCMonth() // 0-indexed, mes actual

  const start = new Date(Date.UTC(year, month, 1, 3, 0, 0))
  const end = new Date(Date.UTC(year, month + 1, 1, 3, 0, 0))

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const label = `${MESES[month]} ${year} (test)`

  const [
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
    prisma.user.count({
      where: { studioId: studio.id, role: 'STUDENT', active: true },
    }),
    prisma.user.count({
      where: {
        studioId: studio.id,
        role: 'STUDENT',
        createdAt: { gte: start, lt: end },
      },
    }),
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
    prisma.booking.count({
      where: {
        studioId: studio.id,
        status: 'CONFIRMED',
        userPackageId: { not: null },
        classSession: { date: { gte: start, lt: end } },
      },
    }),
    prisma.booking.count({
      where: {
        studioId: studio.id,
        status: 'CONFIRMED',
        userPackageId: null,
        classSession: { date: { gte: start, lt: end } },
      },
    }),
    prisma.userPackage.findMany({
      where: {
        studioId: studio.id,
        paymentStatus: 'APPROVED',
        paymentMethod: { not: 'ADMIN_GRANT' },
        activatedAt: { gte: start, lt: end },
      },
      select: { package: { select: { price: true } } },
    }),
    prisma.booking.count({
      where: {
        studioId: studio.id,
        attendanceStatus: 'NO_SHOW',
        classSession: { date: { gte: start, lt: end } },
      },
    }),
    prisma.booking.count({
      where: {
        studioId: studio.id,
        status: 'CANCELLED',
        cancelledAt: { gte: start, lt: end },
      },
    }),
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

  const revenue = paidPackages.reduce((sum, p) => sum + (p.package?.price ?? 0), 0)

  const result = await sendEmail(to, 'resumen-mensual-admin', {
    adminName: 'Admin (test)',
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
    revenue: Math.round(revenue / 100),
  })

  return NextResponse.json({
    ok: result.success,
    sentTo: to,
    studio: studio.name,
    month: label,
    data: { activeStudents, newStudents, totalSessions, avgOccupancyPct, confirmedBookings, graceBookings, noShows, cancellations, studentsWithoutActivity, paidPackages: paidPackages.length, revenue: Math.round(revenue / 100) },
    emailResult: result,
  })
}
