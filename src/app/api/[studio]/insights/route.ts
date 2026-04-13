export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { getOrGenerateInsight, type InsightType } from '@/services/insights.service'

const ALLOWED_TYPES: InsightType[] = ['monthly_summary', 'churn_risk', 'schedule_optimization']

// ── Helper: verificar acceso a IA ─────────────────────────────────────────────
//
// Tiene acceso si:
//   - Plan PRO → siempre
//   - Plan BASICO + aiInsightTrialEndsAt > now → trial activo
// SUPER_ADMIN siempre tiene acceso (para testing/soporte)

interface AiAccessResult {
  allowed: boolean
  isPro: boolean
  trialEndsAt: Date | null
  trialDaysLeft: number | null
}

function checkAiAccess(
  sub: { plan: string; aiInsightTrialEndsAt: Date | null } | null,
  isSuperAdmin: boolean,
): AiAccessResult {
  if (isSuperAdmin) {
    return { allowed: true, isPro: true, trialEndsAt: null, trialDaysLeft: null }
  }
  if (!sub) {
    return { allowed: false, isPro: false, trialEndsAt: null, trialDaysLeft: null }
  }
  if (sub.plan === 'PRO') {
    return { allowed: true, isPro: true, trialEndsAt: null, trialDaysLeft: null }
  }
  // BASICO: revisar trial
  const now = new Date()
  const trialActive = sub.aiInsightTrialEndsAt !== null && sub.aiInsightTrialEndsAt > now
  const trialDaysLeft = trialActive
    ? Math.ceil((sub.aiInsightTrialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  return {
    allowed: trialActive,
    isPro: false,
    trialEndsAt: sub.aiInsightTrialEndsAt,
    trialDaysLeft,
  }
}

// ── POST /api/[studio]/insights ───────────────────────────────────────────────
//
// Body:     { type: InsightType }
// Response: { content, cachedAt, fromCache, trialDaysLeft? }
//   ó 403:  { error, upgradeRequired: true }
//
// Seguridad:
//   - Solo STUDIO_ADMIN y SUPER_ADMIN pueden generar insights
//   - studioId siempre del servidor (session + tenant), nunca del body
//   - ANTHROPIC_API_KEY server-side only, nunca expuesto al cliente
//   - BASICO sin trial activo → 403 con upgradeRequired: true

export async function POST(
  req: NextRequest,
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

  // SUPER_ADMIN puede acceder a cualquier estudio; STUDIO_ADMIN solo al propio
  if (session.user.role === 'STUDIO_ADMIN' && session.user.studioId !== tenant.studioId) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
  }

  // ── Verificar acceso a IA según plan ────────────────────────────────────────
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN'
  if (!isSuperAdmin) {
    const sub = await prisma.subscription.findUnique({
      where: { studioId: tenant.studioId },
      select: { plan: true, aiInsightTrialEndsAt: true },
    })
    const access = checkAiAccess(sub, false)
    if (!access.allowed) {
      return NextResponse.json(
        {
          error: 'Esta función requiere el plan Pro o un período de prueba activo.',
          upgradeRequired: true,
        },
        { status: 403 },
      )
    }
  }

  // ── Parsear body ────────────────────────────────────────────────────────────
  let type: InsightType
  try {
    const body = (await req.json()) as { type?: unknown }
    if (!body.type || !ALLOWED_TYPES.includes(body.type as InsightType)) {
      return NextResponse.json(
        { error: `Tipo inválido. Permitidos: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 },
      )
    }
    type = body.type as InsightType
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  // ── Límite diario de llamadas frescas a la IA ───────────────────────────────
  // Máx. 20 generaciones frescas por estudio por día (AR). Las respuestas cacheadas
  // no cuentan — este límite solo aplica a llamadas reales a Claude.
  if (!isSuperAdmin) {
    const startOfTodayAR = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }).split(',')[0]
      + 'T00:00:00-03:00'
    )
    const todayCallCount = await prisma.aiInsight.count({
      where: {
        studioId: tenant.studioId,
        createdAt: { gte: startOfTodayAR },
      },
    })
    if (todayCallCount >= 20) {
      return NextResponse.json(
        { error: 'Límite diario de análisis alcanzado. Los análisis se regeneran automáticamente cada 6 horas.' },
        { status: 429 },
      )
    }
  }

  // ── Generar o devolver análisis cacheado ────────────────────────────────────
  try {
    const result = await getOrGenerateInsight({
      studioId: tenant.studioId,
      type,
      requestingUserId: session.user.id,
    })
    return NextResponse.json({
      content: result.content,
      cachedAt: result.cachedAt.toISOString(),
      fromCache: result.fromCache,
    })
  } catch (err) {
    console.error('[insights] Error generando insight:', err)
    // Propagar mensajes del servicio (user-safe), bloquear errores del SDK o internos
    const isSafeMsg = err instanceof Error && err.name !== 'APIError' && err.name !== 'AnthropicError'
    const message = isSafeMsg && err.message
      ? err.message
      : 'Error al generar el análisis. Intentá de nuevo.'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
