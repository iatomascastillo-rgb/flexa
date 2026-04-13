export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

// ── POST /api/cron/expired-packages ──────────────────────────────────────────
//
// Se ejecuta diariamente a las 12:00 UTC.
// Detecta paquetes que vencieron ayer con créditos > 0 en estudios Pro,
// agrupa por estudio y envía 1 email al STUDIO_ADMIN con la lista de alumnas.
// Idempotente: usa PlatformEvent con type='EXPIRED_PKG_ALERT' y data.date=YYYY-MM-DD.

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10) // 'YYYY-MM-DD'

  // Ventana: paquetes que vencieron ayer
  const startOfYesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const startOfToday     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // Obtener estudios Pro activos con paquetes vencidos ayer con créditos
  const packages = await prisma.userPackage.findMany({
    where: {
      paymentStatus: 'APPROVED',
      classesRemaining: { gt: 0 },
      expiresAt: { gte: startOfYesterday, lt: startOfToday },
      studio: {
        active: true,
        subscription: { plan: 'PRO', status: { in: ['ACTIVE', 'TRIAL'] } },
      },
    },
    select: {
      classesRemaining: true,
      studioId: true,
      user: { select: { name: true } },
    },
  })

  if (packages.length === 0) {
    return NextResponse.json({ ok: true, studiosProcessed: 0, results: [] })
  }

  // Agrupar por studioId
  const byStudio = new Map<string, Array<{ name: string; credits: number }>>()
  for (const pkg of packages) {
    if (!byStudio.has(pkg.studioId)) byStudio.set(pkg.studioId, [])
    byStudio.get(pkg.studioId)!.push({
      name: pkg.user.name ?? 'Alumna',
      credits: pkg.classesRemaining,
    })
  }

  interface Result {
    studioId: string
    sent: boolean
    reason?: string
    error?: string
  }
  const results: Result[] = []

  for (const [studioId, students] of byStudio) {
    try {
      // Idempotencia: ya se envió hoy para este estudio?
      const alreadySent = await prisma.platformEvent.findFirst({
        where: {
          studioId,
          type: 'EXPIRED_PKG_ALERT',
          createdAt: { gte: startOfToday },
        },
        select: { id: true },
      })
      if (alreadySent) {
        results.push({ studioId, sent: false, reason: 'already_sent_today' })
        continue
      }

      const studioRecord = await prisma.studio.findUnique({
        where: { id: studioId },
        select: { name: true, slug: true },
      })
      const admin = await prisma.user.findFirst({
        where: { studioId, role: 'STUDIO_ADMIN' },
        select: { email: true, name: true },
      })

      if (!admin || !studioRecord) {
        results.push({ studioId, sent: false, reason: 'no_admin_or_studio' })
        continue
      }

      await sendEmail(admin.email, 'expired-packages-pro-alert', {
        adminName: admin.name ?? 'Admin',
        studioName: studioRecord.name,
        studioSlug: studioRecord.slug,
        students,
        date: todayKey,
      })

      await prisma.platformEvent.create({
        data: { studioId, type: 'EXPIRED_PKG_ALERT', data: { date: todayKey } },
      })

      results.push({ studioId, sent: true })
    } catch (err) {
      console.error(`[cron/expired-packages] Error studio=${studioId}:`, err)
      results.push({
        studioId,
        sent: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    studiosProcessed: byStudio.size,
    studiosSent: results.filter((r) => r.sent).length,
    results,
  })
}
