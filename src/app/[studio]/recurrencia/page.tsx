export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import RecurringManager from './RecurringManager'

export default async function RecurrenciaPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  // Instructores no usan recurrencias
  if (session.user.role === 'INSTRUCTOR') redirect(`/${studio}`)

  // Calcular rango: desde hoy hasta fin del próximo mes (cubre mes actual + siguiente)
  // Si el cron aún no generó sesiones para el mes siguiente, usamos las del mes actual
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const startOfMonthAfterNext = new Date(Date.UTC(nextYear, nextMonth + 1, 1))

  const [schedules, classTypes, sessionSlots] = await Promise.all([
    // Schedules activos del usuario
    prisma.recurringSchedule.findMany({
      where: { studioId: tenant.studioId, userId: session.user.id, active: true },
      include: { classType: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    // Tipos de clase disponibles
    prisma.classType.findMany({
      where: { studioId: tenant.studioId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // Horarios reales: mes actual + próximo mes como fallback si el cron no corrió aún
    // Sin distinct para evitar problemas con Prisma+Postgres — el cliente deduplica con Set
    prisma.classSession.findMany({
      where: {
        studioId: tenant.studioId,
        cancelledAt: null,
        date: { gte: today, lt: startOfMonthAfterNext },
      },
      select: { classTypeId: true, time: true },
      orderBy: { time: 'asc' },
    }),
  ])

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Recurrencia
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--stone)' }}>
        Reservá automáticamente tus clases favoritas cada semana
      </p>

      {/* Explicación */}
      <div
        className="mb-6 rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: '#EDF4ED' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>¿Cómo funciona?</p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>Clases fijas cada semana</p>
          </div>
        </div>
        <ul className="space-y-2">
          {[
            'Elegís el tipo de clase, el día y el horario',
            'El sistema te reserva automáticamente al inicio de cada mes',
            'Si no tenés créditos al momento de la reserva, se avisa al estudio',
            'Podés eliminar la recurrencia en cualquier momento',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--stone)' }}>
              <span className="mt-0.5 text-xs font-bold" style={{ color: 'var(--sage)' }}>
                {i + 1}.
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Manager interactivo */}
      <RecurringManager
        studio={studio}
        schedules={schedules}
        classTypes={classTypes}
        availableSlots={sessionSlots}
      />
    </div>
  )
}
