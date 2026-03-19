export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import type { DayOfWeek } from '@prisma/client'

const VALID_DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const TIME_REGEX = /^\d{2}:\d{2}$/

/**
 * GET /api/[studio]/recurring
 * Lista los schedules recurrentes activos del alumno autenticado.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenant = await getTenantBySlug(studio)
  if (!tenant) return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  if (session.user.studioId !== tenant.studioId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const schedules = await prisma.recurringSchedule.findMany({
    where: { studioId: tenant.studioId, userId: session.user.id, active: true },
    include: { classType: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(schedules)
}

/**
 * POST /api/[studio]/recurring
 * Crea un nuevo schedule recurrente para el alumno autenticado.
 * Body: { classTypeId, dayOfWeek, time }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenant = await getTenantBySlug(studio)
  if (!tenant) return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  if (session.user.studioId !== tenant.studioId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Solo STUDENT y STUDIO_ADMIN pueden crear schedules propios
  if (session.user.role === 'INSTRUCTOR') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: { classTypeId?: unknown; dayOfWeek?: unknown; time?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { classTypeId, dayOfWeek, time } = body

  if (typeof classTypeId !== 'string' || !classTypeId) {
    return NextResponse.json({ error: 'classTypeId requerido' }, { status: 400 })
  }
  if (!VALID_DAYS.includes(dayOfWeek as DayOfWeek)) {
    return NextResponse.json({ error: 'dayOfWeek inválido' }, { status: 400 })
  }
  if (typeof time !== 'string' || !TIME_REGEX.test(time)) {
    return NextResponse.json({ error: 'time debe tener formato HH:mm' }, { status: 400 })
  }

  // Verificar classType y duplicado en paralelo
  const [classType, existing] = await Promise.all([
    prisma.classType.findUnique({
      where: { id: classTypeId },
      select: { studioId: true, active: true },
    }),
    prisma.recurringSchedule.findFirst({
      where: {
        studioId: tenant.studioId,
        userId: session.user.id,
        classTypeId,
        dayOfWeek: dayOfWeek as DayOfWeek,
        time,
        active: true,
      },
      select: { id: true },
    }),
  ])

  if (!classType || classType.studioId !== tenant.studioId || !classType.active) {
    return NextResponse.json({ error: 'Tipo de clase no encontrado' }, { status: 404 })
  }

  if (existing) {
    return NextResponse.json({ error: 'Ya tenés una recurrencia para ese día y horario' }, { status: 409 })
  }

  const schedule = await prisma.recurringSchedule.create({
    data: {
      studioId: tenant.studioId,
      userId: session.user.id,
      classTypeId,
      dayOfWeek: dayOfWeek as DayOfWeek,
      time,
      active: true,
    },
    include: { classType: { select: { name: true } } },
  })

  return NextResponse.json(schedule, { status: 201 })
}
