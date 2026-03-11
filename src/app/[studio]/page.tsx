import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { cancelBooking } from '@/services/booking.service'
import { AppError } from '@/types/errors'

// ── Server Action: Cancelar reserva ──────────────────────────────────────────

async function cancelBookingAction(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const studio = formData.get('studio') as string

  const session = await auth()
  if (!session?.user?.id) return

  // studioId del servidor — nunca del form
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  try {
    await cancelBooking({
      bookingId,
      studioId: tenant.studioId,
      cancelledByUserId: session.user.id,
      cancellationReason: 'STUDENT_CANCELLED',
    })
  } catch (err) {
    if (err instanceof AppError) {
      // Errores tipados — ignorar silenciosamente en la acción; se reflejarán
      // en el re-render (la reserva no cambiará si falló)
      console.error('[home/cancelAction]', err.code, err.message)
    }
  }

  revalidatePath(`/${studio}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convierte fecha + "HH:mm" (hora Argentina UTC-3) a timestamp UTC. */
function toUTCMs(date: Date, time: string): number {
  const [h, m] = time.split(':').map(Number)
  const y = date.getUTCFullYear()
  const mo = date.getUTCMonth()
  const d = date.getUTCDate()
  return Date.UTC(y, mo, d, h + 3, m, 0) // UTC-3 → +3hs
}

/** Formatea fecha en hora Argentina: "lun 14 abr" */
function fmtDate(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

/** "09:00" → "9:00" */
function fmtTime(time: string): string {
  const [h, m] = time.split(':')
  return `${parseInt(h)}:${m}`
}

/** Último día del mes a las 23:59, formateado "30 abr" */
function fmtExpiry(date: Date): string {
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HomePage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params
  const session = await auth()

  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  // Seguridad: el alumno solo puede ver su propio estudio
  if (session.user.studioId !== tenant.studioId) redirect(`/login?callbackUrl=/${studio}`)

  const userId = session.user.id
  const studioId = tenant.studioId
  const now = new Date()

  // ── Fetch en paralelo ─────────────────────────────────────────────────────
  const [creditPackages, settings, graceCount, upcomingBookings, pendingPackage] =
    await Promise.all([
      // Paquetes con créditos disponibles (FIFO)
      prisma.userPackage.findMany({
        where: { userId, studioId, paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
        orderBy: { expiresAt: 'asc' },
        select: {
          classesRemaining: true,
          classesTotal: true,
          expiresAt: true,
          package: { select: { name: true } },
        },
      }),

      // Settings para ventana de cancelación
      prisma.studioSettings.findUnique({
        where: { studioId },
        select: { cancellationHours: true },
      }),

      // Reservas en gracia sin pagar (futuras)
      prisma.booking.count({
        where: {
          userId,
          studioId,
          status: 'CONFIRMED',
          userPackageId: null,
          classSession: { date: { gt: now } },
        },
      }),

      // Próximas 7 clases confirmadas
      prisma.booking.findMany({
        where: { userId, studioId, status: 'CONFIRMED', classSession: { date: { gte: now } } },
        orderBy: { classSession: { date: 'asc' } },
        take: 7,
        select: {
          id: true,
          userPackageId: true,
          classSession: {
            select: {
              date: true,
              time: true,
              classType: { select: { name: true } },
            },
          },
        },
      }),

      // Paquete pendiente de pago (más reciente)
      prisma.userPackage.findFirst({
        where: { userId, studioId, paymentStatus: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: {
          classesTotal: true,
          package: { select: { name: true, price: true } },
        },
      }),
    ])

  // ── Calcular créditos ─────────────────────────────────────────────────────
  const totalCredits = creditPackages.reduce((sum, p) => sum + p.classesRemaining, 0)
  const primaryPkg = creditPackages[0] // FIFO: el que vence antes
  const progressPct = primaryPkg
    ? Math.round((primaryPkg.classesRemaining / primaryPkg.classesTotal) * 100)
    : 0

  // ── Calcular cancelabilidad para cada booking ─────────────────────────────
  const cancellationHours = settings?.cancellationHours ?? 12
  const bookingsWithCancel = upcomingBookings.map((b) => ({
    ...b,
    canCancel: toUTCMs(b.classSession.date, b.classSession.time) - now.getTime() >
      cancellationHours * 60 * 60 * 1000,
  }))

  // ── Render ────────────────────────────────────────────────────────────────
  const userName = session.user.name?.split(' ')[0] ?? 'hola'

  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      {/* Saludo */}
      <p className="mb-1 text-sm" style={{ color: 'var(--stone)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
        Bienvenida
      </p>
      <h1
        className="mb-6 text-3xl font-light capitalize"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        {userName}
      </h1>

      {/* ── Tarjeta de créditos ── */}
      <section
        className="mb-4 rounded-2xl p-5"
        style={{ background: 'var(--sage)', color: 'white' }}
      >
        <p className="mb-1 text-xs font-medium tracking-widest uppercase opacity-80">
          Créditos disponibles
        </p>

        <div className="flex items-end justify-between">
          <span
            className="text-7xl font-light leading-none"
            style={{ fontFamily: 'var(--font-cormorant, serif)' }}
          >
            {totalCredits}
          </span>
          {primaryPkg && (
            <span className="mb-1 text-sm opacity-75">
              Vence {fmtExpiry(primaryPkg.expiresAt)}
            </span>
          )}
        </div>

        {/* Barra de progreso */}
        {primaryPkg && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs opacity-70">
              {primaryPkg.classesRemaining} de {primaryPkg.classesTotal} clases
              {primaryPkg.package?.name ? ` · ${primaryPkg.package.name}` : ''}
            </p>
          </div>
        )}

        {totalCredits === 0 && (
          <p className="mt-3 text-sm opacity-80">
            No tenés créditos disponibles. Renovar paquete →
          </p>
        )}
      </section>

      {/* ── Alerta gracia ── */}
      {graceCount > 0 && (
        <section
          className="mb-4 flex items-start gap-3 rounded-2xl p-4"
          style={{ background: 'var(--terracotta-light)', borderLeft: '3px solid var(--terracotta)' }}
        >
          <span className="mt-0.5 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {graceCount === 1
                ? '1 clase reservada sin pago'
                : `${graceCount} clases reservadas sin pago`}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
              Renová tu paquete para mantener tus lugares.
            </p>
          </div>
        </section>
      )}

      {/* ── Paquete pendiente de pago ── */}
      {pendingPackage && (
        <section
          className="mb-4 flex items-center justify-between rounded-2xl p-4"
          style={{ background: '#FFF8F0', border: '1px solid var(--terracotta)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Pago pendiente
            </p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>
              {pendingPackage.package?.name ?? `Paquete ${pendingPackage.classesTotal} clases`}
            </p>
          </div>
          <span className="text-xs font-medium" style={{ color: 'var(--terracotta)' }}>
            PENDIENTE
          </span>
        </section>
      )}

      {/* ── Próximas clases ── */}
      <section className="mb-4">
        <h2
          className="mb-3 text-xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Próximas clases
        </h2>

        {bookingsWithCancel.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: 'white', color: 'var(--stone)' }}
          >
            <p className="text-sm">No tenés clases reservadas.</p>
            <p className="mt-1 text-xs">Explorá el horario en la pestaña Clases.</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {bookingsWithCancel.map((booking) => (
              <ClassCard
                key={booking.id}
                bookingId={booking.id}
                studio={studio}
                date={fmtDate(booking.classSession.date)}
                time={fmtTime(booking.classSession.time)}
                className={booking.classSession.classType.name}
                isGrace={booking.userPackageId === null}
                canCancel={booking.canCancel}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Plan activo ── */}
      {primaryPkg && (
        <section className="mb-4">
          <h2
            className="mb-3 text-xl font-light"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Plan activo
          </h2>
          <div
            className="flex items-center justify-between rounded-2xl p-4"
            style={{ background: 'white' }}
          >
            <div>
              <p className="font-medium" style={{ color: 'var(--ink)' }}>
                {primaryPkg.package?.name ?? `${primaryPkg.classesTotal} clases`}
              </p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                Vence {fmtExpiry(primaryPkg.expiresAt)}
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: '#EDF4ED', color: 'var(--sage)' }}
            >
              Activo
            </span>
          </div>
        </section>
      )}
    </div>
  )
}

// ── ClassCard ─────────────────────────────────────────────────────────────────

function ClassCard({
  bookingId,
  studio,
  date,
  time,
  className,
  isGrace,
  canCancel,
}: {
  bookingId: string
  studio: string
  date: string
  time: string
  className: string
  isGrace: boolean
  canCancel: boolean
}) {
  return (
    <div
      className="flex min-w-[152px] flex-col rounded-2xl p-4"
      style={{
        background: 'white',
        border: isGrace ? '1px solid var(--terracotta)' : '1px solid #E8E0D6',
      }}
    >
      <p className="text-xs capitalize" style={{ color: 'var(--stone)' }}>
        {date}
      </p>
      <p
        className="mt-1 text-2xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        {time}
      </p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: 'var(--ink)' }}>
        {className}
      </p>

      {isGrace && (
        <span className="mt-2 text-xs" style={{ color: 'var(--terracotta)' }}>
          Sin pago
        </span>
      )}

      {canCancel && (
        <form action={cancelBookingAction} className="mt-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            className="w-full rounded-lg py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ background: '#F0EDEB', color: 'var(--stone)' }}
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  )
}
