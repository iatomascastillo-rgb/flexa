import Link from 'next/link'
import { prisma } from '@/lib/prisma'

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })
}

const statusColor: Record<string, string> = {
  TRIAL: '#5C7A5E',
  TRIAL_EXPIRED: '#C4774A',
  ACTIVE: '#3B82F6',
  PAST_DUE: '#EAB308',
  SUSPENDED: '#EF4444',
  CANCELLED: '#6B7280',
}

export default async function SuperAdminStudiosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const search = q?.trim() ?? ''

  const studios = await prisma.studio.findMany({
    where: {
      slug: { not: 'flexa' },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      createdAt: true,
      internalNote: true,
      subscription: {
        select: { status: true, plan: true, trialEndsAt: true, currentPeriodEnd: true },
      },
      _count: {
        select: { users: { where: { role: 'STUDENT', active: true } } },
      },
    },
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 300, fontFamily: 'var(--font-cormorant, serif)', color: '#E8E8E8', margin: 0 }}>
          Estudios ({studios.length})
        </h1>
        <Link href="/superadmin" style={{ fontSize: '13px', color: '#666', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
      </div>

      {/* Búsqueda */}
      <form method="GET" style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre o slug..."
          style={{ flex: 1, padding: '9px 14px', borderRadius: '8px', fontSize: '13px', background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#E8E8E8', outline: 'none' }}
        />
        <button
          type="submit"
          style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#2A2A2A', color: '#A0A0A0', border: '1px solid #333' }}
        >
          Buscar
        </button>
        {search && (
          <Link
            href="/superadmin/estudios"
            style={{ padding: '9px 14px', borderRadius: '8px', fontSize: '13px', color: '#555', textDecoration: 'none', border: '1px solid #2A2A2A' }}
          >
            ✕
          </Link>
        )}
      </form>

      {studios.length === 0 ? (
        <p style={{ color: '#555', fontSize: '14px' }}>
          {search ? `Sin resultados para "${search}".` : 'Sin estudios registrados.'}
        </p>
      ) : (
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: '16px', padding: '12px 20px', borderBottom: '1px solid #2A2A2A' }}>
            {['Estudio', 'Estado', 'Plan', 'Alumnos', 'Registro', ''].map((h) => (
              <span key={h} style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {studios.map((s) => {
            const sub = s.subscription
            const status = sub?.status ?? 'CANCELLED'
            const color = statusColor[status] ?? '#666'
            const trialDaysLeft = sub?.trialEndsAt
              ? Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null

            return (
              <div
                key={s.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px', gap: '16px', padding: '14px 20px', borderBottom: '1px solid #1F1F1F', alignItems: 'center' }}
              >
                {/* Nombre */}
                <div>
                  <p style={{ margin: 0, fontSize: '14px', color: s.active ? '#E8E8E8' : '#555' }}>
                    {s.name}
                    {!s.active && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#EF4444' }}>[inactivo]</span>}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#444' }}>/{s.slug}</p>
                  {s.internalNote && (
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#C4774A', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                      📝 {s.internalNote}
                    </p>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', background: `${color}22`, color, border: `1px solid ${color}44` }}>
                    {status}
                  </span>
                  {status === 'TRIAL' && trialDaysLeft !== null && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#555' }}>{trialDaysLeft}d restantes</p>
                  )}
                </div>

                {/* Plan */}
                <span style={{ fontSize: '13px', color: '#A0A0A0' }}>{sub?.plan ?? '—'}</span>

                {/* Alumnos */}
                <span style={{ fontSize: '13px', color: '#A0A0A0' }}>{s._count.users}</span>

                {/* Fecha registro */}
                <span style={{ fontSize: '12px', color: '#555' }}>{fmtDate(s.createdAt)}</span>

                {/* Acción */}
                <Link
                  href={`/superadmin/estudios/${s.id}`}
                  style={{ fontSize: '12px', color: '#5C7A5E', textDecoration: 'none', textAlign: 'right' }}
                >
                  Ver →
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
