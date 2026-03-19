import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getMonthlyAdminMetrics } from '@/lib/cache'
import { InsightCard } from '@/components/InsightCard'
import { fmtTime, fmtARS, todayARStart } from '@/lib/formatters'

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ studio }, sp] = await Promise.all([params, searchParams])
  const tab = sp.tab === 'mensual' ? 'mensual' : sp.tab === 'ia' ? 'ia' : 'dia'

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}/admin`)
  if (session.user.role === 'SUPER_ADMIN') redirect('/superadmin')
  if (session.user.role !== 'STUDIO_ADMIN') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect(`/login?callbackUrl=/${studio}/admin`)

  const studioId = tenant.studioId
  const todayStart = todayARStart()
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))

  // ── Queries dinámicas (tiempo real) + métricas mensuales (cache 1h) ──────
  const [
    [todaySessions, pendingPaymentPackages, studentsWithoutPackageCount, monthSessions, monthNoShows],
    { monthlyPackages, prevMonthPackages, newStudentsCount, totalActiveStudents, activeWithBookingsThisMonth, monthCancellations },
  ] = await Promise.all([
    Promise.all([
      // Sesiones de hoy con asistencia
      prisma.classSession.findMany({
        where: { studioId, date: { gte: todayStart, lt: tomorrowStart }, cancelledAt: null },
        orderBy: { time: 'asc' },
        select: {
          id: true,
          time: true,
          capacityOverride: true,
          classType: { select: { name: true, defaultCapacity: true } },
          bookings: {
            where: { status: { in: ['CONFIRMED', 'WAITLIST'] } },
            select: {
              status: true,
              attendanceStatus: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // Paquetes pendientes de confirmación manual
      prisma.userPackage.findMany({
        where: { studioId, paymentStatus: 'PENDING', paymentMethod: { in: ['TRANSFER', 'CASH'] } },
        select: {
          id: true,
          classesTotal: true,
          paymentMethod: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          package: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),

      // Alumnos sin paquete activo
      prisma.user.count({
        where: {
          studioId,
          role: 'STUDENT',
          active: true,
          userPackages: {
            none: { paymentStatus: 'APPROVED', classesRemaining: { gt: 0 }, expiresAt: { gte: now } },
          },
        },
      }),

      // Sesiones del mes (ocupación + horarios populares)
      prisma.classSession.findMany({
        where: { studioId, date: { gte: monthStart, lt: tomorrowStart }, cancelledAt: null },
        select: {
          date: true,
          time: true,
          capacityOverride: true,
          classType: { select: { defaultCapacity: true } },
          bookings: { where: { status: 'CONFIRMED' }, select: { id: true } },
        },
      }),

      // Ausencias del mes
      prisma.booking.count({
        where: {
          studioId,
          attendanceStatus: 'NO_SHOW',
          classSession: { date: { gte: monthStart, lt: tomorrowStart } },
        },
      }),
    ]),

    // Métricas mensuales cacheadas 1 hora
    getMonthlyAdminMetrics(studioId, monthStart, prevMonthStart),
  ])

  // ── Cómputos del día ──────────────────────────────────────────────────────
  const todayWithCounts = todaySessions.map((s) => ({
    ...s,
    confirmed: s.bookings.filter((b) => b.status === 'CONFIRMED').length,
    waitlist: s.bookings.filter((b) => b.status === 'WAITLIST').length,
    capacity: s.capacityOverride ?? s.classType.defaultCapacity,
    noShow: s.bookings.filter((b) => b.attendanceStatus === 'NO_SHOW').length,
    noShowStudents: s.bookings
      .filter((b) => b.attendanceStatus === 'NO_SHOW')
      .map((b) => b.user),
  }))

  const totalClassesToday = todayWithCounts.length
  const totalConfirmedToday = todayWithCounts.reduce((sum, s) => sum + s.confirmed, 0)
  const totalCapacityToday = todayWithCounts.reduce((sum, s) => sum + s.capacity, 0)
  const freeSpaceToday = totalCapacityToday - totalConfirmedToday
  const avgOccupancyToday =
    totalCapacityToday > 0
      ? Math.round((totalConfirmedToday / totalCapacityToday) * 100)
      : 0
  const fullClassesToday = todayWithCounts.filter((s) => s.confirmed >= s.capacity).length
  const lowOccupancyToday = todayWithCounts.filter(
    (s) => s.capacity > 0 && s.confirmed / s.capacity < 0.5
  ).length
  const totalNoShowToday = todayWithCounts.reduce((sum, s) => sum + s.noShow, 0)
  const noShowStudentsToday = todayWithCounts.flatMap((s) => s.noShowStudents)

  // ── Cómputos mensuales ────────────────────────────────────────────────────
  const ingresosDelMes =
    monthlyPackages.reduce((sum, p) => sum + (p.package?.price ?? 0), 0) / 100
  const ingresosMesAnterior =
    prevMonthPackages.reduce((sum, p) => sum + (p.package?.price ?? 0), 0) / 100

  const ingresosEfectivo =
    monthlyPackages
      .filter((p) => p.paymentMethod === 'CASH' || p.paymentMethod === 'TRANSFER')
      .reduce((sum, p) => sum + (p.package?.price ?? 0), 0) / 100
  const ingresosMP =
    monthlyPackages
      .filter((p) => p.paymentMethod === 'MERCADOPAGO')
      .reduce((sum, p) => sum + (p.package?.price ?? 0), 0) / 100

  const variacionIngresos =
    ingresosMesAnterior > 0
      ? Math.round(((ingresosDelMes - ingresosMesAnterior) / ingresosMesAnterior) * 100)
      : null

  const sinActividad = totalActiveStudents - activeWithBookingsThisMonth

  // Ocupación promedio mensual
  const avgOccupancyMonth =
    monthSessions.length > 0
      ? Math.round(
          (monthSessions.reduce((sum, s) => {
            const cap = s.capacityOverride ?? s.classType.defaultCapacity
            return sum + s.bookings.length / Math.max(cap, 1)
          }, 0) /
            monthSessions.length) *
            100
        )
      : 0

  // Horarios más populares (agrupado por día + hora)
  const dtMap = new Map<string, number>()
  for (const s of monthSessions) {
    const day = DAYS[new Date(s.date).getUTCDay()]
    const key = `${day} ${fmtTime(s.time)}`
    dtMap.set(key, (dtMap.get(key) ?? 0) + s.bookings.length)
  }
  const popularTimes = [...dtMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const nowLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  // ── Tab styles ─────────────────────────────────────────────────────────────
  const activeTab: React.CSSProperties = {
    color: 'var(--ink)',
    borderBottom: '2px solid var(--sage)',
    fontWeight: 500,
  }
  const inactiveTab: React.CSSProperties = {
    color: 'var(--stone)',
    borderBottom: '2px solid transparent',
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-5">
        <h1
          className="text-3xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Panel Admin
        </h1>
        <p className="mt-0.5 text-xs capitalize" style={{ color: 'var(--stone)' }}>
          {nowLabel}
        </p>
      </div>

      {/* Tab switcher */}
      <div
        className="mb-6 flex gap-6 border-b"
        style={{ borderColor: '#E8E0D6' }}
      >
        <Link
          href={`/${studio}/admin`}
          className="pb-2 text-sm transition-colors"
          style={tab === 'dia' ? activeTab : inactiveTab}
        >
          Dashboard del día
        </Link>
        <Link
          href={`/${studio}/admin?tab=mensual`}
          className="pb-2 text-sm transition-colors"
          style={tab === 'mensual' ? activeTab : inactiveTab}
        >
          Resumen mensual
        </Link>
        <Link
          href={`/${studio}/admin?tab=ia`}
          className="pb-2 text-sm transition-colors"
          style={tab === 'ia' ? activeTab : inactiveTab}
        >
          IA
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: DASHBOARD DEL DÍA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'dia' && (
        <>
          {/* ── Ocupación del día ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Ocupación del día
            </p>

            {totalClassesToday === 0 ? (
              <div
                className="rounded-2xl px-5 py-6 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p className="text-sm" style={{ color: 'var(--stone)' }}>No hay clases programadas para hoy.</p>
              </div>
            ) : (
              <>
                {/* Métricas resumen */}
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: 'white', border: '1px solid #E8E0D6' }}
                  >
                    <p
                      className="text-3xl font-light"
                      style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
                    >
                      {totalClassesToday}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                      Clases programadas
                    </p>
                  </div>
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: 'white', border: '1px solid #E8E0D6' }}
                  >
                    <p
                      className="text-3xl font-light"
                      style={{
                        fontFamily: 'var(--font-cormorant, serif)',
                        color: avgOccupancyToday >= 80 ? 'var(--sage)' : avgOccupancyToday >= 50 ? 'var(--ink)' : 'var(--terracotta)',
                      }}
                    >
                      {avgOccupancyToday}%
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                      Ocupación promedio
                    </p>
                  </div>
                </div>

                {/* Tags de estado */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {fullClassesToday > 0 && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                    >
                      {fullClassesToday} llena{fullClassesToday !== 1 ? 's' : ''}
                    </span>
                  )}
                  {lowOccupancyToday > 0 && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: '#FEF3C7', color: '#D97706' }}
                    >
                      {lowOccupancyToday} con &lt;50%
                    </span>
                  )}
                  {freeSpaceToday > 0 && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}
                    >
                      {freeSpaceToday} cupos libres
                    </span>
                  )}
                  {totalNoShowToday > 0 && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: '#FEE2E2', color: '#DC2626' }}
                    >
                      {totalNoShowToday} ausente{totalNoShowToday !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Lista de clases */}
                <div className="space-y-2">
                  {todayWithCounts.map((s) => {
                    const full = s.confirmed >= s.capacity
                    const pct = s.capacity > 0 ? Math.round((s.confirmed / s.capacity) * 100) : 0
                    return (
                      <Link
                        key={s.id}
                        href={`/${studio}/admin/sesiones/${s.id}`}
                        className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
                        style={{ background: 'white', border: '1px solid #E8E0D6' }}
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className="text-xl font-light tabular-nums"
                            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)', minWidth: '2.8rem' }}
                          >
                            {fmtTime(s.time)}
                          </span>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                              {s.classType.name}
                            </p>
                            <p className="mt-0.5 text-xs" style={{ color: full ? 'var(--terracotta)' : 'var(--stone)' }}>
                              {s.confirmed}/{s.capacity}
                              {s.waitlist > 0 && ` · ${s.waitlist} en lista`}
                              {s.noShow > 0 && ` · ${s.noShow} ausente${s.noShow !== 1 ? 's' : ''}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-14">
                            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#E8E0D6' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  background: full ? 'var(--terracotta)' : 'var(--sage)',
                                }}
                              />
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#C4B8AC' }}>
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {/* ── Alumnos ausentes hoy ── */}
          {noShowStudentsToday.length > 0 && (
            <section className="mb-5">
              <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                Alumnos que faltaron hoy
              </p>
              <div
                className="rounded-2xl px-5 py-4"
                style={{ background: 'white', border: '1px solid #FECACA' }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {totalConfirmedToday} reservas · {totalNoShowToday} ausente{totalNoShowToday !== 1 ? 's' : ''}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: '#FEE2E2', color: '#DC2626' }}
                  >
                    {totalConfirmedToday > 0 ? Math.round((totalNoShowToday / totalConfirmedToday) * 100) : 0}% ausentismo
                  </span>
                </div>
                <div className="space-y-1.5">
                  {noShowStudentsToday.map((u) => (
                    <Link
                      key={u.id}
                      href={`/${studio}/admin/students/${u.id}`}
                      className="flex items-center justify-between py-1 transition-opacity hover:opacity-70"
                    >
                      <span className="text-sm" style={{ color: 'var(--ink)' }}>{u.name}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#C4B8AC' }}>
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── Pagos pendientes ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Pagos pendientes
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: studentsWithoutPackageCount > 0 ? 'var(--terracotta)' : 'var(--ink)',
                  }}
                >
                  {studentsWithoutPackageCount}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Sin paquete activo</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: pendingPaymentPackages.length > 0 ? '#D97706' : 'var(--ink)',
                  }}
                >
                  {pendingPaymentPackages.length}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Pago por confirmar</p>
              </div>
            </div>

            {pendingPaymentPackages.length > 0 && (
              <div className="space-y-2">
                {pendingPaymentPackages.map((pkg) => (
                  <Link
                    key={pkg.id}
                    href={`/${studio}/admin/students/${pkg.user.id}`}
                    className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
                    style={{ background: 'white', border: '1px solid #FDE68A' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {pkg.user.name}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                        {pkg.package?.name ?? 'Paquete'} · {pkg.paymentMethod === 'TRANSFER' ? 'Transferencia' : 'Efectivo'}
                      </p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#C4B8AC' }}>
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* ── Accesos rápidos ── */}
          <section>
            <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Accesos rápidos
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: `/${studio}/admin/students`, label: 'Alumnos', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
                { href: `/${studio}/admin/instructores`, label: 'Instructores', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg> },
                { href: `/${studio}/admin/clases`, label: 'Gestionar clases', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /><rect width="18" height="18" x="3" y="3" rx="2" /></svg> },
                { href: `/${studio}/admin/sesiones`, label: 'Sesiones', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg> },
                { href: `/${studio}/admin/settings/branding`, label: 'Apariencia', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="13.5" r="2.5" /><circle cx="17" cy="17" r="2.5" /><circle cx="3" cy="3" r="2" /></svg> },
                { href: `/${studio}/admin/settings/politicas`, label: 'Políticas', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" /><line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" /><line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" /><line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" /><line x1="17" x2="23" y1="16" y2="16" /></svg> },
                { href: `/${studio}/admin/settings/feriados`, label: 'Feriados y cierres', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><line x1="8" x2="8" y1="14" y2="14" /><line x1="12" x2="12" y1="14" y2="14" /><line x1="16" x2="16" y1="14" y2="14" /></svg> },
              ].map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
                  style={{ background: 'white', border: '1px solid #E8E0D6' }}
                >
                  <span style={{ color: 'var(--sage)' }}>{icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: RESUMEN MENSUAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'mensual' && (
        <>
          {/* ── Ingresos del mes ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Ingresos del mes
            </p>
            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-4xl font-light"
                    style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--sage)' }}
                  >
                    {fmtARS(ingresosDelMes)}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>Facturación por paquetes</p>
                </div>
                {variacionIngresos !== null && (
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      background: variacionIngresos >= 0 ? '#EDF4ED' : '#FEE2E2',
                      color: variacionIngresos >= 0 ? 'var(--sage)' : '#DC2626',
                    }}
                  >
                    {variacionIngresos >= 0 ? '+' : ''}{variacionIngresos}% vs anterior
                  </span>
                )}
              </div>

              {ingresosDelMes > 0 && (
                <div className="mt-4 flex gap-4 border-t pt-4" style={{ borderColor: '#E8E0D6' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{fmtARS(ingresosEfectivo)}</p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>Efectivo / Transferencia</p>
                  </div>
                  {ingresosMP > 0 && (
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{fmtARS(ingresosMP)}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>MercadoPago</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Alumnos ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Alumnos
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
                >
                  {totalActiveStudents}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Total activos</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: newStudentsCount > 0 ? 'var(--sage)' : 'var(--ink)',
                  }}
                >
                  +{newStudentsCount}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Nuevas</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: sinActividad > 0 ? 'var(--terracotta)' : 'var(--ink)',
                  }}
                >
                  {sinActividad}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Sin reservas</p>
              </div>
            </div>
            {sinActividad > 0 && (
              <p className="mt-2 px-1 text-xs" style={{ color: 'var(--stone)' }}>
                {sinActividad} alumna{sinActividad !== 1 ? 's' : ''} no reservó ninguna clase este mes.
              </p>
            )}
          </section>

          {/* ── Ocupación promedio ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Ocupación de clases
            </p>
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-4xl font-light"
                    style={{
                      fontFamily: 'var(--font-cormorant, serif)',
                      color: avgOccupancyMonth >= 80 ? 'var(--sage)' : avgOccupancyMonth >= 50 ? 'var(--ink)' : 'var(--terracotta)',
                    }}
                  >
                    {avgOccupancyMonth}%
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
                    Promedio mensual · {monthSessions.length} clases
                  </p>
                </div>
                <div className="w-20">
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: '#E8E0D6' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${avgOccupancyMonth}%`,
                        background: avgOccupancyMonth >= 80 ? 'var(--sage)' : avgOccupancyMonth >= 50 ? '#C4B8AC' : 'var(--terracotta)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Horarios más populares ── */}
          {popularTimes.length > 0 && (
            <section className="mb-5">
              <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                Horarios más populares
              </p>
              <div
                className="rounded-2xl px-5 divide-y"
                style={{ background: 'white', border: '1px solid #E8E0D6', divideColor: '#E8E0D6' }}
              >
                {popularTimes.map(([slot, count], i) => (
                  <div
                    key={slot}
                    className="flex items-center justify-between py-3.5"
                    style={{ borderBottom: i < popularTimes.length - 1 ? '1px solid #E8E0D6' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                        style={{ background: i === 0 ? '#EDF4ED' : '#F3F4F6', color: i === 0 ? 'var(--sage)' : 'var(--stone)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm capitalize" style={{ color: 'var(--ink)' }}>{slot}</span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--stone)' }}>
                      {count} reserva{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Cancelaciones y ausencias ── */}
          <section className="mb-5">
            <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
              Cancelaciones y ausencias
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: monthCancellations > 10 ? 'var(--terracotta)' : 'var(--ink)',
                  }}
                >
                  {monthCancellations}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Cancelaciones</p>
              </div>
              <div
                className="rounded-2xl p-4 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p
                  className="text-3xl font-light"
                  style={{
                    fontFamily: 'var(--font-cormorant, serif)',
                    color: monthNoShows > 5 ? '#D97706' : 'var(--ink)',
                  }}
                >
                  {monthNoShows}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>Ausencias (no-show)</p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: IA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'ia' && (
        <>
          <p className="mb-4 px-1 text-xs" style={{ color: 'var(--stone)' }}>
            Análisis generados por IA a partir de los datos del estudio.
            Cada análisis se actualiza como máximo cada 6 horas.
          </p>
          <div className="space-y-4">
            <InsightCard
              studio={studio}
              type="monthly_summary"
              title="Resumen mensual"
              description="Ingresos, ocupación y retención de alumnos con recomendaciones para el próximo mes."
            />
            <InsightCard
              studio={studio}
              type="churn_risk"
              title="Riesgo de abandono"
              description="Alumnos que dejaron de reservar recientemente y acciones para reactivarlos."
            />
            <InsightCard
              studio={studio}
              type="schedule_optimization"
              title="Optimización de horarios"
              description="Horarios con baja demanda y oportunidades para agregar clases."
            />
          </div>
        </>
      )}
    </div>
  )
}
