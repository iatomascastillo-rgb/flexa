import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/**
 * Genera todas las fechas que coinciden con `dayIndex` (0=Dom…6=Sáb) desde hoy
 * hasta el último día del mes siguiente (timezone Argentina UTC-3).
 * Incluye hoy si hoy coincide con el día pedido.
 */
function getDatesUntilEndOfNextMonth(dayIndex: number): Date[] {
  const now = new Date()
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const arY = arNow.getUTCFullYear()
  const arM = arNow.getUTCMonth()
  const arD = arNow.getUTCDate()

  const nextMonth = (arM + 1) % 12
  const nextYear = arM === 11 ? arY + 1 : arY
  const daysInNextMonth = new Date(nextYear, nextMonth + 1, 0).getDate()
  const cutoff = new Date(Date.UTC(nextYear, nextMonth, daysInNextMonth))

  const dates: Date[] = []
  const cursor = new Date(Date.UTC(arY, arM, arD))
  while (cursor <= cutoff) {
    if (cursor.getUTCDay() === dayIndex) {
      dates.push(new Date(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    timeZone: 'UTC',
  })
}

// ── Server Actions ─────────────────────────────────────────────────────────────

async function addScheduleAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const dayIndex = parseInt(formData.get('dayIndex') as string, 10)
  const time = formData.get('time') as string

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!classTypeId || isNaN(dayIndex) || !time) return

  const dates = getDatesUntilEndOfNextMonth(dayIndex)
  const studioId = tenant.studioId

  // También crear el ClassScheduleTemplate para que el cron lo use en meses futuros
  const DOW_MAP = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const
  const dayOfWeek = DOW_MAP[dayIndex]
  await prisma.classScheduleTemplate.upsert({
    where: { studioId_classTypeId_dayOfWeek_time: { studioId, classTypeId, dayOfWeek: dayOfWeek as never, time } },
    update: { active: true },
    create: { studioId, classTypeId, dayOfWeek: dayOfWeek as never, time },
  })

  await prisma.classSession.createMany({
    data: dates.map((date) => ({ studioId, classTypeId, date, time })),
    skipDuplicates: true,
  })

  revalidatePath(`/${studio}/onboarding/3`)
}

async function continueStep3Action(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  redirect(`/${studio}/onboarding/4`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingStep3({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}/onboarding/3`)
  if (session.user.role !== 'STUDIO_ADMIN') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const studioId = tenant.studioId

  const [classTypes, upcomingSessions] = await Promise.all([
    prisma.classType.findMany({
      where: { studioId, active: true },
      select: { id: true, name: true },
    }),
    prisma.classSession.findMany({
      where: { studioId, date: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) }, cancelledAt: null },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 16,
      select: {
        id: true, date: true, time: true,
        classType: { select: { name: true } },
      },
    }),
  ])

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Horarios
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Agregá los días y horarios en que dictás tus clases. Se generan sesiones para las próximas 4 semanas.
      </p>

      {/* Sesiones ya generadas */}
      {upcomingSessions.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Sesiones generadas ({upcomingSessions.length})
          </p>
          <div className="space-y-1.5">
            {upcomingSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl px-4 py-2.5"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {s.classType.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {fmtDate(s.date)} · {s.time}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agregar horario */}
      <form action={addScheduleAction} className="mb-4">
        <input type="hidden" name="studio" value={studio} />
        <div
          className="space-y-3 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {upcomingSessions.length === 0 ? 'Agregar primer horario' : 'Agregar otro horario'}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Tipo de clase
            </label>
            <select
              name="classTypeId"
              required
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            >
              {classTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{ct.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Día de la semana
              </label>
              <select
                name="dayIndex"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              >
                {DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Horario
              </label>
              <input
                type="time"
                name="time"
                defaultValue="10:00"
                required
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            + Generar sesiones
          </button>
        </div>
      </form>

      {/* Continuar (puede saltearse) */}
      <form action={continueStep3Action}>
        <input type="hidden" name="studio" value={studio} />
        <button
          type="submit"
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {upcomingSessions.length === 0 ? 'Saltar por ahora →' : `Siguiente → (${upcomingSessions.length} sesiones)`}
        </button>
      </form>
    </div>
  )
}
