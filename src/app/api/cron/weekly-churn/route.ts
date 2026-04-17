export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── Constantes ────────────────────────────────────────────────────────────────

const CHURN_THRESHOLD = 3 // mín. alumnas en riesgo para disparar alerta

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Métricas de churn para un estudio: en riesgo = activos 45d pero no en últimos 14d */
async function getChurnMetrics(studioId: string): Promise<{
  studentsAtRisk: number
  studentsExpiredPackage: number
}> {
  const now = new Date()
  const cutoff45d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [active45d, active14d, expiredPackages] = await Promise.all([
    prisma.user.count({
      where: {
        studioId, role: 'STUDENT', active: true,
        bookings: { some: { status: 'CONFIRMED', classSession: { date: { gte: cutoff45d } } } },
      },
    }),
    prisma.user.count({
      where: {
        studioId, role: 'STUDENT', active: true,
        bookings: { some: { status: 'CONFIRMED', classSession: { date: { gte: cutoff14d } } } },
      },
    }),
    prisma.userPackage.count({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        expiresAt: { lt: now },
        classesRemaining: { gt: 0 },
      },
    }),
  ])

  return {
    studentsAtRisk: Math.max(0, active45d - active14d),
    studentsExpiredPackage: expiredPackages,
  }
}

// ── POST /api/cron/weekly-churn ───────────────────────────────────────────────
//
// Se ejecuta cada lunes a las 10:00 UTC (07:00 Argentina).
// Envía alerta de churn al STUDIO_ADMIN si el estudio tiene ≥ CHURN_THRESHOLD
// alumnas en riesgo de abandono. Idempotente: no reenvía si ya se envió en los
// últimos 7 días para ese estudio (guarda PlatformEvent por estudio).

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const studios = await prisma.studio.findMany({
    where: {
      active: true,
      subscription: { status: { in: ['TRIAL', 'ACTIVE'] } },
    },
    select: { id: true, name: true, slug: true },
  })

  interface ChurnResult {
    studioId: string
    studioName: string
    sent: boolean
    reason?: string
    studentsAtRisk?: number
    error?: string
  }

  const results: ChurnResult[] = []

  for (const studio of studios) {
    try {
      // Idempotencia: verificar si ya se envió esta semana para este estudio
      const alreadySent = await prisma.platformEvent.findFirst({
        where: {
          studioId: studio.id,
          type: 'WEEKLY_CHURN_ALERT',
          createdAt: { gte: cutoff7d },
        },
        select: { id: true },
      })
      if (alreadySent) {
        results.push({ studioId: studio.id, studioName: studio.name, sent: false, reason: 'already_sent_this_week' })
        continue
      }

      const { studentsAtRisk, studentsExpiredPackage } = await getChurnMetrics(studio.id)

      if (studentsAtRisk < CHURN_THRESHOLD) {
        results.push({ studioId: studio.id, studioName: studio.name, sent: false, reason: 'below_threshold', studentsAtRisk })
        continue
      }

      const admin = await prisma.user.findFirst({
        where: { studioId: studio.id, role: 'STUDIO_ADMIN' },
        select: { email: true, name: true },
      })
      if (!admin) {
        results.push({ studioId: studio.id, studioName: studio.name, sent: false, reason: 'no_admin' })
        continue
      }

      await sendEmail(admin.email, 'churn-alert-admin', {
        adminName: admin.name ?? 'Admin',
        studioName: studio.name,
        studioSlug: studio.slug,
        studentsAtRisk,
        studentsExpiredPackage,
      })

      // Registrar evento para idempotencia
      await prisma.platformEvent.create({
        data: { studioId: studio.id, type: 'WEEKLY_CHURN_ALERT' },
      })

      results.push({ studioId: studio.id, studioName: studio.name, sent: true, studentsAtRisk })
    } catch (err) {
      console.error(`[cron/weekly-churn] Error studio=${studio.id}:`, err)
      results.push({
        studioId: studio.id,
        studioName: studio.name,
        sent: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    studiosProcessed: studios.length,
    studiosSent: results.filter((r) => r.sent).length,
    results,
  })
}
