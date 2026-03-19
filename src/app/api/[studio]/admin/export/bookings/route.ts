import { NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params

  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  const bookings = await prisma.booking.findMany({
    where: { studioId },
    orderBy: [{ classSession: { date: 'desc' } }, { createdAt: 'desc' }],
    take: 10000, // límite de seguridad — evita respuestas desmedidas
    select: {
      id: true,
      status: true,
      attendanceStatus: true,
      origin: true,
      createdAt: true,
      userPackageId: true,
      user: { select: { name: true, email: true } },
      classSession: {
        select: {
          date: true,
          time: true,
          classType: { select: { name: true } },
          room: { select: { name: true } },
          instructorName: true,
        },
      },
    },
  })

  const statusLabel: Record<string, string> = {
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    WAITLIST: 'Lista de espera',
  }
  const attendanceLabel: Record<string, string> = {
    ATTENDED: 'Asistió',
    NO_SHOW: 'No vino',
  }
  const originLabel: Record<string, string> = {
    MANUAL: 'Manual',
    RECURRING: 'Recurrente',
    ADMIN: 'Admin',
  }

  const tz = 'America/Argentina/Buenos_Aires'
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz })
  const fmtDateTime = (d: Date) =>
    d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: tz,
    })

  const header = [
    'Alumna',
    'Email',
    'Clase',
    'Fecha clase',
    'Hora',
    'Salón',
    'Instructor',
    'Estado',
    'Asistencia',
    'Origen',
    'Sin pago (gracia)',
    'Fecha reserva',
  ]

  const rows = bookings.map((b) => [
    b.user.name ?? '',
    b.user.email,
    b.classSession.classType.name,
    fmtDate(b.classSession.date),
    b.classSession.time,
    b.classSession.room?.name ?? '',
    b.classSession.instructorName ?? '',
    statusLabel[b.status] ?? b.status,
    b.attendanceStatus ? (attendanceLabel[b.attendanceStatus] ?? b.attendanceStatus) : '',
    originLabel[b.origin] ?? b.origin,
    b.userPackageId === null && b.status === 'CONFIRMED' ? 'Sí' : 'No',
    fmtDateTime(b.createdAt),
  ])

  // Sanitizar valor CSV: previene CSV injection en Excel/Sheets.
  // Valores que comienzan con = + - @ son interpretados como fórmulas.
  const sanitizeCsv = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `\t${v}` : v)
  const escape = (v: string) => `"${sanitizeCsv(v).replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')

  const studioData = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { name: true },
  })
  const safeName = (studioData?.name ?? studio).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const filename = `reservas-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
