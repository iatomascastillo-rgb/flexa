import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getStudioSettings } from '@/lib/cache'
import { createBooking, cancelBooking } from '@/services/booking.service'
import { AppError } from '@/types/errors'
import { SessionCard } from './SessionCard'
import { fmtTime } from '@/lib/formatters'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function bookClassAction(formData: FormData) {
  'use server'
  const classSessionId = formData.get('classSessionId') as string
  const studio = formData.get('studio') as string

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  let errorCode: string | null = null
  try {
    await createBooking({
      userId: session.user.id,
      studioId: tenant.studioId,
      classSessionId,
      origin: 'MANUAL',
    })
  } catch (err) {
    if (err instanceof AppError) {
      errorCode = err.code
    } else {
      throw err
    }
  }

  if (errorCode) redirect(`/${studio}/clases?error=${errorCode}`)
  redirect(`/${studio}/clases?success=booked`)
}

async function cancelClassAction(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const studio = formData.get('studio') as string

  const session = await auth()
  if (!session?.user?.id) return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  // Verificar ownership: el bookingId debe pertenecer al usuario autenticado
  // Evita IDOR: un alumno no puede cancelar la reserva de otro alumno
  const ownedBooking = await prisma.booking.findUnique({
    where: { id: bookingId, userId: session.user.id, studioId: tenant.studioId },
    select: { id: true },
  })
  if (!ownedBooking) return

  try {
    await cancelBooking({
      bookingId,
      studioId: tenant.studioId,
      cancelledByUserId: session.user.id,
      cancellationReason: 'STUDENT_CANCELLED',
    })
  } catch (err) {
    if (err instanceof AppError) {
      console.error('[clases/cancel]', err.code, err.message)
    }
  }

  redirect(`/${studio}/clases?success=cancelled`)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convierte fecha + "HH:mm" (hora Argentina UTC-3) a timestamp UTC ms. */
function toUTCMs(date: Date, time: string): number {
  const [h, m] = time.split(':').map(Number)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h + 3, m, 0)
}

/** "mié 11" */
function fmtDayHeader(date: Date): { weekday: string; day: string } {
  const weekday = date.toLocaleDateString('es-AR', {
    weekday: 'short',
    timeZone: 'UTC',
  }).replace('.', '')
  const day = date.toLocaleDateString('es-AR', {
    day: 'numeric',
    timeZone: 'UTC',
  })
  return { weekday, day }
}

// ── Mensajes de error ──────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  CLASS_FULL: 'La clase está llena y no hay lista de espera.',
  CLASS_FULL_WAITLIST: 'La clase está llena. Te agregamos a la lista de espera.',
  ALREADY_BOOKED: 'Ya tenés esta clase reservada.',
  NO_CREDITS: 'No tenés créditos disponibles.',
  PACKAGE_EXPIRED: 'Tu paquete venció.',
  BOOKING_WINDOW_CLOSED: 'El período de reserva para esta clase ya cerró.',
  CLASS_IN_PAST: 'Esta clase ya pasó.',
  USER_NOT_ACTIVE: 'Tu cuenta está inactiva.',
  STUDIO_SUSPENDED: 'El estudio está suspendido.',
  GRACE_PERIOD_EXPIRED: 'El período de gracia venció.',
  SESSION_CANCELLED: 'La clase fue cancelada.',
  CLASS_NOT_FOUND: 'Clase no encontrada.',
  CANCELLATION_WINDOW_CLOSED: 'El período de cancelación ya cerró.',
}

const SUCCESS_MESSAGES: Record<string, string> = {
  booked: '✓ ¡Reserva confirmada!',
  cancelled: '✓ Reserva cancelada correctamente.',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ error?: string; success?: string; salon?: string }>
}) {
  const { studio } = await params
  const { error, success, salon } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}/clases`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  if (session.user.studioId !== tenant.studioId) redirect(`/login?callbackUrl=/${studio}/clases`)

  const userId = session.user.id
  const studioId = tenant.studioId
  const isAdmin = session.user.role === 'STUDIO_ADMIN' || session.user.role === 'SUPER_ADMIN'
  const now = new Date()
  const nowMs = now.getTime()

  // Midnight UTC de hoy (para la query DB)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // ── Fetch en paralelo ──────────────────────────────────────────────────────
  const [rawSessions, myBookings, settings, rooms] = await Promise.all([
    prisma.classSession.findMany({
      where: {
        studioId,
        date: { gte: todayStart },
        cancelledAt: null,
        // Filtrar por salón si se pasó el query param (y no es "all")
        ...(salon && salon !== 'all' ? { roomId: salon } : {}),
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 60,
      select: {
        id: true,
        date: true,
        time: true,
        capacityOverride: true,
        classType: { select: { name: true, defaultCapacity: true, description: true } },
        instructorName: true,
        room: { select: { name: true } },
        bookings: {
          where: { status: { in: ['CONFIRMED', 'WAITLIST'] } },
          select: { status: true },
        },
      },
    }),

    prisma.booking.findMany({
      where: {
        userId,
        studioId,
        status: { not: 'CANCELLED' },
        classSession: { date: { gte: todayStart } },
      },
      select: { id: true, classSessionId: true, status: true },
    }),

    // Settings (cacheado 1h)
    getStudioSettings(studioId),

    prisma.room.findMany({
      where: { studioId, active: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // ── Procesar y filtrar sesiones ────────────────────────────────────────────
  const myBookingMap = new Map(myBookings.map((b) => [b.classSessionId, b]))
  const bookingWindowMs = (settings?.bookingWindowHours ?? 1) * 60 * 60 * 1000
  const cancellationWindowMs = (settings?.cancellationHours ?? 12) * 60 * 60 * 1000

  const sessions = rawSessions
    .map((s) => {
      const sessionMs = toUTCMs(s.date, s.time)
      const confirmedCount = s.bookings.filter((b) => b.status === 'CONFIRMED').length
      const capacity = s.capacityOverride ?? s.classType.defaultCapacity
      const spotsLeft = Math.max(0, capacity - confirmedCount)
      const myBooking = myBookingMap.get(s.id) ?? null
      const isInBookingWindow = sessionMs - nowMs > bookingWindowMs

      return {
        id: s.id,
        date: s.date,
        time: s.time,
        sessionMs,
        className: s.classType.name,
        description: s.classType.description ?? null,
        instructorName: s.instructorName ?? null,
        roomName: s.room?.name ?? null,
        capacity,
        confirmedCount,
        spotsLeft,
        isBookable: !myBooking && isInBookingWindow,
        isCancellable: myBooking?.status === 'CONFIRMED' && sessionMs - nowMs > cancellationWindowMs,
        canLeaveWaitlist: myBooking?.status === 'WAITLIST',
        myBooking,
      }
    })
    // Solo mostrar sesiones que aún no comenzaron
    .filter((s) => s.sessionMs > nowMs)

  // ── Agrupar por fecha ──────────────────────────────────────────────────────
  const grouped = sessions.reduce<Record<string, typeof sessions>>((acc, s) => {
    const key = s.date.toISOString().split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})
  const dateKeys = Object.keys(grouped).sort()

  const errorMsg = error ? (ERROR_MESSAGES[error] ?? 'Algo salió mal. Intentá de nuevo.') : null
  const successMsg = success ? (SUCCESS_MESSAGES[success] ?? null) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pt-8 pb-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between px-4">
        <h1
          className="text-3xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Agenda
        </h1>
        {isAdmin && (
          <Link
            href={`/${studio}/admin/sesiones`}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Gestionar
          </Link>
        )}
      </div>

      {/* Success banner */}
      {successMsg && (
        <div
          className="mb-5 mx-4 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: '#EDF4ED', color: 'var(--sage)' }}
        >
          {successMsg}
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div
          className="mb-5 mx-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
        >
          {errorMsg}
        </div>
      )}

      {/* Room picker — solo si hay más de 1 salón activo */}
      {rooms.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Link
            href={`/${studio}/clases`}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={
              !salon || salon === 'all'
                ? { background: 'var(--sage)', color: 'white' }
                : { background: 'white', color: 'var(--stone)', border: '1px solid #E8E0D6' }
            }
          >
            Todos
          </Link>
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/${studio}/clases?salon=${r.id}`}
              className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={
                salon === r.id
                  ? { background: 'var(--sage)', color: 'white' }
                  : { background: 'white', color: 'var(--stone)', border: '1px solid #E8E0D6' }
              }
            >
              {r.name}
            </Link>
          ))}
        </div>
      )}

      {/* Sin sesiones */}
      {dateKeys.length === 0 && (
        <div
          className="mx-4 rounded-2xl p-8 text-center"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          <p className="text-sm">No hay clases próximas.</p>
          <p className="mt-1 text-xs">Consultá con el estudio.</p>
        </div>
      )}

      {/* ── Columnas por día (scroll horizontal) ── */}
      {dateKeys.length > 0 && (
        <div className="overflow-x-auto">
          <div
            className="flex gap-3 px-4"
            style={{ minWidth: `${dateKeys.length * 172}px` }}
          >
            {dateKeys.map((key) => {
              const { weekday, day } = fmtDayHeader(grouped[key][0].date)
              return (
                <div key={key} style={{ width: '160px', flexShrink: 0 }}>
                  {/* Encabezado de columna */}
                  <div className="mb-3 pb-2" style={{ borderBottom: '1px solid #E8E0D6' }}>
                    <span
                      className="text-xs font-medium capitalize"
                      style={{ color: 'var(--stone)' }}
                    >
                      {weekday}
                    </span>
                    <span
                      className="ml-1.5 text-2xl font-light leading-none"
                      style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Cards de sesiones */}
                  <div className="space-y-2">
                    {grouped[key].map((s) => (
                      <SessionCard
                        key={s.id}
                        sessionId={s.id}
                        studio={studio}
                        time={fmtTime(s.time)}
                        className={s.className}
                        description={s.description}
                        instructorName={s.instructorName}
                        roomName={s.roomName}
                        spotsLeft={s.spotsLeft}
                        capacity={s.capacity}
                        isBookable={s.isBookable}
                        isCancellable={s.isCancellable}
                        canLeaveWaitlist={s.canLeaveWaitlist}
                        myBookingStatus={s.myBooking?.status ?? null}
                        myBookingId={s.myBooking?.id ?? null}
                        isAdmin={isAdmin}
                        bookAction={bookClassAction}
                        cancelAction={cancelClassAction}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

