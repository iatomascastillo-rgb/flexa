import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtARS, fmtDateShort } from '@/lib/formatters'

// Precios en ARS (para revenue estimado)
const PLAN_PRICE: Record<string, number> = {
  BASICO: 12000,
  PRO: 22000,
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-')
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`
}

const statusColors: Record<string, string> = {
  TRIAL: '#5C7A5E',
  TRIAL_EXPIRED: '#C4774A',
  ACTIVE: '#3B82F6',
  PAST_DUE: '#EAB308',
  SUSPENDED: '#EF4444',
  CANCELLED: '#6B7280',
}

const statusLabel: Record<string, string> = {
  TRIAL: 'Trial',
  TRIAL_EXPIRED: 'Trial vencido',
  ACTIVE: 'Activo',
  PAST_DUE: 'Pago vencido',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Cancelado',
}

export default async function SuperAdminDashboard() {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const [allStudios, recentEvents, totalStudents, trialExpiringSoon, pastDueStudios] = await Promise.all([
    // Todos los estudios excepto flexa (plataforma interna)
    prisma.studio.findMany({
      where: { slug: { not: 'flexa' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        createdAt: true,
        subscription: { select: { status: true, plan: true, trialEndsAt: true } },
        _count: {
          select: { users: { where: { role: 'STUDENT', active: true } } },
        },
      },
    }),
    prisma.platformEvent.findMany({
      where: { studio: { slug: { not: 'flexa' } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        createdAt: true,
        studio: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where: { role: 'STUDENT', active: true, studio: { slug: { not: 'flexa' } } } }),

    // Trials que vencen en los próximos 7 días
    prisma.studio.findMany({
      where: {
        slug: { not: 'flexa' },
        subscription: { status: 'TRIAL', trialEndsAt: { gte: new Date(), lte: sevenDaysFromNow } },
      },
      select: {
        id: true,
        name: true,
        subscription: { select: { trialEndsAt: true } },
      },
    }),

    // Estudios con pago vencido o trial vencido (requieren acción)
    prisma.studio.findMany({
      where: {
        slug: { not: 'flexa' },
        subscription: { status: { in: ['PAST_DUE', 'TRIAL_EXPIRED'] } },
      },
      select: {
        id: true,
        name: true,
        subscription: { select: { status: true, updatedAt: true } },
      },
      orderBy: { subscription: { updatedAt: 'asc' } },
    }),
  ])

  // ── Métricas globales ──────────────────────────────────────────────────────
  const byStatus = allStudios.reduce<Record<string, number>>((acc, s) => {
    const st = s.subscription?.status ?? 'NONE'
    acc[st] = (acc[st] ?? 0) + 1
    return acc
  }, {})

  const mrrActive = allStudios
    .filter((s) => s.subscription?.status === 'ACTIVE')
    .reduce((sum, s) => sum + (PLAN_PRICE[s.subscription?.plan ?? ''] ?? 0), 0)

  const mrrPotential = allStudios
    .filter((s) => ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(s.subscription?.status ?? ''))
    .reduce((sum, s) => sum + (PLAN_PRICE[s.subscription?.plan ?? ''] ?? 0), 0)

  // ── Gráfico evolutivo: últimos 6 meses ────────────────────────────────────
  const now = new Date()
  const last6Months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    last6Months.push(monthKey(d))
  }

  const studiosByMonth: Record<string, number> = {}
  for (const mk of last6Months) studiosByMonth[mk] = 0
  for (const s of allStudios) {
    const mk = monthKey(s.createdAt)
    if (studiosByMonth[mk] !== undefined) studiosByMonth[mk]++
  }

  // Total acumulado hasta cada mes
  const allSorted = [...allStudios].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const cumulativeByMonth: Record<string, number> = {}
  for (const mk of last6Months) {
    const nextMonth = new Date(mk + '-01T00:00:00Z')
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    cumulativeByMonth[mk] = allSorted.filter((s) => s.createdAt < nextMonth).length
  }

  // MRR estimado por mes (estudios ACTIVE × precio plan)
  const mrrByMonth: Record<string, number> = {}
  for (const mk of last6Months) {
    const nextMonth = new Date(mk + '-01T00:00:00Z')
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const activeInMonth = allSorted.filter(
      (s) => s.createdAt < nextMonth && s.subscription?.status === 'ACTIVE',
    )
    mrrByMonth[mk] = activeInMonth.reduce((sum, s) => sum + (PLAN_PRICE[s.subscription?.plan ?? ''] ?? 0), 0)
  }

  const maxCumulative = Math.max(...Object.values(cumulativeByMonth), 1)
  const maxNew = Math.max(...Object.values(studiosByMonth), 1)
  const maxMrr = Math.max(...Object.values(mrrByMonth), 1)

  const eventTypeLabel: Record<string, string> = {
    TRIAL_EXPIRED: 'Trial vencido',
    TRIAL_WARNING_2D: 'Aviso: 2 días',
    TRIAL_WARNING_1D: 'Aviso: 1 día',
    STUDIO_SUSPENDED_TRIAL: 'Suspendido (trial)',
    PASTDUE_WARNING_1D: 'Aviso: pago fallido',
    STUDIO_SUSPENDED_PASTDUE: 'Suspendido (pago)',
    STUDIO_SUSPENDED_MANUAL: 'Suspendido (manual)',
    STUDIO_REACTIVATED_MANUAL: 'Reactivado',
    TRIAL_EXTENDED_MANUAL: 'Trial extendido',
  }

  return (
    <div>
      <h1 style={{ fontSize: '28px', fontWeight: 300, marginBottom: '4px', fontFamily: 'var(--font-cormorant, serif)', color: '#E8E8E8' }}>
        Dashboard
      </h1>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '28px' }}>
        {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
      </p>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {[
          { label: 'Total estudios', value: allStudios.length, color: '#E8E8E8' },
          { label: 'En trial', value: byStatus['TRIAL'] ?? 0, color: '#5C7A5E' },
          { label: 'Activos', value: byStatus['ACTIVE'] ?? 0, color: '#3B82F6' },
          { label: 'Pago vencido', value: byStatus['PAST_DUE'] ?? 0, color: '#EAB308' },
          { label: 'Suspendidos', value: byStatus['SUSPENDED'] ?? 0, color: '#EF4444' },
          { label: 'Alumnos activos', value: totalStudents, color: '#E8E8E8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px 20px' }}>
            <p style={{ fontSize: '30px', fontWeight: 300, color, fontFamily: 'var(--font-cormorant, serif)', margin: 0 }}>{value}</p>
            <p style={{ fontSize: '11px', color: '#555', margin: '4px 0 0' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── MRR ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', color: '#555', margin: '0 0 6px' }}>MRR cobrado (ACTIVE)</p>
          <p style={{ fontSize: '28px', fontWeight: 300, color: '#3B82F6', fontFamily: 'var(--font-cormorant, serif)', margin: 0 }}>{fmtARS(mrrActive)}</p>
        </div>
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '16px 20px' }}>
          <p style={{ fontSize: '11px', color: '#555', margin: '0 0 6px' }}>Revenue potencial</p>
          <p style={{ fontSize: '28px', fontWeight: 300, color: '#5C7A5E', fontFamily: 'var(--font-cormorant, serif)', margin: 0 }}>{fmtARS(mrrPotential)}</p>
        </div>
      </div>

      {/* ── Alertas ── */}
      {(trialExpiringSoon.length > 0 || pastDueStudios.length > 0) && (
        <div style={{ background: '#1A1A1A', border: '1px solid #C4774A44', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ fontSize: '11px', color: '#C4774A', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
            ⚠ Alertas · requieren atención
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {trialExpiringSoon.map((s) => {
              const daysLeft = s.subscription?.trialEndsAt
                ? Math.ceil((s.subscription.trialEndsAt.getTime() - Date.now()) / 86_400_000)
                : 0
              return (
                <Link
                  key={s.id}
                  href={`/superadmin/estudios/${s.id}`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: '#111', textDecoration: 'none' }}
                >
                  <div>
                    <span style={{ fontSize: '13px', color: '#E8E8E8' }}>{s.name}</span>
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#555' }}>trial vence en {daysLeft}d</span>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', background: '#5C7A5E22', color: '#5C7A5E', border: '1px solid #5C7A5E33' }}>
                    Extender →
                  </span>
                </Link>
              )
            })}
            {pastDueStudios.map((s) => (
              <Link
                key={s.id}
                href={`/superadmin/estudios/${s.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: '#111', textDecoration: 'none' }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: '#E8E8E8' }}>{s.name}</span>
                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#555' }}>
                    {s.subscription?.status === 'PAST_DUE' ? 'pago vencido' : 'trial vencido sin activar'}
                  </span>
                </div>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                  background: s.subscription?.status === 'PAST_DUE' ? '#EAB30822' : '#C4774A22',
                  color: s.subscription?.status === 'PAST_DUE' ? '#EAB308' : '#C4774A',
                  border: `1px solid ${s.subscription?.status === 'PAST_DUE' ? '#EAB30833' : '#C4774A33'}`,
                }}>
                  Ver →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Gráfico evolutivo ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 20px' }}>
          Evolución · últimos 6 meses
        </p>

        {/* Estudios acumulados */}
        <p style={{ fontSize: '11px', color: '#444', marginBottom: '8px' }}>Estudios totales (acumulado)</p>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '80px', marginBottom: '4px' }}>
          {last6Months.map((mk) => {
            const pct = Math.round((cumulativeByMonth[mk] / maxCumulative) * 100)
            const isLast = mk === last6Months[last6Months.length - 1]
            return (
              <div key={mk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: '#555' }}>{cumulativeByMonth[mk]}</span>
                <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, borderRadius: '3px 3px 0 0', background: isLast ? '#3B82F6' : '#1E3A5F' }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {last6Months.map((mk) => (
            <div key={mk} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#444' }}>{monthLabel(mk)}</div>
          ))}
        </div>

        {/* Nuevos por mes */}
        <p style={{ fontSize: '11px', color: '#444', marginBottom: '8px' }}>Nuevos estudios por mes</p>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '60px', marginBottom: '4px' }}>
          {last6Months.map((mk) => {
            const pct = studiosByMonth[mk] > 0 ? Math.round((studiosByMonth[mk] / maxNew) * 100) : 0
            const isLast = mk === last6Months[last6Months.length - 1]
            return (
              <div key={mk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                {studiosByMonth[mk] > 0 && <span style={{ fontSize: '10px', color: '#555' }}>{studiosByMonth[mk]}</span>}
                <div style={{ width: '100%', height: `${Math.max(pct, 3)}%`, borderRadius: '3px 3px 0 0', background: isLast ? '#5C7A5E' : '#2A3D2A', opacity: studiosByMonth[mk] === 0 ? 0.25 : 1 }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {last6Months.map((mk) => (
            <div key={mk} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#444' }}>{monthLabel(mk)}</div>
          ))}
        </div>

        {/* MRR estimado */}
        <p style={{ fontSize: '11px', color: '#444', marginBottom: '8px' }}>MRR estimado (estudios ACTIVE)</p>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '60px', marginBottom: '4px' }}>
          {last6Months.map((mk) => {
            const pct = mrrByMonth[mk] > 0 ? Math.round((mrrByMonth[mk] / maxMrr) * 100) : 0
            const isLast = mk === last6Months[last6Months.length - 1]
            return (
              <div key={mk} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', height: '100%', justifyContent: 'flex-end' }}>
                {mrrByMonth[mk] > 0 && <span style={{ fontSize: '9px', color: '#555' }}>{fmtARS(mrrByMonth[mk])}</span>}
                <div style={{ width: '100%', height: `${Math.max(pct, 3)}%`, borderRadius: '3px 3px 0 0', background: isLast ? '#C4774A' : '#4A2A1A', opacity: mrrByMonth[mk] === 0 ? 0.25 : 1 }} />
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {last6Months.map((mk) => (
            <div key={mk} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#444' }}>{monthLabel(mk)}</div>
          ))}
        </div>
      </div>

      {/* ── Lista de estudios ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Estudios ({allStudios.length})
          </p>
          <Link href="/superadmin/estudios" style={{ fontSize: '12px', color: '#5C7A5E', textDecoration: 'none' }}>
            Ver tabla →
          </Link>
        </div>

        {allStudios.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#555' }}>Sin estudios registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allStudios.map((s) => {
              const status = s.subscription?.status ?? 'NONE'
              const col = statusColors[status] ?? '#666'
              const plan = s.subscription?.plan ?? '—'
              const daysLeft = s.subscription?.trialEndsAt
                ? Math.ceil((s.subscription.trialEndsAt.getTime() - Date.now()) / 86_400_000)
                : null

              return (
                <Link
                  key={s.id}
                  href={`/superadmin/estudios/${s.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: '#111', textDecoration: 'none' }}
                >
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: col, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: '#E8E8E8', margin: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#444', margin: '1px 0 0' }}>
                      /{s.slug} · desde {fmtDateShort(s.createdAt)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '18px', fontWeight: 300, color: '#A0A0A0', fontFamily: 'var(--font-cormorant, serif)', margin: 0, lineHeight: 1 }}>
                        {s._count.users}
                      </p>
                      <p style={{ fontSize: '9px', color: '#444', margin: '1px 0 0' }}>alumnos</p>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: `${col}18`, color: col, border: `1px solid ${col}30`, whiteSpace: 'nowrap', display: 'block' }}>
                        {statusLabel[status] ?? status}{status === 'TRIAL' && daysLeft !== null && ` · ${daysLeft}d`}
                      </span>
                      <p style={{ fontSize: '9px', color: '#444', margin: '2px 0 0', textAlign: 'center' }}>{plan}</p>
                    </div>

                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Últimos eventos ── */}
      {recentEvents.length > 0 && (
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
          <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
            Últimos eventos
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {recentEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '8px', background: '#111' }}>
                <span style={{ fontSize: '11px', color: '#444', minWidth: '72px' }}>
                  {ev.createdAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' })}
                </span>
                <Link href={`/superadmin/estudios/${ev.studio.id}`} style={{ fontSize: '12px', color: '#A0A0A0', textDecoration: 'none', minWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ev.studio.name}
                </Link>
                <span style={{ fontSize: '11px', color: '#C4774A' }}>{eventTypeLabel[ev.type] ?? ev.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
