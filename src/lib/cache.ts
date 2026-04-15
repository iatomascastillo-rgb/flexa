import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'

/**
 * Tipos de clase activos del estudio — cambian raramente, cache de 1h.
 * Solo para uso en páginas de UI. El cron usa Prisma directo.
 */
export function getActiveClassTypes(studioId: string) {
  return unstable_cache(
    async () =>
      prisma.classType.findMany({
        where: { studioId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    [`class-types-${studioId}`],
    { revalidate: 3600 },
  )()
}

/**
 * Settings del estudio — cambian raramente, cache de 1 hora.
 * Invalidar con: revalidateTag(`settings-${studioId}`)
 */
export function getStudioSettings(studioId: string) {
  return unstable_cache(
    async () =>
      prisma.studioSettings.findUnique({
        where: { studioId },
        select: {
          cancellationHours: true,
          bookingWindowHours: true,
          allowWaitlist: true,
          lateCancellationPolicy: true,
          noShowPolicy: true,
          gracePeriodEnabled: true,
          gracePeriodCutoffDay: true,
          graceRequiresHistory: true,
          graceOnNoPay: true,
          waitlistAutoPromote: true,
        },
      }),
    [`settings-${studioId}`],
    { revalidate: 3600, tags: [`settings-${studioId}`] },
  )()
}

/**
 * Métricas mensuales del admin dashboard — cache de 1 hora.
 * No incluye datos que dependen de "hoy" (sesiones del día, no-shows).
 * Invalidar con: revalidateTag(`admin-metrics-${studioId}`)
 */
export function getMonthlyAdminMetrics(
  studioId: string,
  monthStart: Date,
  prevMonthStart: Date,
  historyStart: Date,
) {
  const monthKey = `${monthStart.getUTCFullYear()}-${monthStart.getUTCMonth()}`
  return unstable_cache(
    async () => {
      const now = new Date()
      const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const [
        monthlyPackages,
        prevMonthPackages,
        newStudentsCount,
        totalActiveStudents,
        activeWithBookingsThisMonth,
        monthCancellations,
        atRiskStudents,
        expiringPackages,
        revenueHistoryPackages,
        monthAttendances,
        newStudentsHistoryRaw,
        monthCancellationsDetail,
        monthNoShowsDetail,
      ] = await Promise.all([
        // Paquetes aprobados este mes (ingresos)
        prisma.userPackage.findMany({
          where: {
            studioId,
            paymentStatus: 'APPROVED',
            activatedAt: { gte: monthStart },
            packageId: { not: null },
          },
          select: { package: { select: { price: true } }, paymentMethod: true },
        }),

        // Paquetes aprobados mes anterior (comparación)
        prisma.userPackage.findMany({
          where: {
            studioId,
            paymentStatus: 'APPROVED',
            activatedAt: { gte: prevMonthStart, lt: monthStart },
            packageId: { not: null },
          },
          select: { package: { select: { price: true } } },
        }),

        // Alumnos nuevos este mes
        prisma.user.count({
          where: { studioId, role: 'STUDENT', createdAt: { gte: monthStart } },
        }),

        // Total alumnos activos
        prisma.user.count({ where: { studioId, role: 'STUDENT', active: true } }),

        // Alumnos activos con al menos 1 reserva este mes
        prisma.user.count({
          where: {
            studioId,
            role: 'STUDENT',
            active: true,
            bookings: {
              some: { status: 'CONFIRMED', classSession: { date: { gte: monthStart } } },
            },
          },
        }),

        // Cancelaciones del mes
        prisma.booking.count({
          where: { studioId, status: 'CANCELLED', cancelledAt: { gte: monthStart } },
        }),

        // Alumnos en riesgo: activos, con historial, sin reserva en 21 días (incluye última reserva)
        prisma.user.findMany({
          where: {
            studioId,
            role: 'STUDENT',
            active: true,
            bookings: {
              none: { status: 'CONFIRMED', classSession: { date: { gte: twentyOneDaysAgo } } },
              some: { status: 'CONFIRMED' },
            },
          },
          select: {
            id: true,
            name: true,
            bookings: {
              where: { status: 'CONFIRMED' },
              orderBy: { classSession: { date: 'desc' } },
              take: 1,
              select: { classSession: { select: { date: true } } },
            },
          },
          orderBy: { name: 'asc' },
          take: 20,
        }),

        // Paquetes con créditos que vencen en los próximos 7 días
        prisma.userPackage.findMany({
          where: {
            studioId,
            paymentStatus: 'APPROVED',
            classesRemaining: { gt: 0 },
            expiresAt: { gte: now, lte: sevenDaysFromNow },
          },
          select: {
            expiresAt: true,
            classesRemaining: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { expiresAt: 'asc' },
        }),

        // Ingresos históricos para tendencia de 6 meses
        prisma.userPackage.findMany({
          where: {
            studioId,
            paymentStatus: 'APPROVED',
            activatedAt: { gte: historyStart, lt: monthStart },
            packageId: { not: null },
          },
          select: { package: { select: { price: true } }, activatedAt: true },
        }),

        // Asistencias del mes (para top alumnos)
        prisma.booking.findMany({
          where: {
            studioId,
            attendanceStatus: 'ATTENDED',
            classSession: { date: { gte: monthStart } },
          },
          select: { userId: true, user: { select: { name: true } } },
        }),

        // Alumnas nuevas historial (para tendencia 6 meses)
        prisma.user.findMany({
          where: { studioId, role: 'STUDENT', createdAt: { gte: historyStart } },
          select: { createdAt: true },
        }),

        // Cancelaciones del mes con alumna (para detalle)
        prisma.booking.findMany({
          where: { studioId, status: 'CANCELLED', cancelledAt: { gte: monthStart } },
          select: { userId: true, user: { select: { id: true, name: true } } },
        }),

        // No-shows del mes con alumna (para detalle)
        prisma.booking.findMany({
          where: { studioId, attendanceStatus: 'NO_SHOW', classSession: { date: { gte: monthStart } } },
          select: { userId: true, user: { select: { id: true, name: true } } },
        }),
      ])

      // Top 5 alumnos por asistencias este mes
      const userCounts = new Map<string, { name: string; count: number }>()
      for (const b of monthAttendances) {
        const entry = userCounts.get(b.userId)
        if (entry) entry.count++
        else userCounts.set(b.userId, { name: b.user.name ?? '?', count: 1 })
      }
      const topStudentsThisMonth = [...userCounts.entries()]
        .map(([userId, data]) => ({ userId, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Top 5 cancellers del mes
      const cancelMap = new Map<string, { id: string; name: string; count: number }>()
      for (const b of monthCancellationsDetail) {
        const e = cancelMap.get(b.userId)
        if (e) e.count++
        else cancelMap.set(b.userId, { id: b.user.id, name: b.user.name ?? '?', count: 1 })
      }
      const topCancellersMonth = [...cancelMap.values()].sort((a, b) => b.count - a.count).slice(0, 5)

      // Top 5 no-showers del mes
      const noShowMap = new Map<string, { id: string; name: string; count: number }>()
      for (const b of monthNoShowsDetail) {
        const e = noShowMap.get(b.userId)
        if (e) e.count++
        else noShowMap.set(b.userId, { id: b.user.id, name: b.user.name ?? '?', count: 1 })
      }
      const topNoShowsMonth = [...noShowMap.values()].sort((a, b) => b.count - a.count).slice(0, 5)

      return {
        monthlyPackages,
        prevMonthPackages,
        newStudentsCount,
        totalActiveStudents,
        activeWithBookingsThisMonth,
        monthCancellations,
        atRiskStudents,
        expiringPackages,
        revenueHistoryPackages,
        topStudentsThisMonth,
        newStudentsHistory: newStudentsHistoryRaw.map(u => u.createdAt),
        topCancellersMonth,
        topNoShowsMonth,
      }
    },
    [`admin-metrics-${studioId}-${monthKey}`],
    { revalidate: 3600, tags: [`admin-metrics-${studioId}`] },
  )()
}
