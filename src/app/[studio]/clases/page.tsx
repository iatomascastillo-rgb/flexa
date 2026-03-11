import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { createBooking, cancelBooking } from '@/services/booking.service'
import { AppError } from '@/types/errors'

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
  revalidatePath(`/${studio}/clases`)
  revalidatePath(`/${studio}`)
}

async function cancelClassAction(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const studio = formData.get('studio') as string

  const session = await auth()
  if (!session?.user?.id) return

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
      console.error('[clases/cancel]', err.code, err.message)
    }
  }

  revalidatePath(`/${studio}/clases`)
  revalidatePath(`/${studio}`)
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
    timeZone: 'America/Argentina/Buenos_Aires',
  }).replace('.', '')
  const day = date.toLocaleDateString('es-AR', {
    day: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return { weekday, day }
}

/** "09:00" → "9:00" */
function fmtTime(time: string): string {
  const [h, m] = time.split(':')
  return `${parseInt(h)}:${m}`
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { studio } = await params
  const { error } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const userId = session.user.id
  const studioId = tenant.studioId
  const isAdmin = session.user.role === 'STUDIO_ADMIN' || session.user.role === 'SUPER_ADMIN'
  const now = new Date()
  const nowMs = now.getTime()

  // Midnight UTC de hoy (para la query DB)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // ── Fetch en paralelo ──────────────────────────────────────────────────────
  const [rawSessions, myBookings, settings] = await Promise.all([
    prisma.classSession.findMany({
      where: { studioId, date: { gte: todayStart }, cancelledAt: null },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 60,
      select: {
        id: true,
        date: true,
        time: true,
        capacityOverride: true,
        classType: { select: { name: true, defaultCapacity: true } },
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

    prisma.studioSettings.findUnique({
      where: { studioId },
      select: { cancellationHours: true, bookingWindowHours: true, allowWaitlist: true },
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

      {/* Error banner */}
      {errorMsg && (
        <div
          className="mb-5 mx-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
        >
          {errorMsg}
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
                        spotsLeft={s.spotsLeft}
                        capacity={s.capacity}
                        isBookable={s.isBookable}
                        isCancellable={s.isCancellable}
                        canLeaveWaitlist={s.canLeaveWaitlist}
                        myBookingStatus={s.myBooking?.status ?? null}
                        myBookingId={s.myBooking?.id ?? null}
                        isAdmin={isAdmin}
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

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({
  sessionId,
  studio,
  time,
  className,
  spotsLeft,
  capacity,
  isBookable,
  isCancellable,
  canLeaveWaitlist,
  myBookingStatus,
  myBookingId,
  isAdmin,
}: {
  sessionId: string
  studio: string
  time: string
  className: string
  spotsLeft: number
  capacity: number
  isBookable: boolean
  isCancellable: boolean
  canLeaveWaitlist: boolean
  myBookingStatus: string | null
  myBookingId: string | null
  isAdmin: boolean
}) {
  const isConfirmed = myBookingStatus === 'CONFIRMED'
  const isWaitlist = myBookingStatus === 'WAITLIST'
  const isFull = spotsLeft === 0 && !isConfirmed && !isWaitlist

  // Color del tiempo según estado
  const timeColor = isConfirmed
    ? 'var(--sage)'
    : isWaitlist
      ? 'var(--terracotta)'
      : isFull
        ? 'var(--stone)'
        : 'var(--sage)'

  // Texto de disponibilidad
  const spotsText = isConfirmed
    ? 'Reservada'
    : isWaitlist
      ? 'En espera'
      : isFull
        ? 'Sin lugares'
        : spotsLeft === 1
          ? 'Último lugar'
          : `Últimos ${spotsLeft} lugares`

  const spotsColor = isConfirmed
    ? 'var(--sage)'
    : isWaitlist
      ? 'var(--terracotta)'
      : isFull
        ? '#C4B8AC'
        : 'var(--sage)'

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '14px',
        padding: '12px',
        border: isConfirmed
          ? '1px solid var(--sage)'
          : isWaitlist
            ? '1px solid var(--terracotta)'
            : '1px solid #E8E0D6',
      }}
    >
      {/* Tiempo */}
      <p
        className="mb-0.5 font-medium tabular-nums"
        style={{ fontSize: '15px', color: timeColor, lineHeight: 1 }}
      >
        {time}
      </p>

      {/* Nombre clase */}
      <p
        className="font-semibold"
        style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.2, marginBottom: '4px' }}
      >
        {className}
      </p>

      {/* Disponibilidad */}
      <p style={{ fontSize: '11px', color: spotsColor, marginBottom: spotsText !== 'Sin lugares' ? '8px' : '0' }}>
        {spotsText}
      </p>

      {/* Acciones */}
      {isConfirmed && isCancellable && (
        <form action={cancelClassAction}>
          <input type="hidden" name="bookingId" value={myBookingId!} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#F0EDEB',
              color: 'var(--stone)',
              border: 'none',
            }}
          >
            Cancelar
          </button>
        </form>
      )}

      {isWaitlist && canLeaveWaitlist && (
        <form action={cancelClassAction}>
          <input type="hidden" name="bookingId" value={myBookingId!} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#FDF0EC',
              color: 'var(--terracotta)',
              border: 'none',
            }}
          >
            Salir de lista
          </button>
        </form>
      )}

      {isBookable && !isFull && (
        <form action={bookClassAction}>
          <input type="hidden" name="classSessionId" value={sessionId} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              background: 'var(--sage)',
              color: 'white',
              border: 'none',
            }}
          >
            Reservar
          </button>
        </form>
      )}

      {isBookable && isFull && (
        <form action={bookClassAction}>
          <input type="hidden" name="classSessionId" value={sessionId} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              background: '#FDF0EC',
              color: 'var(--terracotta)',
              border: 'none',
            }}
          >
            Lista de espera
          </button>
        </form>
      )}

      {/* Admin: link a detalle */}
      {isAdmin && (
        <Link
          href={`/${studio}/admin/sesiones/${sessionId}`}
          style={{
            display: 'block',
            marginTop: '6px',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--stone)',
            textDecoration: 'none',
            opacity: 0.6,
          }}
        >
          ⚙ gestionar
        </Link>
      )}
    </div>
  )
}
