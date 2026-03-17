import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function createSessionAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const dateStr = formData.get('date') as string   // "YYYY-MM-DD"
  const time = formData.get('time') as string      // "HH:mm"

  if (!classTypeId || !dateStr || !time) return

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || session.user.studioId !== tenant.studioId) return

  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))

  await prisma.classSession.upsert({
    where: { studioId_date_time_classTypeId: { studioId: tenant.studioId, date, time, classTypeId } },
    update: {},
    create: { studioId: tenant.studioId, classTypeId, date, time },
  })

  revalidatePath(`/${studio}/admin/sesiones`)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateHeader(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function fmtTime(time: string): string {
  const [h, m] = time.split(':')
  return `${parseInt(h)}:${m}`
}

function isToday(date: Date): boolean {
  const now = new Date()
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminSesionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ rango?: string }>
}) {
  const { studio } = await params
  const { rango = 'semana' } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const studioId = tenant.studioId
  const now = new Date()
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Rango: hoy | semana (7 días) | mes (30 días)
  const rangeDays: Record<string, number> = { hoy: 1, semana: 7, mes: 30 }
  const days = rangeDays[rango] ?? 7
  const rangeEnd = new Date(todayStart.getTime() + days * 24 * 60 * 60 * 1000)

  // ── Fetch classTypes y sesiones ────────────────────────────────────────────
  const classTypes = await prisma.classType.findMany({
    where: { studioId, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  // ── Fetch sesiones ─────────────────────────────────────────────────────────
  const rawSessions = await prisma.classSession.findMany({
    where: {
      studioId,
      date: { gte: todayStart, lt: rangeEnd },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
    select: {
      id: true,
      date: true,
      time: true,
      cancelledAt: true,
      capacityOverride: true,
      classType: { select: { name: true, defaultCapacity: true } },
      bookings: {
        where: { status: { in: ['CONFIRMED', 'WAITLIST'] } },
        select: { status: true, attendanceStatus: true },
      },
    },
  })

  const sessions = rawSessions.map((s) => {
    const confirmed = s.bookings.filter((b) => b.status === 'CONFIRMED').length
    const waitlist = s.bookings.filter((b) => b.status === 'WAITLIST').length
    const attended = s.bookings.filter((b) => b.attendanceStatus === 'ATTENDED').length
    const capacity = s.capacityOverride ?? s.classType.defaultCapacity
    return { ...s, confirmed, waitlist, attended, capacity }
  })

  // ── Agrupar por fecha ──────────────────────────────────────────────────────
  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const key = s.date.toISOString().split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  const dateKeys = Object.keys(grouped).sort()

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/${studio}/perfil`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'white', color: 'var(--ink)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1
            className="text-3xl font-light"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Sesiones
          </h1>
        </div>
        <Link
          href={`/${studio}/admin/clases`}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" /><path d="M5 12h14" />
          </svg>
          Agregar horarios
        </Link>
      </div>

      {/* Filtro de rango */}
      <div className="mb-5 flex gap-2">
        {(['hoy', 'semana', 'mes'] as const).map((r) => (
          <Link
            key={r}
            href={`/${studio}/admin/sesiones?rango=${r}`}
            className="rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-opacity hover:opacity-80"
            style={
              rango === r
                ? { background: 'var(--sage)', color: 'white' }
                : { background: 'white', color: 'var(--stone)', border: '1px solid #E8E0D6' }
            }
          >
            {r === 'hoy' ? 'Hoy' : r === 'semana' ? '7 días' : '30 días'}
          </Link>
        ))}
      </div>

      {/* Sin sesiones */}
      {dateKeys.length === 0 && (
        <div
          className="rounded-2xl px-5 py-8 text-center"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-4 text-sm" style={{ color: 'var(--stone)' }}>No hay sesiones para este período.</p>
          <Link
            href={`/${studio}/admin/clases`}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" /><path d="M5 12h14" />
            </svg>
            Agregar horarios
          </Link>
        </div>
      )}

      {/* Lista agrupada por fecha */}
      <div className="space-y-6">
        {dateKeys.map((key) => {
          const daySessions = grouped[key]
          const todayFlag = isToday(daySessions[0].date)
          return (
            <div key={key}>
              <p
                className="mb-2 text-xs font-medium uppercase tracking-widest capitalize"
                style={{ color: todayFlag ? 'var(--sage)' : 'var(--stone)' }}
              >
                {todayFlag ? 'Hoy · ' : ''}{fmtDateHeader(daySessions[0].date)}
              </p>

              <div className="space-y-2">
                {daySessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/${studio}/admin/sesiones/${s.id}`}
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
                    style={{
                      background: 'white',
                      border: s.cancelledAt ? '1px solid #E8E0D6' : '1px solid #E8E0D6',
                      opacity: s.cancelledAt ? 0.5 : 1,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className="text-2xl font-light tabular-nums"
                        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)', minWidth: '3rem' }}
                      >
                        {fmtTime(s.time)}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                          {s.classType.name}
                          {s.cancelledAt && (
                            <span
                              className="ml-2 rounded-full px-1.5 py-0.5 text-xs font-normal"
                              style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                            >
                              Cancelada
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                          {s.confirmed}/{s.capacity} reservadas
                          {s.waitlist > 0 && ` · ${s.waitlist} en lista`}
                          {s.attended > 0 && ` · ${s.attended} asistieron`}
                        </p>
                      </div>
                    </div>

                    {/* Ocupación visual */}
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="w-16">
                        <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#E8E0D6' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.round((s.confirmed / s.capacity) * 100))}%`,
                              background: s.confirmed >= s.capacity ? 'var(--terracotta)' : 'var(--sage)',
                            }}
                          />
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#C4B8AC' }}>
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Crear sesión puntual ── */}
      {classTypes.length > 0 && (
        <div className="mt-8 mb-24 rounded-2xl p-5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>Crear sesión puntual</p>
          <form action={createSessionAction} className="space-y-3">
            <input type="hidden" name="studio" value={studio} />
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Tipo de clase</label>
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
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Fecha</label>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={todayStart.toISOString().slice(0, 10)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Horario</label>
                <input
                  type="time"
                  name="time"
                  required
                  defaultValue="10:00"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              Crear sesión
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
