export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

/**
 * PATCH /api/[studio]/recurring/[scheduleId]
 * Activa o desactiva un schedule recurrente.
 * Body: { active: boolean }
 *
 * El alumno solo puede modificar sus propios schedules.
 * STUDIO_ADMIN puede modificar cualquier schedule del estudio.
 * No hay DELETE — se usa active=false (soft-delete) para conservar historial.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string; scheduleId: string }> },
): Promise<NextResponse> {
  const { studio, scheduleId } = await params

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const tenant = await getTenantBySlug(studio)
  if (!tenant) return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  if (session.user.studioId !== tenant.studioId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Buscar schedule verificando que pertenece al estudio (studioId en WHERE = seguridad)
  const schedule = await prisma.recurringSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, userId: true, studioId: true },
  })
  if (!schedule || schedule.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })
  }

  // Solo el dueño o un STUDIO_ADMIN pueden modificarlo
  const isOwner = schedule.userId === session.user.id
  const isAdmin = session.user.role === 'STUDIO_ADMIN' || session.user.role === 'SUPER_ADMIN'
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  let body: { active?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active (boolean) requerido' }, { status: 400 })
  }

  const updated = await prisma.recurringSchedule.update({
    where: { id: scheduleId },
    data: { active: body.active },
    include: { classType: { select: { name: true } } },
  })

  return NextResponse.json(updated)
}
