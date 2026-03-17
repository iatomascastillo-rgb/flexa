export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateForStudio } from '@/services/recurring.service'
import type { StudioResult } from '@/services/recurring.service'

// Vercel: extender timeout a 5 minutos para estudios grandes
export const maxDuration = 300

// Cuántos estudios procesamos en paralelo.
// 5 es el punto óptimo: suficiente paralelismo sin saturar el pool de conexiones.
const BATCH_CONCURRENCY = 5

// ── POST /api/cron/generate-month ─────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Calcular mes siguiente (el cron se ejecuta el día 25 del mes actual)
  const now = new Date()
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
  const nextMonth = (now.getMonth() + 1) % 12 // 0-indexed

  // Estudios activos con suscripción vigente
  const studios = await prisma.studio.findMany({
    where: {
      active: true,
      subscription: { status: { in: ['TRIAL', 'ACTIVE'] } },
    },
    select: { id: true },
  })

  const results: StudioResult[] = []

  // Procesar en batches de BATCH_CONCURRENCY estudios en paralelo.
  // Promise.allSettled garantiza que un error en un estudio no cancela los demás.
  for (let i = 0; i < studios.length; i += BATCH_CONCURRENCY) {
    const batch = studios.slice(i, i + BATCH_CONCURRENCY)

    const settled = await Promise.allSettled(
      batch.map((studio) => generateForStudio(studio.id, nextYear, nextMonth)),
    )

    for (let j = 0; j < batch.length; j++) {
      const studioId = batch[j].id
      const outcome = settled[j]

      if (outcome.status === 'fulfilled') {
        results.push({ studioId, ...outcome.value })

        // Email resumen al admin — fuera de la lógica principal
        try {
          // TODO: sendNotification CRON_GENERATE_SUMMARY con outcome.value
          // await sendEmail({ studioId, type: 'CRON_SUMMARY', data: outcome.value })
        } catch (emailErr) {
          console.error(`[cron/generate-month] Error sending summary email studio=${studioId}:`, emailErr)
        }
      } else {
        const err = outcome.reason
        console.error(`[cron/generate-month] Fatal error studio=${studioId}:`, err)
        results.push({
          studioId,
          sessionsGenerated: 0,
          bookingsCredit: 0,
          bookingsGrace: 0,
          skippedAlreadyBooked: 0,
          skippedFull: 0,
          alertUserIds: [],
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  const month = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
  const errors = results.filter((r) => r.error)

  return NextResponse.json({
    ok: true,
    month,
    studiosProcessed: studios.length,
    studiosOk: results.length - errors.length,
    studiosError: errors.length,
    results,
  })
}
