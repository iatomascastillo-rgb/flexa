import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { cancelSession, cancelBooking } from '@/services/booking.service'
import { AppError } from '@/types/errors'
import type { AttendanceStatus } from '@prisma/client'
import { fmtTime, fmtDateUTC } from '@/lib/formatters'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function markAttendanceAction(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const status = formData.get('status') as AttendanceStatus | 'CLEAR'
  const studio = formData.get('studio') as string
  const sessionId = formData.get('sessionId') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  await prisma.booking.update({
    where: { id: bookingId, studioId },
    data: { attendanceStatus: status === 'CLEAR' ? null : status },
  })

  revalidatePath(`/${studio}/admin/sesiones/${sessionId}`)
}

async function removeBookingAction(formData: FormData) {
  'use server'
  const bookingId = formData.get('bookingId') as string
  const sessionId = formData.get('sessionId') as string
  const studio = formData.get('studio') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  try {
    await cancelBooking({
      bookingId,
      studioId,
      cancelledByUserId: session.user.id,
      cancellationReason: 'ADMIN_REMOVED',
    })
  } catch (err) {
    if (err instanceof AppError) {
      console.error('[admin/sesiones/remove]', err.code, err.message)
    }
  }

  revalidatePath(`/${studio}/admin/sesiones/${sessionId}`)
}

async function updateInstructorAction(formData: FormData) {
  'use server'
  const sessionId = formData.get('sessionId') as string
  const studio = formData.get('studio') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  const instructorName = (formData.get('instructorName') as string)?.trim() || null

  await prisma.classSession.update({
    where: { id: sessionId, studioId },
    data: { instructorName },
  })

  revalidatePath(`/${studio}/admin/sesiones/${sessionId}`)
}

async function updateRoomAction(formData: FormData) {
  'use server'
  const sessionId = formData.get('sessionId') as string
  const studio = formData.get('studio') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  const roomId = (formData.get('roomId') as string) || null

  await prisma.classSession.update({
    where: { id: sessionId, studioId },
    data: { roomId },
  })

  revalidatePath(`/${studio}/admin/sesiones/${sessionId}`)
}

async function cancelSessionAction(formData: FormData) {
  'use server'
  const sessionId = formData.get('sessionId') as string
  const studio = formData.get('studio') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  try {
    await cancelSession({
      classSessionId: sessionId,
      studioId,
      cancelledByUserId: session.user.id,
    })
  } catch (err) {
    if (err instanceof AppError) {
      console.error('[admin/sesiones/cancel]', err.code, err.message)
    }
  }

  revalidatePath(`/${studio}/admin/sesiones/${sessionId}`)
  revalidatePath(`/${studio}/admin/sesiones`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ studio: string; sessionId: string }>
}) {
  const { studio, sessionId } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  // ── Fetch sesión con bookings y rooms ─────────────────────────────────────
  const [classSession, activeRooms] = await Promise.all([
    prisma.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        date: true,
        time: true,
        cancelledAt: true,
        capacityOverride: true,
        instructorName: true,
        studioId: true,
        roomId: true,
        room: { select: { name: true } },
        classType: { select: { name: true, defaultCapacity: true, level: true } },
        bookings: {
          where: { status: { in: ['CONFIRMED', 'WAITLIST'] } },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            status: true,
            attendanceStatus: true,
            userPackageId: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.room.findMany({
      where: { studioId, active: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!classSession || classSession.studioId !== studioId) notFound()

  const capacity = classSession.capacityOverride ?? classSession.classType.defaultCapacity
  const confirmed = classSession.bookings.filter((b) => b.status === 'CONFIRMED')
  const waitlist = classSession.bookings.filter((b) => b.status === 'WAITLIST')
  const attended = confirmed.filter((b) => b.attendanceStatus === 'ATTENDED').length
  const noShow = confirmed.filter((b) => b.attendanceStatus === 'NO_SHOW').length
  const isCancelled = !!classSession.cancelledAt

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/admin/sesiones`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1
            className="text-3xl font-light leading-none"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            {classSession.classType.name}
          </h1>
          <p className="mt-0.5 text-xs capitalize" style={{ color: 'var(--stone)' }}>
            {fmtDateUTC(classSession.date)} · {fmtTime(classSession.time)}
            {classSession.classType.level ? ` · ${classSession.classType.level}` : ''}
            {classSession.room ? ` · ${classSession.room.name}` : ''}
          </p>
        </div>
      </div>

      {/* Instructor + Salón */}
      {!isCancelled && (
        <div
          className="mb-4 rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Instructor
          </p>
          <form action={updateInstructorAction} className="mb-4 flex gap-2">
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="studio" value={studio} />
            <input
              type="text"
              name="instructorName"
              defaultValue={classSession.instructorName ?? ''}
              placeholder="Sin instructor asignado"
              className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#EDF4ED', color: 'var(--sage)' }}
            >
              Guardar
            </button>
          </form>

          {activeRooms.length > 0 && (
            <>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                Salón
              </p>
              <form action={updateRoomAction} className="flex gap-2">
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="studio" value={studio} />
                <select
                  name="roomId"
                  defaultValue={classSession.roomId ?? ''}
                  className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                >
                  <option value="">Sin salón asignado</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                >
                  Guardar
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* Badge cancelada */}
      {isCancelled && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
        >
          Esta sesión fue cancelada. Los créditos de alumnas confirmadas fueron devueltos.
        </div>
      )}

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-4 gap-2">
        {[
          { label: 'Capacidad', value: capacity },
          { label: 'Reservadas', value: confirmed.length },
          { label: 'Asistieron', value: attended },
          { label: 'No vinieron', value: noShow },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-2xl p-3 text-center"
            style={{ background: 'white' }}
          >
            <p
              className="text-2xl font-light"
              style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
            >
              {value}
            </p>
            <p className="mt-0.5 text-xs leading-tight" style={{ color: 'var(--stone)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Confirmadas ── */}
      {confirmed.length > 0 && (
        <section className="mb-5">
          <p
            className="mb-2 px-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--stone)' }}
          >
            Confirmadas ({confirmed.length})
          </p>
          <div className="space-y-2">
            {confirmed.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background: 'white',
                  border: booking.attendanceStatus === 'ATTENDED'
                    ? '1px solid var(--sage)'
                    : booking.attendanceStatus === 'NO_SHOW'
                      ? '1px solid var(--terracotta)'
                      : '1px solid #E8E0D6',
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {booking.user.name}
                    {booking.userPackageId === null && (
                      <span
                        className="ml-2 rounded-full px-1.5 py-0.5 text-xs font-normal"
                        style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                      >
                        sin pago
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--stone)' }}>
                    {booking.user.email}
                  </p>
                </div>

                {/* Botones de asistencia + quitar */}
                {!isCancelled && (
                  <div className="ml-3 flex shrink-0 gap-1">
                    {/* Asistió */}
                    <form action={markAttendanceAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="studio" value={studio} />
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input
                        type="hidden"
                        name="status"
                        value={booking.attendanceStatus === 'ATTENDED' ? 'CLEAR' : 'ATTENDED'}
                      />
                      <button
                        type="submit"
                        title="Asistió"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-opacity hover:opacity-70"
                        style={
                          booking.attendanceStatus === 'ATTENDED'
                            ? { background: 'var(--sage)', color: 'white' }
                            : { background: '#F0EDEB', color: 'var(--stone)' }
                        }
                      >
                        ✓
                      </button>
                    </form>

                    {/* No vino */}
                    <form action={markAttendanceAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="studio" value={studio} />
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input
                        type="hidden"
                        name="status"
                        value={booking.attendanceStatus === 'NO_SHOW' ? 'CLEAR' : 'NO_SHOW'}
                      />
                      <button
                        type="submit"
                        title="No vino"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-sm transition-opacity hover:opacity-70"
                        style={
                          booking.attendanceStatus === 'NO_SHOW'
                            ? { background: 'var(--terracotta)', color: 'white' }
                            : { background: '#F0EDEB', color: 'var(--stone)' }
                        }
                      >
                        ✕
                      </button>
                    </form>

                    {/* Quitar de la clase */}
                    <form action={removeBookingAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input type="hidden" name="studio" value={studio} />
                      <button
                        type="submit"
                        title="Quitar alumna"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
                        style={{ background: '#FEF0EC', color: 'var(--terracotta)' }}
                      >
                        −
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Lista de espera ── */}
      {waitlist.length > 0 && (
        <section className="mb-5">
          <p
            className="mb-2 px-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--stone)' }}
          >
            Lista de espera ({waitlist.length})
          </p>
          <div className="space-y-2">
            {waitlist.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {booking.user.name}
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--stone)' }}>
                    {booking.user.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                  >
                    Lista
                  </span>
                  {!isCancelled && (
                    <form action={removeBookingAction}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input type="hidden" name="studio" value={studio} />
                      <button
                        type="submit"
                        title="Quitar de lista"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
                        style={{ background: '#FEF0EC', color: 'var(--terracotta)' }}
                      >
                        −
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sin reservas */}
      {confirmed.length === 0 && waitlist.length === 0 && (
        <div
          className="mb-5 rounded-2xl p-6 text-center"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          <p className="text-sm">Sin reservas para esta sesión.</p>
        </div>
      )}

      {/* ── Cancelar sesión ── */}
      {!isCancelled && (
        <section className="pb-4">
          <p
            className="mb-2 px-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--stone)' }}
          >
            Acciones
          </p>
          <details className="group">
            <summary
              className="cursor-pointer list-none rounded-2xl px-4 py-3.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'white', border: '1px solid var(--terracotta)', color: 'var(--terracotta)' }}
            >
              Cancelar esta sesión...
            </summary>
            <div
              className="mt-2 rounded-2xl p-4"
              style={{ background: 'var(--terracotta-light)' }}
            >
              <p className="mb-3 text-sm" style={{ color: 'var(--ink)' }}>
                Se cancelará la sesión y se devolverán los créditos a las{' '}
                {confirmed.filter((b) => b.userPackageId !== null).length} alumna
                {confirmed.filter((b) => b.userPackageId !== null).length !== 1 ? 's' : ''} que pagaron.
                Las {confirmed.filter((b) => b.userPackageId === null).length > 0
                  ? `${confirmed.filter((b) => b.userPackageId === null).length} en gracia y `
                  : ''}
                {waitlist.length > 0 ? `${waitlist.length} en lista de espera ` : ''}
                {confirmed.filter((b) => b.userPackageId === null).length === 0 && waitlist.length === 0
                  ? 'Esta acción no se puede deshacer.'
                  : 'también serán canceladas.'}
              </p>
              <form action={cancelSessionAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <input type="hidden" name="studio" value={studio} />
                <button
                  type="submit"
                  className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'var(--terracotta)', color: 'white' }}
                >
                  Confirmar cancelación
                </button>
              </form>
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
