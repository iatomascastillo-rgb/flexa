export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'

// ── GET /api/[studio]/financial/costs ─────────────────────────────────────────
// Devuelve los costos fijos del mes/año indicado (o el actual por defecto).
// Solo STUDIO_ADMIN y SUPER_ADMIN.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }
  if (session.user.role === 'STUDIO_ADMIN' && session.user.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1), 10)
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()), 10)

  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Mes o año inválido' }, { status: 400 })
  }

  const costs = await prisma.studioFixedCosts.findUnique({
    where: { studioId_month_year: { studioId: tenant.studioId, month, year } },
    select: {
      id: true,
      month: true,
      year: true,
      rentCost: true,
      staffCost: true,
      otherCosts: true,
      notes: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ costs })
}

// ── POST /api/[studio]/financial/costs ────────────────────────────────────────
// Upsert de costos fijos del mes. Invalida caché del dashboard financiero.
// Body: { month, year, rentCost, staffCost, otherCosts, notes? }
// Costos en pesos ARS (la API convierte a centavos internamente).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }
  if (session.user.role === 'STUDIO_ADMIN' && session.user.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { month, year, rentCost, staffCost, otherCosts, notes } = body as Record<string, unknown>

  // Validaciones
  const m = Number(month)
  const y = Number(year)
  const rent  = Number(rentCost  ?? 0)
  const staff = Number(staffCost ?? 0)
  const other = Number(otherCosts ?? 0)

  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return NextResponse.json({ error: 'Mes inválido (1–12)' }, { status: 422 })
  }
  if (!Number.isInteger(y) || y < 2020 || y > 2100) {
    return NextResponse.json({ error: 'Año inválido' }, { status: 422 })
  }
  if (rent < 0 || staff < 0 || other < 0) {
    return NextResponse.json({ error: 'Los costos no pueden ser negativos' }, { status: 422 })
  }
  if (rent > 999_999_999 || staff > 999_999_999 || other > 999_999_999) {
    return NextResponse.json({ error: 'Valor fuera de rango' }, { status: 422 })
  }

  const studioId = tenant.studioId

  // Upsert — centavos ARS
  const saved = await prisma.studioFixedCosts.upsert({
    where: { studioId_month_year: { studioId, month: m, year: y } },
    update: {
      rentCost:   Math.round(rent  * 100),
      staffCost:  Math.round(staff * 100),
      otherCosts: Math.round(other * 100),
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
    },
    create: {
      studioId,
      month: m,
      year: y,
      rentCost:   Math.round(rent  * 100),
      staffCost:  Math.round(staff * 100),
      otherCosts: Math.round(other * 100),
      notes: typeof notes === 'string' ? notes.trim().slice(0, 500) : null,
    },
    select: { id: true, month: true, year: true, rentCost: true, staffCost: true, otherCosts: true, notes: true },
  })

  // Invalida caché del dashboard financiero para este estudio
  revalidateTag(`financial-${studioId}`, 'default')

  return NextResponse.json({ costs: saved })
}
