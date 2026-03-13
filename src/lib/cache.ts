import { unstable_cache } from 'next/cache'
import { prisma } from './prisma'

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
) {
  const monthKey = `${monthStart.getUTCFullYear()}-${monthStart.getUTCMonth()}`
  return unstable_cache(
    async () => {
      const [
        monthlyPackages,
        prevMonthPackages,
        newStudentsCount,
        totalActiveStudents,
        activeWithBookingsThisMonth,
        monthCancellations,
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
      ])

      return {
        monthlyPackages,
        prevMonthPackages,
        newStudentsCount,
        totalActiveStudents,
        activeWithBookingsThisMonth,
        monthCancellations,
      }
    },
    [`admin-metrics-${studioId}-${monthKey}`],
    { revalidate: 3600, tags: [`admin-metrics-${studioId}`] },
  )()
}
