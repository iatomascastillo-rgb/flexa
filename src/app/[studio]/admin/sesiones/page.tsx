import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDateHeader(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
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
      <div className="mb-6 flex items-center gap-4">
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
          className="rounded-2xl p-8 text-center"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          <p className="text-sm">No hay sesiones para este período.</p>
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
    </div>
  )
}
