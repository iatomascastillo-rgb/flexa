export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'
import { adminAdjustCredits } from '@/services/credit.service'

/**
 * POST /api/[studio]/admin/credits
 * Ajuste manual de créditos para un alumno.
 * Solo accesible para STUDIO_ADMIN del mismo estudio.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
): Promise<NextResponse> {
  const { studio } = await params

  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId, session } = guard

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: { studentUserId?: unknown; amount?: unknown; note?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { studentUserId, amount, note } = body

  if (typeof studentUserId !== 'string' || !studentUserId) {
    return NextResponse.json({ error: 'studentUserId requerido' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: 'amount debe ser un entero distinto de 0' }, { status: 400 })
  }
  if (typeof note !== 'string' || !note.trim()) {
    return NextResponse.json({ error: 'note (motivo) es obligatorio' }, { status: 400 })
  }

  // ── Servicio ──────────────────────────────────────────────────────────────
  try {
    const result = await adminAdjustCredits({
      adminUserId: session.user.id,
      studentUserId,
      studioId,
      amount,
      note: note.trim(),
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
