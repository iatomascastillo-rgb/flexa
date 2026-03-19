import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { adminAdjustCredits } from '@/services/credit.service'
import { sendEmail } from '@/lib/email'
import { fmtDateShort, fmtDateTime } from '@/lib/formatters'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function toggleActiveAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const studentUserId = formData.get('studentUserId') as string
  const currentActive = formData.get('currentActive') === 'true'

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: studentUserId, studioId },
      data: { active: !currentActive },
    })
    await tx.auditLog.create({
      data: {
        studioId,
        userId: session.user.id,
        action: currentActive ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
        entityType: 'User',
        entityId: studentUserId,
        before: { active: currentActive },
        after: { active: !currentActive },
      },
    })
  })

  revalidatePath(`/${studio}/admin/students/${studentUserId}`)
}

async function assignPackageAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const studentUserId = formData.get('studentUserId') as string
  const packageId = formData.get('packageId') as string
  const paymentMethod = formData.get('paymentMethod') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard
  if (!['CASH', 'TRANSFER'].includes(paymentMethod)) return

  const [pkg, student, studioData] = await Promise.all([
    prisma.package.findUnique({
      where: { id: packageId, studioId, active: true },
      select: { classCount: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: studentUserId, studioId },
      select: { email: true, name: true },
    }),
    prisma.studio.findUnique({
      where: { id: studioId },
      select: { name: true },
    }),
  ])
  if (!pkg) return

  const now = new Date()
  // Vence el último día del mes actual
  const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))

  await prisma.$transaction(async (tx) => {
    const userPkg = await tx.userPackage.create({
      data: {
        studioId,
        userId: studentUserId,
        packageId,
        paymentMethod: paymentMethod as 'CASH' | 'TRANSFER',
        paymentStatus: 'APPROVED',
        classesTotal: pkg.classCount,
        classesRemaining: pkg.classCount,
        activatedAt: now,
        approvedBy: session.user.id,
        expiresAt,
      },
      select: { id: true },
    })

    await tx.creditTransaction.create({
      data: {
        studioId,
        userPackageId: userPkg.id,
        type: 'PURCHASE',
        amount: pkg.classCount,
        balanceAfter: pkg.classCount,
        note: `Asignación manual — ${pkg.name} (${paymentMethod})`,
        createdBy: session.user.id,
      },
    })

    await tx.auditLog.create({
      data: {
        studioId,
        userId: session.user.id,
        action: 'PACKAGE_ASSIGNED_MANUALLY',
        entityType: 'UserPackage',
        entityId: userPkg.id,
        after: { packageId, classCount: pkg.classCount, paymentMethod },
      },
    })
  })

  // Email al alumno — fuera de la transacción
  try {
    if (student && studioData) {
      await sendEmail(student.email, 'pago-aprobado', {
        studentName: student.name ?? 'Alumna',
        packageName: pkg.name,
        classesTotal: pkg.classCount,
        expiresAt: expiresAt.toLocaleDateString('es-AR', {
          day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires',
        }),
        studioName: studioData.name,
      })
    }
  } catch (emailErr) {
    console.error('[assignPackage] Error enviando email:', emailErr)
  }

  revalidatePath(`/${studio}/admin/students/${studentUserId}`)
}

async function changeRoleAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const studentUserId = formData.get('studentUserId') as string
  const newRole = formData.get('newRole') as string

  if (!['STUDENT', 'INSTRUCTOR'].includes(newRole)) return

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  const target = await prisma.user.findUnique({
    where: { id: studentUserId, studioId },
    select: { role: true },
  })
  if (!target) return

  await prisma.$transaction([
    prisma.user.update({
      where: { id: studentUserId, studioId },
      data: { role: newRole as 'STUDENT' | 'INSTRUCTOR' },
    }),
    prisma.auditLog.create({
      data: {
        studioId,
        userId: session.user.id,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: studentUserId,
        before: { role: target.role },
        after: { role: newRole },
      },
    }),
  ])

  revalidatePath(`/${studio}/admin/students/${studentUserId}`)
}

async function adjustCreditsAction(formData: FormData) {
  'use server'

  const studio = formData.get('studio') as string
  const studentUserId = formData.get('studentUserId') as string
  const amountRaw = formData.get('amount') as string
  const note = formData.get('note') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  const amount = parseInt(amountRaw, 10)
  if (isNaN(amount) || amount === 0) return
  if (!note?.trim()) return

  try {
    await adminAdjustCredits({
      adminUserId: session.user.id,
      studentUserId,
      studioId,
      amount,
      note: note.trim(),
    })
  } catch (err) {
    console.error('[admin/credits] Error ajustando créditos:', err instanceof Error ? err.message : err)
  }

  revalidatePath(`/${studio}/admin/students/${studentUserId}`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ studio: string; userId: string }>
}) {
  const { studio, userId } = await params
  const { studioId } = await requireStudioAdminPage(studio)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // ── Fetch en paralelo ─────────────────────────────────────────────────────
  const [student, activePackages, recentPackages, recentTransactions, bookingsLastMonth, availablePackages] =
    await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        active: true,
        role: true,
        studioId: true,
        createdAt: true,
      },
    }),

    // Paquetes con saldo disponible
    prisma.userPackage.findMany({
      where: { userId, studioId, paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
      orderBy: { expiresAt: 'asc' },
      select: {
        id: true,
        classesRemaining: true,
        classesTotal: true,
        expiresAt: true,
        paymentMethod: true,
        package: { select: { name: true } },
      },
    }),

    // Historial paquetes últimos 90 días
    prisma.userPackage.findMany({
      where: { userId, studioId, createdAt: { gte: ninetyDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        classesTotal: true,
        classesRemaining: true,
        paymentStatus: true,
        expiresAt: true,
        createdAt: true,
        package: { select: { name: true } },
      },
    }),

    prisma.creditTransaction.findMany({
      where: { studioId, userPackage: { userId } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        note: true,
        createdAt: true,
      },
    }),

    // Reservas confirmadas último mes
    prisma.booking.count({
      where: { studioId, userId, status: 'CONFIRMED', createdAt: { gte: thirtyDaysAgo } },
    }),

    // Paquetes activos del estudio (para asignación manual)
    prisma.package.findMany({
      where: { studioId, active: true },
      orderBy: { classCount: 'asc' },
      select: { id: true, name: true, classCount: true, price: true },
    }),
  ])

  // Verificar que el alumno pertenece al estudio
  if (!student || student.studioId !== studioId) notFound()

  const totalCredits = activePackages.reduce((sum, p) => sum + p.classesRemaining, 0)

  function fmtARS(centavos: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
    }).format(centavos / 100)
  }

  const txTypeLabel: Record<string, string> = {
    PURCHASE: 'Compra',
    BOOKING_DEDUCT: 'Clase reservada',
    CANCELLATION_REFUND: 'Cancelación',
    GRACE_DEBT_SETTLEMENT: 'Liquidación gracia',
    PLAN_CHANGE_DEDUCT: 'Cambio de plan',
    PLAN_CHANGE_TRANSFER: 'Transferencia plan',
    ADMIN_ADJUSTMENT: 'Ajuste manual',
  }

  const paymentStatusLabel: Record<string, { text: string; bg: string; color: string }> = {
    APPROVED:  { text: 'Pagado',    bg: '#EDF4ED', color: 'var(--sage)' },
    PENDING:   { text: 'Pendiente', bg: '#FFF8F0', color: '#C4774A' },
    CANCELLED: { text: 'Cancelado', bg: 'var(--terracotta-light)', color: 'var(--terracotta)' },
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">

      {/* ── Back + Header ── */}
      <div className="mb-6 flex items-start gap-4">
        <Link
          href={`/${studio}/admin/students`}
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1
            className="text-3xl font-light capitalize leading-tight"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            {student.name}
          </h1>
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            {student.email}{student.phone ? ` · ${student.phone}` : ''}
          </p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              style={student.active
                ? { background: '#EDF4ED', color: 'var(--sage)' }
                : { background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
            >
              {student.active ? 'Activa' : 'Inactiva'}
            </span>
            <span className="text-xs" style={{ color: 'var(--stone)' }}>
              · desde {fmtDateShort(student.createdAt)}
            </span>
            <form action={toggleActiveAction}>
              <input type="hidden" name="studio" value={studio} />
              <input type="hidden" name="studentUserId" value={userId} />
              <input type="hidden" name="currentActive" value={String(student.active)} />
              <button
                type="submit"
                className="rounded-full px-2.5 py-0.5 text-xs transition-opacity hover:opacity-70"
                style={{ background: '#F0EBE5', color: 'var(--stone)', border: '1px solid #E8E0D6' }}
              >
                {student.active ? 'Desactivar' : 'Reactivar'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ── Resumen: créditos + actividad ── */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--sage)', color: 'white' }}>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest opacity-75">Créditos</p>
          <span className="text-5xl font-light leading-none" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
            {totalCredits}
          </span>
          {activePackages.length > 0 && (
            <p className="mt-2 text-xs opacity-60">vence {fmtDateShort(activePackages[0].expiresAt)}</p>
          )}
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Clases (30d)</p>
          <span className="text-5xl font-light leading-none" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
            {bookingsLastMonth}
          </span>
          <p className="mt-2 text-xs" style={{ color: 'var(--stone)' }}>confirmadas</p>
        </div>
      </div>

      {/* ── Paquetes activos ── */}
      {activePackages.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Paquetes activos
          </p>
          <div className="space-y-2">
            {activePackages.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {pkg.package?.name ?? 'Paquete manual'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>Vence {fmtDateShort(pkg.expiresAt)}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--sage)' }}>
                    {pkg.classesRemaining}
                  </span>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>de {pkg.classesTotal}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Historial de paquetes (90 días) ── */}
      {recentPackages.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Paquetes últimos 3 meses
          </p>
          <div className="space-y-2">
            {recentPackages.map((pkg) => {
              const s = paymentStatusLabel[pkg.paymentStatus] ?? paymentStatusLabel.PENDING
              return (
                <div key={pkg.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {pkg.package?.name ?? 'Paquete manual'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>
                      {fmtDateShort(pkg.createdAt)} · {pkg.classesTotal} clases
                    </p>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: s.bg, color: s.color }}>
                    {s.text}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Asignar paquete ── */}
      {availablePackages.length > 0 && (
        <section
          className="mb-5 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <h2
            className="mb-4 text-xl font-light"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Asignar paquete
          </h2>
          <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
            Registrá un pago recibido fuera de MercadoPago. El paquete se activa inmediatamente.
          </p>

          <form action={assignPackageAction} className="space-y-3">
            <input type="hidden" name="studio" value={studio} />
            <input type="hidden" name="studentUserId" value={userId} />

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Paquete
              </label>
              <select
                name="packageId"
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)', background: 'white' }}
              >
                {availablePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.classCount} clases · {fmtARS(pkg.price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Método de pago
              </label>
              <select
                name="paymentMethod"
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)', background: 'white' }}
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--ink)', color: 'white' }}
            >
              Confirmar asignación
            </button>
          </form>
        </section>
      )}

      {/* ── Rol ── */}
      <section
        className="mb-5 rounded-2xl px-5 py-4"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Rol:{' '}
              <span style={{ color: student.role === 'INSTRUCTOR' ? 'var(--sage)' : 'var(--stone)' }}>
                {student.role === 'INSTRUCTOR' ? 'Instructor' : 'Alumno'}
              </span>
            </p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>
              {student.role === 'INSTRUCTOR'
                ? 'Puede ver sesiones y registrar asistencia.'
                : 'Puede reservar clases y ver su historial.'}
            </p>
          </div>
          <form action={changeRoleAction}>
            <input type="hidden" name="studio" value={studio} />
            <input type="hidden" name="studentUserId" value={userId} />
            <input
              type="hidden"
              name="newRole"
              value={student.role === 'INSTRUCTOR' ? 'STUDENT' : 'INSTRUCTOR'}
            />
            <button
              type="submit"
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={
                student.role === 'INSTRUCTOR'
                  ? { background: 'var(--terracotta-light)', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }
                  : { background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }
              }
            >
              {student.role === 'INSTRUCTOR' ? 'Convertir en alumno' : 'Promover a instructor'}
            </button>
          </form>
        </div>
      </section>

      {/* ── Asignar créditos ── */}
      <section
        className="mb-6 rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <h2
          className="mb-4 text-xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Asignar / quitar créditos
        </h2>

        <form action={adjustCreditsAction} className="space-y-4">
          <input type="hidden" name="studio" value={studio} />
          <input type="hidden" name="studentUserId" value={userId} />

          <div className="flex gap-3">
            {/* Cantidad */}
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Cantidad <span className="opacity-60">(negativo para quitar)</span>
              </label>
              <input
                type="number"
                name="amount"
                required
                placeholder="ej: 4 o -1"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Motivo <span style={{ color: 'var(--terracotta)' }}>*</span>
            </label>
            <input
              type="text"
              name="note"
              required
              placeholder="ej: Compensación clase cancelada, Cortesía, etc."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            Confirmar ajuste
          </button>
        </form>
      </section>

      {/* ── Historial de transacciones ── */}
      <section>
        <h2
          className="mb-3 text-xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Últimas transacciones
        </h2>

        {recentTransactions.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            Sin movimientos.
          </p>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {txTypeLabel[tx.type] ?? tx.type}
                    {tx.note ? (
                      <span className="ml-2 font-normal text-xs" style={{ color: 'var(--stone)' }}>
                        · {tx.note}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    {fmtDateTime(tx.createdAt)} · saldo: {tx.balanceAfter}
                  </p>
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: tx.amount > 0 ? 'var(--sage)' : 'var(--terracotta)' }}
                >
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
