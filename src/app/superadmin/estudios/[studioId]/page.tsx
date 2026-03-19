import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fmtDateShort } from '@/lib/formatters'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function suspendStudioAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  await prisma.$transaction([
    prisma.subscription.update({
      where: { studioId },
      data: { status: 'SUSPENDED' },
    }),
    prisma.studio.update({
      where: { id: studioId },
      data: { active: false },
    }),
    prisma.platformEvent.create({
      data: {
        studioId,
        type: 'STUDIO_SUSPENDED_MANUAL',
        data: { by: session.user.id, at: new Date() },
      },
    }),
  ])

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function reactivateStudioAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setDate(periodEnd.getDate() + 30)

  await prisma.$transaction([
    prisma.subscription.update({
      where: { studioId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    }),
    prisma.studio.update({
      where: { id: studioId },
      data: { active: true },
    }),
    prisma.platformEvent.create({
      data: {
        studioId,
        type: 'STUDIO_REACTIVATED_MANUAL',
        data: { by: session.user.id, at: now, periodEnd },
      },
    }),
  ])

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function changePlanAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const plan = formData.get('plan') as string
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return
  if (!['BASICO', 'PRO'].includes(plan)) return

  await prisma.subscription.update({
    where: { studioId },
    data: { plan: plan as 'BASICO' | 'PRO' },
  })

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function addSaasPaymentAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  const amountRaw = parseInt(formData.get('amount') as string)
  const period = (formData.get('period') as string).trim()   // "YYYY-MM"
  const method = formData.get('method') as string
  const notes = (formData.get('notes') as string).trim() || null
  const paidAtRaw = formData.get('paidAt') as string

  if (!amountRaw || amountRaw <= 0) return
  if (!/^\d{4}-\d{2}$/.test(period)) return
  if (!['TRANSFER', 'CASH', 'MERCADOPAGO'].includes(method)) return

  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date()

  await prisma.saasPayment.create({
    data: { studioId, amount: amountRaw, period, method, paidAt, notes },
  })

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function deleteSaasPaymentAction(formData: FormData) {
  'use server'
  const paymentId = formData.get('paymentId') as string
  const studioId = formData.get('studioId') as string
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  // deleteMany con studioId en el WHERE — verifica pertenencia atómicamente
  await prisma.saasPayment.deleteMany({ where: { id: paymentId, studioId } })
  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function saveNoteAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const note = (formData.get('note') as string) || ''
  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  await prisma.studio.update({
    where: { id: studioId },
    data: { internalNote: note.trim() || null },
  })

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function extendTrialAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const daysRaw = parseInt(formData.get('days') as string) || 7
  const days = Math.min(60, Math.max(1, daysRaw))

  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  const sub = await prisma.subscription.findUnique({ where: { studioId }, select: { trialEndsAt: true } })
  const base = sub?.trialEndsAt ?? new Date()
  const newTrialEnd = new Date(Math.max(base.getTime(), Date.now()))
  newTrialEnd.setDate(newTrialEnd.getDate() + days)

  await prisma.$transaction([
    prisma.subscription.update({
      where: { studioId },
      data: { status: 'TRIAL', trialEndsAt: newTrialEnd },
    }),
    prisma.studio.update({
      where: { id: studioId },
      data: { active: true },
    }),
    prisma.platformEvent.create({
      data: {
        studioId,
        type: 'TRIAL_EXTENDED_MANUAL',
        data: { by: session.user.id, days, newTrialEnd },
      },
    }),
  ])

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

async function setAiInsightTrialAction(formData: FormData) {
  'use server'
  const studioId = formData.get('studioId') as string
  const daysRaw = parseInt(formData.get('days') as string) || 30
  const days = Math.min(90, Math.max(0, daysRaw))

  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') return

  // days = 0 → revocar trial; days > 0 → setear desde hoy
  const aiInsightTrialEndsAt = days > 0
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    : null

  await prisma.$transaction([
    prisma.subscription.update({
      where: { studioId },
      data: { aiInsightTrialEndsAt },
    }),
    prisma.platformEvent.create({
      data: {
        studioId,
        type: 'AI_INSIGHT_TRIAL_SET',
        data: { by: session.user.id, days, aiInsightTrialEndsAt },
      },
    }),
  ])

  revalidatePath(`/superadmin/estudios/${studioId}`)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
}

const statusColor: Record<string, string> = {
  TRIAL: '#5C7A5E',
  TRIAL_EXPIRED: '#C4774A',
  ACTIVE: '#3B82F6',
  PAST_DUE: '#EAB308',
  SUSPENDED: '#EF4444',
  CANCELLED: '#6B7280',
}

const eventLabel: Record<string, string> = {
  TRIAL_EXPIRED: 'Trial vencido (auto)',
  TRIAL_WARNING_2D: 'Aviso: 2 días',
  TRIAL_WARNING_1D: 'Aviso: 1 día',
  STUDIO_SUSPENDED_TRIAL: 'Suspendido por trial (auto)',
  PASTDUE_WARNING_1D: 'Aviso: pago fallido (auto)',
  STUDIO_SUSPENDED_PASTDUE: 'Suspendido por pago (auto)',
  STUDIO_SUSPENDED_MANUAL: 'Suspendido manualmente',
  STUDIO_REACTIVATED_MANUAL: 'Reactivado manualmente',
  TRIAL_EXTENDED_MANUAL: 'Trial extendido manualmente',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SuperAdminStudioDetailPage({
  params,
}: {
  params: Promise<{ studioId: string }>
}) {
  const { studioId } = await params

  const session = await auth()
  if (session?.user?.role !== 'SUPER_ADMIN') redirect('/login')

  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: {
      subscription: true,
      settings: { select: { cancellationHours: true, allowWaitlist: true, gracePeriodEnabled: true } },
      branding: { select: { primaryColor: true, welcomeMessage: true } },
      // internalNote is on studio root, included automatically
      users: {
        where: { role: { in: ['STUDIO_ADMIN', 'STUDENT'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true },
      },
      platformEvents: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, data: true, createdAt: true },
      },
      saasPayments: {
        orderBy: { paidAt: 'desc' },
        select: { id: true, amount: true, period: true, method: true, paidAt: true, notes: true, mpPaymentId: true },
      },
      _count: {
        select: {
          users: { where: { role: 'STUDENT', active: true } },
          classSessions: { where: { cancelledAt: null } },
          bookings: { where: { status: 'CONFIRMED' } },
        },
      },
    },
  })

  if (!studio) notFound()

  const sub = studio.subscription
  const statusCol = sub ? (statusColor[sub.status] ?? '#666') : '#666'
  const admins = studio.users.filter((u) => u.role === 'STUDIO_ADMIN')
  const students = studio.users.filter((u) => u.role === 'STUDENT')

  const isSuspendable = sub && ['TRIAL', 'TRIAL_EXPIRED', 'ACTIVE', 'PAST_DUE'].includes(sub.status)
  const isReactivatable = sub && ['SUSPENDED', 'CANCELLED'].includes(sub.status)
  const isExtendable = sub && ['TRIAL', 'TRIAL_EXPIRED', 'SUSPENDED'].includes(sub.status)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <Link href="/superadmin/estudios" style={{ fontSize: '12px', color: '#555', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← Estudios
          </Link>
          <h1 style={{ fontSize: '32px', fontWeight: 300, fontFamily: 'var(--font-cormorant, serif)', color: '#E8E8E8', margin: 0 }}>
            {studio.name}
            {!studio.active && <span style={{ marginLeft: '12px', fontSize: '16px', color: '#EF4444' }}>[inactivo]</span>}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#555' }}>/{studio.slug} · creado {fmtDateShort(studio.createdAt)}</p>
        </div>
        {sub && (
          <span style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px', background: `${statusCol}22`, color: statusCol, border: `1px solid ${statusCol}44` }}>
            {sub.status}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* ── Suscripción ── */}
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
          <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Suscripción</p>
          {sub ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Plan', value: sub.plan },
                { label: 'Estado', value: sub.status },
                { label: 'Trial vence', value: fmtDate(sub.trialEndsAt) },
                { label: 'Período actual', value: sub.currentPeriodStart ? `${fmtDateShort(sub.currentPeriodStart)} → ${fmtDate(sub.currentPeriodEnd)}` : '—' },
                {
                  label: 'Trial IA',
                  value: sub.plan === 'PRO'
                    ? 'PRO (permanente)'
                    : sub.aiInsightTrialEndsAt
                      ? (sub.aiInsightTrialEndsAt > new Date() ? `activo hasta ${fmtDate(sub.aiInsightTrialEndsAt)}` : `vencido ${fmtDate(sub.aiInsightTrialEndsAt)}`)
                      : 'no activo',
                },
                { label: 'Actualizado', value: fmtDateShort(sub.updatedAt) },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#555' }}>{label}</span>
                  <span style={{ color: '#A0A0A0' }}>{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#555', fontSize: '13px' }}>Sin suscripción.</p>
          )}
        </div>

        {/* ── Métricas ── */}
        <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
          <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>Métricas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Alumnos activos', value: studio._count.users },
              { label: 'Sesiones programadas', value: studio._count.classSessions },
              { label: 'Reservas activas', value: studio._count.bookings },
              { label: 'Cancelación (hs)', value: studio.settings?.cancellationHours ?? '—' },
              { label: 'Lista de espera', value: studio.settings?.allowWaitlist ? 'sí' : 'no' },
              { label: 'Período de gracia', value: studio.settings?.gracePeriodEnabled ? 'sí' : 'no' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#555' }}>{label}</span>
                <span style={{ color: '#A0A0A0' }}>{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Acciones manuales ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
          Acciones manuales
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Suspender */}
          {isSuspendable && (
            <form action={suspendStudioAction}>
              <input type="hidden" name="studioId" value={studioId} />
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#2A1A1A', color: '#EF4444', border: '1px solid #EF444433' }}
              >
                Suspender estudio
              </button>
            </form>
          )}

              {/* Cambiar plan */}
          <form action={changePlanAction} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="hidden" name="studioId" value={studioId} />
            <select
              name="plan"
              defaultValue={sub?.plan ?? 'BASICO'}
              style={{ padding: '7px 10px', borderRadius: '8px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', cursor: 'pointer' }}
            >
              <option value="BASICO">BASICO</option>
              <option value="PRO">PRO</option>
            </select>
            <button
              type="submit"
              style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#1A1A2A', color: '#A0A0E8', border: '1px solid #A0A0E833' }}
            >
              Cambiar plan
            </button>
          </form>

          {/* Reactivar */}
          {isReactivatable && (
            <form action={reactivateStudioAction}>
              <input type="hidden" name="studioId" value={studioId} />
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#1A2A1A', color: '#3B82F6', border: '1px solid #3B82F633' }}
              >
                Reactivar (ACTIVE +30d)
              </button>
            </form>
          )}

          {/* Extender trial */}
          {isExtendable && (
            <form action={extendTrialAction} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="hidden" name="studioId" value={studioId} />
              <input
                type="number"
                name="days"
                defaultValue={7}
                min={1}
                max={60}
                style={{ width: '60px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8' }}
              />
              <span style={{ fontSize: '12px', color: '#555' }}>días</span>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#1A2A1A', color: '#5C7A5E', border: '1px solid #5C7A5E33' }}
              >
                Extender trial
              </button>
            </form>
          )}

          {/* Trial IA — disponible para plan BASICO */}
          {sub && sub.plan === 'BASICO' && (
            <form action={setAiInsightTrialAction} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="hidden" name="studioId" value={studioId} />
              <input
                type="number"
                name="days"
                defaultValue={30}
                min={0}
                max={90}
                style={{ width: '60px', padding: '7px 10px', borderRadius: '8px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8' }}
              />
              <span style={{ fontSize: '12px', color: '#555' }}>días (0 = revocar)</span>
              <button
                type="submit"
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: '#1A1A2A', color: '#A0A0E8', border: '1px solid #A0A0E833' }}
              >
                Trial IA
              </button>
            </form>
          )}

          {!isSuspendable && !isReactivatable && !isExtendable && sub?.plan === 'PRO' && (
            <span style={{ fontSize: '13px', color: '#444' }}>No hay acciones disponibles para este estado.</span>
          )}
        </div>
      </div>

      {/* ── Admins del estudio ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Administradores ({admins.length})
        </p>
        {admins.map((u) => (
          <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
            <span style={{ color: '#A0A0A0' }}>{u.name}</span>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {u.phone && <span style={{ color: '#5C7A5E', fontSize: '12px' }}>{u.phone}</span>}
              <span style={{ color: '#555' }}>{u.email}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alumnos ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Alumnos ({students.length})
        </p>
        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {students.map((u) => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1F1F1F', fontSize: '13px' }}>
              <span style={{ color: u.active ? '#A0A0A0' : '#444' }}>{u.name}</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ color: '#444', fontSize: '12px' }}>{u.email}</span>
                {!u.active && <span style={{ fontSize: '11px', color: '#EF4444' }}>inactivo</span>}
              </div>
            </div>
          ))}
          {students.length === 0 && <p style={{ color: '#444', fontSize: '13px' }}>Sin alumnos.</p>}
        </div>
      </div>

      {/* ── Pagos SaaS ── */}
      {(() => {
        const totalCobrado = studio.saasPayments.reduce((sum, p) => sum + p.amount, 0)
        const methodLabel: Record<string, string> = { TRANSFER: 'Transferencia', CASH: 'Efectivo', MERCADOPAGO: 'MercadoPago' }
        const fmtPeriod = (p: string) => {
          const [y, m] = p.split('-')
          const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
          return `${months[parseInt(m) - 1]} ${y}`
        }
        // Período sugerido: mes actual
        const now = new Date()
        const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const defaultPaidAt = now.toISOString().split('T')[0]

        return (
          <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Pagos SaaS
              </p>
              {totalCobrado > 0 && (
                <span style={{ fontSize: '13px', color: '#3B82F6', fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300 }}>
                  Total: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalCobrado)}
                </span>
              )}
            </div>

            {/* Lista de pagos */}
            {studio.saasPayments.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#444', marginBottom: '16px' }}>Sin pagos registrados.</p>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                {studio.saasPayments.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #1F1F1F' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', color: '#5C7A5E', fontFamily: 'var(--font-cormorant, serif)', fontWeight: 300 }}>
                          {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p.amount)}
                        </span>
                        <span style={{ fontSize: '12px', color: '#A0A0A0' }}>{fmtPeriod(p.period)}</span>
                        <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: '#2A2A2A', color: '#555' }}>
                          {methodLabel[p.method] ?? p.method}
                        </span>
                        {p.mpPaymentId && (
                          <span style={{ fontSize: '10px', color: '#3B82F6' }}>MP #{p.mpPaymentId}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#444' }}>
                          {p.paidAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}
                        </span>
                        {p.notes && <span style={{ fontSize: '11px', color: '#555', fontStyle: 'italic' }}>{p.notes}</span>}
                      </div>
                    </div>
                    {/* Borrar */}
                    {!p.mpPaymentId && (
                      <form action={deleteSaasPaymentAction}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input type="hidden" name="studioId" value={studioId} />
                        <button
                          type="submit"
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', background: 'transparent', color: '#EF4444', border: '1px solid #EF444422' }}
                        >
                          ✕
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Formulario: agregar pago */}
            <details>
              <summary style={{ fontSize: '12px', color: '#5C7A5E', cursor: 'pointer', userSelect: 'none', marginBottom: '12px' }}>
                + Registrar pago manual
              </summary>
              <form action={addSaasPaymentAction} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                <input type="hidden" name="studioId" value={studioId} />

                <div>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Monto (ARS)</label>
                  <input
                    type="number"
                    name="amount"
                    placeholder={sub?.plan === 'PRO' ? '22000' : '12000'}
                    min={1}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Período (mes)</label>
                  <input
                    type="month"
                    name="period"
                    defaultValue={defaultPeriod}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Método</label>
                  <select
                    name="method"
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', boxSizing: 'border-box' }}
                  >
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CASH">Efectivo</option>
                    <option value="MERCADOPAGO">MercadoPago</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Fecha de pago</label>
                  <input
                    type="date"
                    name="paidAt"
                    defaultValue={defaultPaidAt}
                    required
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '11px', color: '#555', display: 'block', marginBottom: '4px' }}>Nota (opcional)</label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="Ej: pago parcial, descuento acordado..."
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', fontSize: '13px', background: '#111', border: '1px solid #2A2A2A', color: '#E8E8E8', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <button
                    type="submit"
                    style={{ padding: '8px 20px', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', background: '#1A2A1A', color: '#5C7A5E', border: '1px solid #5C7A5E33' }}
                  >
                    Guardar pago
                  </button>
                </div>
              </form>
            </details>
          </div>
        )
      })()}

      {/* ── Notas internas ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Nota interna
        </p>
        <form action={saveNoteAction}>
          <input type="hidden" name="studioId" value={studioId} />
          <textarea
            name="note"
            defaultValue={studio.internalNote ?? ''}
            placeholder="Notas privadas sobre este estudio (contexto, problemas, acuerdos especiales...)"
            rows={4}
            style={{ width: '100%', background: '#111', border: '1px solid #2A2A2A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#A0A0A0', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button
            type="submit"
            style={{ marginTop: '8px', padding: '7px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', background: '#2A2A1A', color: '#C4774A', border: '1px solid #C4774A33' }}
          >
            Guardar nota
          </button>
        </form>
      </div>

      {/* ── Historial de eventos ── */}
      <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px', padding: '20px' }}>
        <p style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
          Historial de eventos ({studio.platformEvents.length})
        </p>
        {studio.platformEvents.length === 0 ? (
          <p style={{ color: '#444', fontSize: '13px' }}>Sin eventos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {studio.platformEvents.map((ev) => (
              <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 10px', borderRadius: '8px', background: '#111' }}>
                <span style={{ fontSize: '11px', color: '#444', minWidth: '120px' }}>{fmtDate(ev.createdAt)}</span>
                <span style={{ fontSize: '12px', color: '#C4774A' }}>{eventLabel[ev.type] ?? ev.type}</span>
                {ev.data && Object.keys(ev.data as object).length > 0 && (
                  <span style={{ fontSize: '11px', color: '#333', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {JSON.stringify(ev.data)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
