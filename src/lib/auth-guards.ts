/**
 * Guards de autenticación y autorización para admin del estudio.
 *
 * Tres variantes según el contexto de uso:
 *   requireStudioAdminPage  → Server Components (usa redirect/notFound)
 *   requireStudioAdminAPI   → API Routes (retorna NextResponse en error)
 *   checkStudioAdmin        → Server Actions (retorna null en error, void-friendly)
 *   requireInstructorAPI    → API Routes que permiten INSTRUCTOR + STUDIO_ADMIN + SUPER_ADMIN
 */

import { redirect, notFound } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import type { Session } from 'next-auth'

type AdminGuard = { session: Session; studioId: string }

// ── Server Components ──────────────────────────────────────────────────────────

/**
 * Para usar al inicio de Server Component pages del panel admin.
 * Redirige si no está autenticado o no tiene el rol correcto.
 * Roles permitidos: STUDIO_ADMIN, SUPER_ADMIN.
 */
export async function requireStudioAdminPage(studio: string): Promise<AdminGuard> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }
  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')
  return { session, studioId: tenant.studioId }
}

// ── API Routes ─────────────────────────────────────────────────────────────────

type APIGuardOk = { ok: true; session: Session; studioId: string }
type APIGuardFail = { ok: false; response: NextResponse }
type APIGuardResult = APIGuardOk | APIGuardFail

/**
 * Para usar al inicio de API Routes del panel admin.
 * Retorna `{ ok: false, response }` en error — el caller hace `if (!guard.ok) return guard.response`.
 * Roles permitidos: STUDIO_ADMIN, SUPER_ADMIN.
 */
export async function requireStudioAdminAPI(studio: string): Promise<APIGuardResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) {
    return { ok: false, response: NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 }) }
  }
  return { ok: true, session, studioId: tenant.studioId }
}

/**
 * Para usar al inicio de API Routes accesibles por instructores.
 * Roles permitidos: INSTRUCTOR, STUDIO_ADMIN, SUPER_ADMIN.
 */
export async function requireInstructorAPI(studio: string): Promise<APIGuardResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (
    session.user.role !== 'INSTRUCTOR' &&
    session.user.role !== 'STUDIO_ADMIN' &&
    session.user.role !== 'SUPER_ADMIN'
  ) {
    return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) {
    return { ok: false, response: NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 }) }
  }
  return { ok: true, session, studioId: tenant.studioId }
}

// ── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Para usar al inicio de Server Actions del panel admin.
 * Retorna null si no hay autorización — el caller hace `if (!guard) return`.
 * Roles permitidos: STUDIO_ADMIN, SUPER_ADMIN.
 */
export async function checkStudioAdmin(studio: string): Promise<AdminGuard | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return null
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return null
  return { session, studioId: tenant.studioId }
}
