export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateForStudio } from '@/services/recurring.service'

export const maxDuration = 120

/**
 * POST /api/cron/test-recurring
 *
 * Ejecuta (o simula) el cron de reservas recurrentes para un estudio y mes dados.
 * Accesible por SUPER_ADMIN, STUDIO_ADMIN (del mismo estudio), o con CRON_SECRET.
 *
 * Body:
 *   studioId  string   — ID del estudio
 *   year      number   — año del mes objetivo
 *   month     number   — mes 0-indexed (0=ene … 11=dic)
 *   dryRun?   boolean  — si true, rollback completo sin persistir nada
 *   fromDate? string   — ISO date (YYYY-MM-DD). Si se pasa, solo procesa sesiones
 *                        desde esa fecha en adelante (útil para ejecutar mid-month)
 *
 * Response: { ok, month, fromDate?, dryRun, studio, summary, decisions[] }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const isCronSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`

  let callerStudioId: string | null = null

  if (!isCronSecret) {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'STUDIO_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // STUDIO_ADMIN solo puede ejecutar para su propio estudio
    if (session.user.role === 'STUDIO_ADMIN') {
      callerStudioId = session.user.studioId
    }
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  let body: { studioId?: unknown; year?: unknown; month?: unknown; dryRun?: unknown; fromDate?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  const { studioId, year, month, dryRun, fromDate: fromDateRaw } = body

  if (typeof studioId !== 'string' || !studioId) {
    return NextResponse.json({ error: 'studioId requerido' }, { status: 400 })
  }
  if (typeof year !== 'number' || typeof month !== 'number') {
    return NextResponse.json({ error: 'year y month requeridos (número, month 0-indexed)' }, { status: 400 })
  }
  if (month < 0 || month > 11) {
    return NextResponse.json({ error: 'month debe ser 0-11' }, { status: 400 })
  }

  // STUDIO_ADMIN no puede ejecutar para otro estudio
  if (callerStudioId && callerStudioId !== studioId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // fromDate opcional — YYYY-MM-DD
  let fromDate: Date | undefined
  if (fromDateRaw !== undefined) {
    if (typeof fromDateRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fromDateRaw)) {
      return NextResponse.json({ error: 'fromDate debe ser YYYY-MM-DD' }, { status: 400 })
    }
    fromDate = new Date(`${fromDateRaw}T00:00:00Z`)
    if (isNaN(fromDate.getTime())) {
      return NextResponse.json({ error: 'fromDate inválida' }, { status: 400 })
    }
  }

  // Verificar que el estudio existe
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    select: { id: true, name: true, slug: true },
  })
  if (!studio) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }

  const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`
  const opts = { verbose: true, fromDate }

  // ── Dry-run ───────────────────────────────────────────────────────────────
  if (dryRun === true) {
    let capturedResult: Awaited<ReturnType<typeof generateForStudio>> | null = null

    try {
      await prisma.$transaction(async () => {
        capturedResult = await generateForStudio(studioId, year, month, opts)
        throw new DryRunRollback()
      })
    } catch (err) {
      if (!(err instanceof DryRunRollback)) {
        console.error('[test-recurring] Error durante dry-run:', err)
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Error interno' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      ok: true,
      month: monthLabel,
      ...(fromDate ? { fromDate: fromDate.toISOString().slice(0, 10) } : {}),
      studio: { id: studio.id, name: studio.name, slug: studio.slug },
      dryRun: true,
      summary: {
        sessionsGenerated: capturedResult!.sessionsGenerated,
        bookingsCredit: capturedResult!.bookingsCredit,
        bookingsGrace: capturedResult!.bookingsGrace,
        skippedAlreadyBooked: capturedResult!.skippedAlreadyBooked,
        skippedFull: capturedResult!.skippedFull,
        alertUserIds: capturedResult!.alertUserIds,
      },
      decisions: capturedResult!.decisions ?? [],
    })
  }

  // ── Ejecución real ────────────────────────────────────────────────────────
  try {
    const result = await generateForStudio(studioId, year, month, opts)
    return NextResponse.json({
      ok: true,
      month: monthLabel,
      ...(fromDate ? { fromDate: fromDate.toISOString().slice(0, 10) } : {}),
      studio: { id: studio.id, name: studio.name, slug: studio.slug },
      dryRun: false,
      summary: {
        sessionsGenerated: result.sessionsGenerated,
        bookingsCredit: result.bookingsCredit,
        bookingsGrace: result.bookingsGrace,
        skippedAlreadyBooked: result.skippedAlreadyBooked,
        skippedFull: result.skippedFull,
        alertUserIds: result.alertUserIds,
      },
      decisions: result.decisions ?? [],
    })
  } catch (err) {
    console.error('[test-recurring] Error durante ejecución real:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

class DryRunRollback extends Error {
  constructor() { super('DryRunRollback') }
}
