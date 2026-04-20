export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getFinancialDashboardCached } from '@/lib/cache'

// ── GET /api/[studio]/financial ───────────────────────────────────────────────
//
// Devuelve el dashboard financiero completo (6 bloques).
// Solo STUDIO_ADMIN y SUPER_ADMIN con plan PRO.
//
// Seguridad:
//   - studioId siempre del servidor (session + tenant), nunca del cliente
//   - Plan PRO requerido (SUPER_ADMIN bypasea el check para testing)
//   - Respuesta cacheada 1h por estudio — se invalida al guardar costos fijos
//   - Los nombres de alumnos en revenueAtRisk solo se devuelven aquí (endpoint autenticado)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  // ── Autenticación ───────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // ── Autorización: solo admins ───────────────────────────────────────────────
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const tenant = await getTenantBySlug(studio)
  if (!tenant) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }

  // STUDIO_ADMIN solo puede ver su propio estudio
  if (session.user.role === 'STUDIO_ADMIN' && session.user.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // ── Plan gate: PRO requerido ─────────────────────────────────────────────────
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN'
  if (!isSuperAdmin) {
    const sub = await prisma.subscription.findUnique({
      where: { studioId: tenant.studioId },
      select: { plan: true },
    })
    if (sub?.plan !== 'PRO') {
      return NextResponse.json(
        {
          error: 'El dashboard financiero requiere el plan Pro.',
          upgradeRequired: true,
        },
        { status: 403 },
      )
    }
  }

  // ── Datos (cacheados 1h) ────────────────────────────────────────────────────
  try {
    const data = await getFinancialDashboardCached(tenant.studioId)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[financial] Error generando dashboard:', err)
    return NextResponse.json(
      { error: 'Error al calcular el dashboard financiero. Intentá de nuevo.' },
      { status: 500 },
    )
  }
}
