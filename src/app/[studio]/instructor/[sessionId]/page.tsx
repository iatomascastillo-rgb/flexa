import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { AttendanceClient } from './AttendanceClient'
import { todayARStart, fmtTime } from '@/lib/formatters'

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function InstructorSessionPage({
  params,
}: {
  params: Promise<{ studio: string; sessionId: string }>
}) {
  const { studio, sessionId } = await params

  const session = await auth()
  if (!session?.user?.id) redirect(`/${studio}/login?callbackUrl=/${studio}/instructor`)
  if (session.user.role === 'STUDENT') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  const classSession = await prisma.classSession.findFirst({
    where: { id: sessionId, studioId: tenant.studioId },
    include: { classType: { select: { name: true } } },
  })
  if (!classSession) notFound()

  const bookings = await prisma.booking.findMany({
    where: { classSessionId: sessionId, studioId: tenant.studioId, status: 'CONFIRMED' },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const today = todayARStart()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sessionDate = classSession.date
  const canEdit =
    sessionDate.getTime() >= yesterday.getTime() &&
    sessionDate.getTime() <= today.getTime()

  const dateStr = sessionDate.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })

  const students = bookings.map((b) => ({
    bookingId: b.id,
    userId: b.userId,
    name: b.user.name,
    attendanceStatus: b.attendanceStatus,
  }))

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-24">
      {/* Back nav */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href={`/${studio}/instructor`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <span className="text-sm" style={{ color: 'var(--stone)' }}>Mis clases</span>
      </div>

      {/* Header */}
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        {classSession.classType.name}
      </h1>
      <p className="mb-6 text-sm capitalize" style={{ color: 'var(--stone)' }}>
        {dateStr} · {fmtTime(classSession.time)}
      </p>

      {/* Warning if outside edit window */}
      {!canEdit && (
        <div
          className="mb-5 rounded-2xl px-4 py-3 text-sm"
          style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
        >
          Solo podés registrar asistencia en clases de hoy y ayer.
        </div>
      )}

      <AttendanceClient students={students} studio={studio} canEdit={canEdit} />
    </div>
  )
}
