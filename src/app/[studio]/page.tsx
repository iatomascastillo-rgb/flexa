import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getStudioSettings } from '@/lib/cache'
import { cancelBooking } from '@/services/booking.service'
import { AppError } from '@/types/errors'
import { fmtTime, fmtDateAR } from '@/lib/formatters'

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

  // Instructores van directo a su panel
  if (session.user.role === 'INSTRUCTOR') redirect(`/${studio}/instructor`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  // Seguridad: el alumno solo puede ver su propio estudio
  if (session.user.studioId !== tenant.studioId) redirect(`/login?callbackUrl=/${studio}`)

  const userId = session.user.id
  const studioId = tenant.studioId
  const now = new Date()

  // ── Fetch en paralelo ─────────────────────────────────────────────────────
  const [creditPackages, settings, graceCount, upcomingBookings, pendingPackage, branding] =
    await Promise.all([
      // Paquetes con créditos disponibles (FIFO)
      prisma.userPackage.findMany({
        where: { userId, studioId, paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
        orderBy: { expiresAt: 'asc' },
        select: {
          classesRemaining: true,
          classesTotal: true,
          expiresAt: true,
          isRecovery: true,
          package: { select: { name: true } },
        },
      }),

      // Settings para ventana de cancelación (cacheado 1h)
      getStudioSettings(studioId),

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

      // Branding: portada + redes sociales
      prisma.studioBranding.findUnique({
        where: { studioId },
        select: { coverUrl: true, instagramUrl: true, whatsappUrl: true, websiteUrl: true },
      }).catch(() => null),
    ])

  // ── Calcular créditos ─────────────────────────────────────────────────────
  const totalCredits = creditPackages.reduce((sum, p) => sum + p.classesRemaining, 0)
  const primaryPkg = creditPackages[0] // FIFO: el que vence antes
  // Créditos de recuperación activos (pueden ser varios)
  const recoveryPackages = creditPackages.filter(p => p.isRecovery)

  // ── Alerta de créditos por vencer (entre 0 y 3 días) ─────────────────────
  // Solo paquetes que AÚN no vencieron (msUntilExpiry > 0) y vencen en ≤3 días
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
  const expiringPackage = creditPackages.find((p) => {
    const msUntilExpiry = p.expiresAt.getTime() - now.getTime()
    return msUntilExpiry > 0 && msUntilExpiry <= THREE_DAYS_MS
  })
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
      {/* ── Portada / Banner ── */}
      {branding?.coverUrl && (
        <div className="-mx-4 -mt-8 mb-6 h-40 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={branding.coverUrl} alt="Portada" className="h-full w-full object-cover" />
        </div>
      )}

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

      {/* ── Banner créditos por vencer ── */}
      {expiringPackage && (() => {
        const daysLeft = Math.ceil((expiringPackage.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
        return (
          <Link
            href={`/${studio}/paquetes`}
            className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3 transition-opacity hover:opacity-80"
            style={{ background: '#FFF3E0', border: '1px solid #F4A535' }}
          >
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '18px' }}>⏳</span>
              <div>
                <p className="text-sm font-medium" style={{ color: '#92400E' }}>
                  Tu paquete vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''}
                </p>
                <p className="text-xs" style={{ color: '#B45309' }}>
                  Te quedan {expiringPackage.classesRemaining} crédito
                  {expiringPackage.classesRemaining !== 1 ? 's' : ''} · Renovar →
                </p>
              </div>
            </div>
          </Link>
        )
      })()}

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
          <Link
            href={`/${studio}/paquetes`}
            className="mt-3 block text-sm opacity-80 hover:opacity-100 transition-opacity"
          >
            No tenés créditos disponibles. Renovar paquete →
          </Link>
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

      {/* ── Alerta recuperación de crédito ── */}
      {recoveryPackages.length > 0 && (
        <section
          className="mb-4 flex items-start gap-3 rounded-2xl p-4"
          style={{ background: '#F0F7F4', borderLeft: '3px solid var(--sage)' }}
        >
          <span className="mt-0.5 text-lg">🔄</span>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {recoveryPackages.length === 1
                ? 'Tenés 1 clase de recuperación disponible'
                : `Tenés ${recoveryPackages.reduce((s, p) => s + p.classesRemaining, 0)} clases de recuperación disponibles`}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
              {recoveryPackages.length === 1
                ? `Vence el ${fmtExpiry(recoveryPackages[0]!.expiresAt)}. Reservá una clase antes de que expire.`
                : `La más próxima vence el ${fmtExpiry(recoveryPackages[0]!.expiresAt)}.`}
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
                date={fmtDateAR(booking.classSession.date)}
                time={fmtTime(booking.classSession.time)}
                className={booking.classSession.classType.name}
                isGrace={booking.userPackageId === null}
                canCancel={booking.canCancel}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Redes sociales ── */}
      {(branding?.instagramUrl || branding?.whatsappUrl || branding?.websiteUrl) && (
        <section className="mb-4 flex gap-3">
          {branding.instagramUrl && (
            <a
              href={branding.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--stone)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              Instagram
            </a>
          )}
          {branding.whatsappUrl && (
            <a
              href={branding.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--stone)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>
              WhatsApp
            </a>
          )}
          {branding.websiteUrl && (
            <a
              href={branding.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--stone)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Web
            </a>
          )}
        </section>
      )}

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
