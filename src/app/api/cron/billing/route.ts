export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail, type EmailTemplate } from '@/lib/email'
import { todayARStart } from '@/lib/formatters'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Días completos entre dos fechas (positivo si dateB > dateA) */
function daysBetween(dateA: Date, dateB: Date): number {
  const msA = Date.UTC(dateA.getFullYear(), dateA.getMonth(), dateA.getDate())
  const msB = Date.UTC(dateB.getFullYear(), dateB.getMonth(), dateB.getDate())
  return Math.floor((msB - msA) / (1000 * 60 * 60 * 24))
}

async function sendBillingEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, unknown>,
): Promise<void> {
  await sendEmail(to, template, data)
}

type BillingEmailTemplate = EmailTemplate

// ── Tipos de resultado ─────────────────────────────────────────────────────────

interface StudioResult {
  studioId: string
  studioName: string
  action: string
  emailsSent: string[]
  error?: string
}

// ── Handler principal ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = todayARStart()
  const results: StudioResult[] = []

  // ── Obtener suscripciones activas ─────────────────────────────────────────
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIAL', 'TRIAL_EXPIRED', 'PAST_DUE'] },
    },
    include: {
      studio: {
        select: {
          id: true,
          name: true,
          active: true,
          users: {
            where: { role: 'STUDIO_ADMIN', active: true },
            select: { email: true, name: true },
            take: 1,
          },
        },
      },
    },
  })

  // ── Procesar cada suscripción ─────────────────────────────────────────────
  for (const sub of subscriptions) {
    const studioId = sub.studioId
    const studioName = sub.studio.name
    const adminEmail = sub.studio.users[0]?.email
    const adminName = sub.studio.users[0]?.name ?? 'Admin'

    const result: StudioResult = {
      studioId,
      studioName,
      action: 'none',
      emailsSent: [],
    }

    try {
      // ── TRIAL ──────────────────────────────────────────────────────────────
      if (sub.status === 'TRIAL') {
        if (!sub.trialEndsAt) {
          result.action = 'skipped:no-trialEndsAt'
          results.push(result)
          continue
        }

        const daysUntilExpiry = daysBetween(today, sub.trialEndsAt)

        if (daysUntilExpiry <= 0) {
          // Idempotencia: verificar si ya fue expirado hoy
          const alreadyExpired = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'TRIAL_EXPIRED' },
          })

          if (!alreadyExpired) {
            await prisma.$transaction([
              prisma.subscription.update({
                where: { studioId },
                data: { status: 'TRIAL_EXPIRED' },
              }),
              prisma.platformEvent.create({
                data: {
                  studioId,
                  type: 'TRIAL_EXPIRED',
                  data: { trialEndsAt: sub.trialEndsAt, processedAt: today },
                },
              }),
            ])

            result.action = 'TRIAL → TRIAL_EXPIRED'

            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'trial-vencido', {
                studioName,
                adminName,
                trialEndsAt: sub.trialEndsAt,
              }).catch((e) => console.error('[billing] email error trial-vencido', e))
              result.emailsSent.push('trial-vencido')
            }
          } else {
            result.action = 'skipped:already-TRIAL_EXPIRED'
          }
        }
      }

      // ── TRIAL_EXPIRED ──────────────────────────────────────────────────────
      else if (sub.status === 'TRIAL_EXPIRED') {
        if (!sub.trialEndsAt) {
          result.action = 'skipped:no-trialEndsAt'
          results.push(result)
          continue
        }

        const daysSinceExpiry = daysBetween(sub.trialEndsAt, today)

        if (daysSinceExpiry === 1) {
          // Email "tenés 2 días antes de la suspensión"
          const alreadySent = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'TRIAL_WARNING_2D' },
          })
          if (!alreadySent) {
            await prisma.platformEvent.create({
              data: {
                studioId,
                type: 'TRIAL_WARNING_2D',
                data: { daysSinceExpiry, processedAt: today },
              },
            })
            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'trial-warning-2d', {
                studioName,
                adminName,
                suspendedAt: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
              }).catch((e) => console.error('[billing] email error trial-warning-2d', e))
              result.emailsSent.push('trial-warning-2d')
            }
            result.action = 'sent:TRIAL_WARNING_2D'
          } else {
            result.action = 'skipped:TRIAL_WARNING_2D already sent'
          }
        } else if (daysSinceExpiry === 2) {
          // Email "mañana se suspende"
          const alreadySent = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'TRIAL_WARNING_1D' },
          })
          if (!alreadySent) {
            await prisma.platformEvent.create({
              data: {
                studioId,
                type: 'TRIAL_WARNING_1D',
                data: { daysSinceExpiry, processedAt: today },
              },
            })
            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'trial-warning-1d', {
                studioName,
                adminName,
                suspendedAt: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
              }).catch((e) => console.error('[billing] email error trial-warning-1d', e))
              result.emailsSent.push('trial-warning-1d')
            }
            result.action = 'sent:TRIAL_WARNING_1D'
          } else {
            result.action = 'skipped:TRIAL_WARNING_1D already sent'
          }
        } else if (daysSinceExpiry >= 3) {
          // Suspender
          const alreadySuspended = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'STUDIO_SUSPENDED_TRIAL' },
          })
          if (!alreadySuspended) {
            await prisma.$transaction([
              prisma.subscription.update({
                where: { studioId },
                data: { status: 'SUSPENDED' },
              }),
              prisma.studio.update({
                where: { id: studioId },
                data: { active: false },
              }),
              prisma.platformEvent.create({
                data: {
                  studioId,
                  type: 'STUDIO_SUSPENDED_TRIAL',
                  data: { daysSinceExpiry, processedAt: today },
                },
              }),
            ])
            result.action = 'TRIAL_EXPIRED → SUSPENDED'

            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'trial-suspendido', {
                studioName,
                adminName,
              }).catch((e) => console.error('[billing] email error trial-suspendido', e))
              result.emailsSent.push('trial-suspendido')
            }
          } else {
            result.action = 'skipped:already-SUSPENDED'
          }
        } else {
          result.action = 'none:grace-period-not-exhausted'
        }
      }

      // ── PAST_DUE ───────────────────────────────────────────────────────────
      else if (sub.status === 'PAST_DUE') {
        const referenceDate = sub.currentPeriodEnd ?? sub.updatedAt
        const daysSinceDue = daysBetween(referenceDate, today)

        if (daysSinceDue === 1) {
          const alreadySent = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'PASTDUE_WARNING_1D' },
          })
          if (!alreadySent) {
            await prisma.platformEvent.create({
              data: {
                studioId,
                type: 'PASTDUE_WARNING_1D',
                data: { daysSinceDue, processedAt: today },
              },
            })
            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'pastdue-warning-1d', {
                studioName,
                adminName,
              }).catch((e) => console.error('[billing] email error pastdue-warning-1d', e))
              result.emailsSent.push('pastdue-warning-1d')
            }
            result.action = 'sent:PASTDUE_WARNING_1D'
          } else {
            result.action = 'skipped:PASTDUE_WARNING_1D already sent'
          }
        } else if (daysSinceDue >= 7) {
          const alreadySuspended = await prisma.platformEvent.findFirst({
            where: { studioId, type: 'STUDIO_SUSPENDED_PASTDUE' },
          })
          if (!alreadySuspended) {
            await prisma.$transaction([
              prisma.subscription.update({
                where: { studioId },
                data: { status: 'SUSPENDED' },
              }),
              prisma.studio.update({
                where: { id: studioId },
                data: { active: false },
              }),
              prisma.platformEvent.create({
                data: {
                  studioId,
                  type: 'STUDIO_SUSPENDED_PASTDUE',
                  data: { daysSinceDue, processedAt: today },
                },
              }),
            ])
            result.action = 'PAST_DUE → SUSPENDED'

            if (adminEmail) {
              await sendBillingEmail(adminEmail, 'pastdue-suspendido', {
                studioName,
                adminName,
              }).catch((e) => console.error('[billing] email error pastdue-suspendido', e))
              result.emailsSent.push('pastdue-suspendido')
            }
          } else {
            result.action = 'skipped:already-SUSPENDED'
          }
        } else {
          result.action = `none:daysSinceDue=${daysSinceDue}`
        }
      }
    } catch (err) {
      result.action = 'error'
      result.error = err instanceof Error ? err.message : String(err)
      console.error(`[cron/billing] Error studioId=${studioId}:`, err)
    }

    results.push(result)
  }

  // ── Resumen al Super Admin ─────────────────────────────────────────────────
  const changes = results.filter((r) => r.action !== 'none' && !r.action.startsWith('skipped') && !r.action.startsWith('none'))
  const errors = results.filter((r) => r.action === 'error')

  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { email: true },
    })

    for (const sa of superAdmins) {
      await sendBillingEmail(sa.email, 'admin-resumen', {
        processedAt: today,
        totalProcessed: subscriptions.length,
        changes: changes.map((r) => ({ studioName: r.studioName, action: r.action })),
        errors: errors.map((r) => ({ studioName: r.studioName, error: r.error })),
      })
    }
  } catch (err) {
    console.error('[cron/billing] Error sending super admin summary:', err)
  }

  console.log(`[cron/billing] Done. processed=${subscriptions.length} changes=${changes.length} errors=${errors.length}`)

  return NextResponse.json({
    ok: true,
    date: today.toISOString().split('T')[0],
    totalProcessed: subscriptions.length,
    changes: changes.length,
    errors: errors.length,
    results,
  })
}
