import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { todayARStart, fmtTime } from '@/lib/formatters'

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentARTimeMinutes(): number {
  const now = new Date()
  const arMs = now.getTime() + -3 * 60 * 60_000
  const ar = new Date(arMs)
  return ar.getUTCHours() * 60 + ar.getUTCMinutes()
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

type SessionStatus = 'past' | 'current' | 'next' | 'upcoming'

/** Clasifica cada sesión de hoy en relación a la hora actual */
function classifySession(time: string, nowMin: number, status: SessionStatus): SessionStatus {
  return status
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function InstructorHomePage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect(`/${studio}/login?callbackUrl=/${studio}/instructor`)
  if (session.user.role === 'STUDENT') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  const [studioData, today] = await Promise.all([
    prisma.studio.findUnique({
      where: { id: tenant.studioId },
      select: { name: true, branding: { select: { logoUrl: true } } },
    }),
    Promise.resolve(todayARStart()),
  ])

  const yesterday = new Date(today.getTime() - 86_400_000)
  const logoUrl = studioData?.branding?.logoUrl ?? null
  const studioName = studioData?.name ?? studio

  const sessions = await prisma.classSession.findMany({
    where: {
      studioId: tenant.studioId,
      cancelledAt: null,
      date: { gte: yesterday, lte: today },
    },
    include: {
      classType: { select: { name: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })

  const todaySessions = sessions.filter((s) => s.date.getTime() === today.getTime())
  const yesterdaySessions = sessions.filter((s) => s.date.getTime() === yesterday.getTime())

  // Classify today's sessions: past / current / next / upcoming
  const nowMin = currentARTimeMinutes()
  // "current" = first session that started within the last 90 min, or next upcoming if none
  const currentIdx = (() => {
    // Look for a session in progress (started in the last 90 min)
    const inProgress = todaySessions.findIndex(
      (s) => timeToMinutes(s.time) <= nowMin && nowMin - timeToMinutes(s.time) < 90,
    )
    if (inProgress !== -1) return inProgress
    // Otherwise: next upcoming session
    const next = todaySessions.findIndex((s) => timeToMinutes(s.time) > nowMin)
    if (next !== -1) return next
    // All done today: last session
    return todaySessions.length > 0 ? todaySessions.length - 1 : -1
  })()

  const todayWithStatus = todaySessions.map((s, i) => {
    let status: SessionStatus
    if (i < currentIdx) status = 'past'
    else if (i === currentIdx) status = 'current'
    else if (i === currentIdx + 1) status = 'next'
    else status = 'upcoming'
    return { ...s, status }
  })

  // Pending sessions: yesterday's + today's past (started >30 min ago) with unregistered students
  const pastIds = sessions
    .filter((s) => {
      const isYesterday = s.date.getTime() === yesterday.getTime()
      const isToday = s.date.getTime() === today.getTime()
      const sessionMin = timeToMinutes(s.time)
      return isYesterday || (isToday && sessionMin < nowMin - 30)
    })
    .map((s) => s.id)

  const pendingSessions: { id: string; name: string; time: string; unregistered: number }[] = []
  if (pastIds.length > 0) {
    const unregisteredBySession = await prisma.booking.groupBy({
      by: ['classSessionId'],
      where: {
        studioId: tenant.studioId,
        classSessionId: { in: pastIds },
        status: 'CONFIRMED',
        attendanceStatus: null,
      },
      _count: { id: true },
    })
    for (const row of unregisteredBySession) {
      const s = sessions.find((x) => x.id === row.classSessionId)
      if (s && row._count.id > 0) {
        pendingSessions.push({
          id: s.id,
          name: s.classType.name,
          time: fmtTime(s.time),
          unregistered: row._count.id,
        })
      }
    }
  }

  // Attendance counts
  const sessionIds = sessions.map((s) => s.id)
  const attendanceCounts = sessionIds.length > 0
    ? await prisma.booking.groupBy({
        by: ['classSessionId'],
        where: {
          studioId: tenant.studioId,
          classSessionId: { in: sessionIds },
          status: 'CONFIRMED',
          attendanceStatus: { not: null },
        },
        _count: { id: true },
      })
    : []
  const attendanceMap = new Map(attendanceCounts.map((a) => [a.classSessionId, a._count.id]))

  // Date strings
  const todayDay = today.toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'UTC' })
  const todayDate = today.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const yesterdayStr = yesterday.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })

  return (
    <div className="mx-auto max-w-md px-4 pb-24">
      {/* Studio header */}
      <div className="flex items-center gap-3 pt-6 pb-4">
        {logoUrl ? (
          <img src={logoUrl} alt={studioName} className="h-9 max-w-[3.5rem] object-contain" style={{ border: '1px solid #E8E0D6', borderRadius: 8, background: 'white', padding: 2 }} />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: 'var(--sage)' }}>
            {studioName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium" style={{ color: 'var(--stone)' }}>{studioName}</span>
      </div>

      {/* Date — prominent */}
      <div
        className="mb-5 rounded-2xl px-5 py-4"
        style={{ background: 'var(--sage)', color: 'white' }}
      >
        <p className="text-xs font-medium uppercase tracking-widest opacity-75">Hoy</p>
        <p
          className="mt-0.5 text-3xl font-light capitalize leading-tight"
          style={{ fontFamily: 'var(--font-cormorant, serif)' }}
        >
          {todayDay}
        </p>
        <p className="mt-0.5 text-sm capitalize opacity-80">{todayDate}</p>
      </div>

      {/* Pending banner */}
      {pendingSessions.length > 0 && (
        <div
          className="mb-4 rounded-2xl px-4 py-3"
          style={{ background: 'var(--terracotta-light)', border: '1px solid var(--terracotta)' }}
        >
          <div className="mb-2 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--terracotta)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: 'var(--terracotta)' }}>
              {pendingSessions.length === 1
                ? '1 clase con asistencia pendiente'
                : `${pendingSessions.length} clases con asistencia pendiente`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {pendingSessions.map((p) => (
              <Link
                key={p.id}
                href={`/${studio}/instructor/${p.id}`}
                className="flex items-center justify-between rounded-xl px-3 py-2 transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {p.name} · {p.time}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--terracotta)' }}>
                  {p.unregistered} sin registrar →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today sessions */}
      {todaySessions.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--stone)' }}>
          No hay clases hoy
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {todayWithStatus.map((s) => {
            const total = s._count.bookings
            const done = attendanceMap.get(s.id) ?? 0
            return (
              <SessionCard
                key={s.id}
                href={`/${studio}/instructor/${s.id}`}
                name={s.classType.name}
                time={fmtTime(s.time)}
                total={total}
                done={done}
                status={s.status}
              />
            )
          })}
        </div>
      )}

      {/* Yesterday */}
      {yesterdaySessions.length > 0 && (
        <>
          <div
            className="mb-3 flex items-center gap-3 border-t pt-5"
            style={{ borderColor: '#E8E0D6' }}
          >
            <p className="text-xs font-medium uppercase tracking-widest capitalize" style={{ color: 'var(--stone)' }}>
              Ayer · {yesterdayStr}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {yesterdaySessions.map((s) => {
              const total = s._count.bookings
              const done = attendanceMap.get(s.id) ?? 0
              return (
                <SessionCard
                  key={s.id}
                  href={`/${studio}/instructor/${s.id}`}
                  name={s.classType.name}
                  time={fmtTime(s.time)}
                  total={total}
                  done={done}
                  status="past"
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── SessionCard ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SessionStatus,
  { border: string; bg: string; dot: string; badge: string | null; badgeBg: string; badgeColor: string; opacity: number }
> = {
  past: {
    border: '1px solid #E8E0D6',
    bg: '#FAFAF9',
    dot: '#D0CBC4',
    badge: null,
    badgeBg: '',
    badgeColor: '',
    opacity: 0.65,
  },
  current: {
    border: '2px solid var(--sage)',
    bg: 'white',
    dot: 'var(--sage)',
    badge: 'AHORA',
    badgeBg: 'var(--sage)',
    badgeColor: 'white',
    opacity: 1,
  },
  next: {
    border: '1px dashed var(--sage)',
    bg: 'white',
    dot: 'var(--sage)',
    badge: 'PRÓXIMA',
    badgeBg: '#EDF4ED',
    badgeColor: 'var(--sage)',
    opacity: 1,
  },
  upcoming: {
    border: '1px solid #E8E0D6',
    bg: 'white',
    dot: '#C0BAB4',
    badge: null,
    badgeBg: '',
    badgeColor: '',
    opacity: 1,
  },
}

function SessionCard({
  href,
  name,
  time,
  total,
  done,
  status,
}: {
  href: string
  name: string
  time: string
  total: number
  done: number
  status: SessionStatus
}) {
  const cfg = STATUS_CONFIG[status]
  const complete = total > 0 && done === total
  const isPast = status === 'past'

  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
      style={{
        background: cfg.bg,
        border: cfg.border,
        opacity: cfg.opacity,
        textDecoration: 'none',
      }}
    >
      <div className="flex items-center gap-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cfg.dot }} />
        <div>
          <p className="text-sm font-medium" style={{ color: isPast ? 'var(--stone)' : 'var(--ink)' }}>
            {name}
          </p>
          <p className="text-xs" style={{ color: 'var(--stone)' }}>
            {total === 0 ? 'Sin inscriptos' : `${total} alumno${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {cfg.badge && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
          >
            {cfg.badge}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-medium" style={{ color: isPast ? 'var(--stone)' : 'var(--ink)' }}>
            {time}
          </p>
          <p
            className="text-xs"
            style={{
              color: complete
                ? 'var(--sage)'
                : done > 0
                  ? 'var(--terracotta)'
                  : '#C0BAB4',
            }}
          >
            {total === 0 ? '—' : complete ? '✓ Listo' : done > 0 ? `${done}/${total}` : 'Pendiente'}
          </p>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: '#C4B8AC' }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </Link>
  )
}
