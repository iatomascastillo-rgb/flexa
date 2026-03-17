import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

// ── Constantes ────────────────────────────────────────────────────────────────

const INSIGHT_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas
const MAX_TOKENS = 800
const MODEL = 'claude-haiku-4-5-20251001' as const

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type InsightType = 'monthly_summary' | 'churn_risk' | 'schedule_optimization'

export interface InsightResult {
  content: string
  cachedAt: Date
  fromCache: boolean
}

// ── Tipos internos de agregación (nunca contienen PII) ────────────────────────

interface MonthlySummaryData {
  monthLabel: string
  revenueARS: number
  prevMonthRevenueARS: number
  revenueVariationPct: number | null
  totalSessions: number
  avgOccupancyPct: number
  totalConfirmedBookings: number
  monthNoShows: number
  monthCancellations: number
  totalActiveStudents: number
  newStudentsThisMonth: number
  studentsWithoutActivity: number
  topClassTypes: Array<{ name: string; bookingCount: number }>
  revenueByMethod: { mercadopago: number; cash: number }
}

interface ChurnRiskData {
  totalActiveStudents: number
  studentsAtRisk: number
  studentsExpiredPackage: number
  mostAffectedClassTypes: Array<{ name: string; dropCount: number }>
}

interface ScheduleOptimizationData {
  monthLabel: string
  totalSessions: number
  avgOccupancyPct: number
  underperformingSlots: Array<{ dayOfWeek: string; time: string; avgOccupancyPct: number }>
  topSlots: Array<{ dayOfWeek: string; time: string; avgOccupancyPct: number }>
  sessionsByDayTime: Array<{
    dayOfWeek: string
    time: string
    sessionCount: number
    avgOccupancyPct: number
    totalBookings: number
  }>
}

// ── Función principal exportada ───────────────────────────────────────────────

/**
 * Retorna el análisis de IA para el estudio y tipo solicitado.
 * Si existe un resultado cacheado de menos de 6 horas, lo devuelve sin llamar a Claude.
 * En cada generación fresca, escribe AuditLog.
 */
export async function getOrGenerateInsight(params: {
  studioId: string
  type: InsightType
  requestingUserId: string
}): Promise<InsightResult> {
  const { studioId, type, requestingUserId } = params

  // ── 1. Verificar caché ──────────────────────────────────────────────────────
  const cached = await prisma.aiInsight.findFirst({
    where: { studioId, type },
    orderBy: { createdAt: 'desc' },
    select: { content: true, createdAt: true },
  })

  if (cached && Date.now() - cached.createdAt.getTime() < INSIGHT_TTL_MS) {
    return { content: cached.content, cachedAt: cached.createdAt, fromCache: true }
  }

  // ── 2. Verificar API key ────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Análisis de IA no disponible en este momento.')
  }

  // ── 3. Agregar datos según tipo ─────────────────────────────────────────────
  let systemPrompt: string
  let userPrompt: string
  let inputData: Record<string, unknown>

  if (type === 'monthly_summary') {
    const data = await aggregateMonthlySummary(studioId)
    inputData = data as unknown as Record<string, unknown>
    systemPrompt = SYSTEM_MONTHLY_SUMMARY
    userPrompt = buildMonthlySummaryPrompt(data)
  } else if (type === 'churn_risk') {
    const data = await aggregateChurnRisk(studioId)
    inputData = data as unknown as Record<string, unknown>
    systemPrompt = SYSTEM_CHURN_RISK
    userPrompt = buildChurnRiskPrompt(data)
  } else {
    const data = await aggregateScheduleOptimization(studioId)
    inputData = data as unknown as Record<string, unknown>
    systemPrompt = SYSTEM_SCHEDULE_OPTIMIZATION
    userPrompt = buildScheduleOptimizationPrompt(data)
  }

  // ── 4. Llamar a Claude ──────────────────────────────────────────────────────
  const content = await callClaude(systemPrompt, userPrompt)

  if (content.length > 4000) {
    throw new Error('Error al procesar el análisis. Intentá de nuevo.')
  }

  // ── 5. Persistir resultado + AuditLog ──────────────────────────────────────
  const now = new Date()
  const newInsight = await prisma.$transaction(async (tx) => {
    const insight = await tx.aiInsight.create({
      data: { studioId, type, content, inputData: JSON.parse(JSON.stringify(inputData)) },
      select: { id: true, createdAt: true },
    })
    await tx.auditLog.create({
      data: {
        studioId,
        userId: requestingUserId,
        action: 'AI_INSIGHT_GENERATED',
        entityType: 'AiInsight',
        entityId: insight.id,
        metadata: { type, fromCache: false },
      },
    })
    return insight
  })

  return { content, cachedAt: newInsight.createdAt ?? now, fromCache: false }
}

// ── Helpers de agregación ─────────────────────────────────────────────────────

function arMonthStart(): Date {
  const arNow = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return new Date(Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), 1))
}

function prevMonthStart(month: Date): Date {
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1))
}

function monthLabelES(date: Date): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`
}

async function aggregateMonthlySummary(studioId: string): Promise<MonthlySummaryData> {
  const monthStart = arMonthStart()
  const prevStart = prevMonthStart(monthStart)
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))

  const [
    monthlyPackages,
    prevMonthPackages,
    newStudentsThisMonth,
    totalActiveStudents,
    activeWithBookings,
    monthCancellations,
    sessionsThisMonth,
    bookingsThisMonth,
    noShowsThisMonth,
    classTypeBookings,
  ] = await Promise.all([
    prisma.userPackage.findMany({
      where: { studioId, paymentStatus: 'APPROVED', activatedAt: { gte: monthStart }, packageId: { not: null } },
      select: { package: { select: { price: true } }, paymentMethod: true },
    }),
    prisma.userPackage.findMany({
      where: { studioId, paymentStatus: 'APPROVED', activatedAt: { gte: prevStart, lt: monthStart }, packageId: { not: null } },
      select: { package: { select: { price: true } } },
    }),
    prisma.user.count({ where: { studioId, role: 'STUDENT', createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { studioId, role: 'STUDENT', active: true } }),
    prisma.user.count({
      where: {
        studioId, role: 'STUDENT', active: true,
        bookings: { some: { status: 'CONFIRMED', classSession: { date: { gte: monthStart } } } },
      },
    }),
    prisma.booking.count({ where: { studioId, status: 'CANCELLED', cancelledAt: { gte: monthStart } } }),
    prisma.classSession.findMany({
      where: { studioId, cancelledAt: null, date: { gte: monthStart, lt: nextMonthStart } },
      select: {
        capacityOverride: true,
        _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
        classType: { select: { defaultCapacity: true } },
      },
    }),
    prisma.booking.count({
      where: { studioId, status: 'CONFIRMED', classSession: { date: { gte: monthStart, lt: nextMonthStart } } },
    }),
    prisma.booking.count({
      where: { studioId, attendanceStatus: 'NO_SHOW', classSession: { date: { gte: monthStart, lt: nextMonthStart } } },
    }),
    prisma.booking.groupBy({
      by: ['classSessionId'],
      where: { studioId, status: 'CONFIRMED', classSession: { date: { gte: monthStart, lt: nextMonthStart } } },
      _count: { id: true },
    }),
  ])

  // Ingresos (precio en centavos → pesos)
  const revenueARS = monthlyPackages.reduce((s, p) => s + (p.package?.price ?? 0) / 100, 0)
  const prevMonthRevenueARS = prevMonthPackages.reduce((s, p) => s + (p.package?.price ?? 0) / 100, 0)
  const revenueVariationPct = prevMonthRevenueARS > 0
    ? Math.round(((revenueARS - prevMonthRevenueARS) / prevMonthRevenueARS) * 100)
    : null

  const revenueByMethod = {
    mercadopago: monthlyPackages.filter(p => p.paymentMethod === 'MERCADOPAGO').reduce((s, p) => s + (p.package?.price ?? 0) / 100, 0),
    cash: monthlyPackages.filter(p => p.paymentMethod !== 'MERCADOPAGO').reduce((s, p) => s + (p.package?.price ?? 0) / 100, 0),
  }

  // Ocupación promedio (capacityOverride tiene prioridad sobre defaultCapacity)
  const totalCapacity = sessionsThisMonth.reduce((s, sess) => s + (sess.capacityOverride ?? sess.classType?.defaultCapacity ?? 10), 0)
  const avgOccupancyPct = (totalCapacity > 0 && sessionsThisMonth.length > 0)
    ? Math.round((bookingsThisMonth / totalCapacity) * 100)
    : 0

  // Alumnos sin actividad
  const studentsWithoutActivity = Math.max(0, totalActiveStudents - activeWithBookings)

  // Top clases por tipo (necesitamos join con classSession → classType)
  const sessionIds = classTypeBookings.map(b => b.classSessionId)
  const topClassTypesRaw = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, classType: { select: { name: true } } },
  })
  const classTypeMap: Record<string, string> = {}
  for (const s of topClassTypesRaw) classTypeMap[s.id] = s.classType.name

  const bookingsByType: Record<string, number> = {}
  for (const b of classTypeBookings) {
    const name = classTypeMap[b.classSessionId] ?? 'Otro'
    bookingsByType[name] = (bookingsByType[name] ?? 0) + b._count.id
  }
  const topClassTypes = Object.entries(bookingsByType)
    .map(([name, bookingCount]) => ({ name, bookingCount }))
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .slice(0, 3)

  return {
    monthLabel: monthLabelES(monthStart),
    revenueARS: Math.round(revenueARS),
    prevMonthRevenueARS: Math.round(prevMonthRevenueARS),
    revenueVariationPct,
    totalSessions: sessionsThisMonth.length,
    avgOccupancyPct,
    totalConfirmedBookings: bookingsThisMonth,
    monthNoShows: noShowsThisMonth,
    monthCancellations,
    totalActiveStudents,
    newStudentsThisMonth,
    studentsWithoutActivity,
    topClassTypes,
    revenueByMethod: {
      mercadopago: Math.round(revenueByMethod.mercadopago),
      cash: Math.round(revenueByMethod.cash),
    },
  }
}

async function aggregateChurnRisk(studioId: string): Promise<ChurnRiskData> {
  const now = new Date()
  const cutoff45d = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [totalActiveStudents, studentsActive45d, studentsActive14d, expiredPackages] = await Promise.all([
    prisma.user.count({ where: { studioId, role: 'STUDENT', active: true } }),
    // Tuvieron al menos 1 reserva en los últimos 45 días
    prisma.user.count({
      where: {
        studioId, role: 'STUDENT', active: true,
        bookings: { some: { status: 'CONFIRMED', classSession: { date: { gte: cutoff45d } } } },
      },
    }),
    // Tuvieron al menos 1 reserva en los últimos 14 días
    prisma.user.count({
      where: {
        studioId, role: 'STUDENT', active: true,
        bookings: { some: { status: 'CONFIRMED', classSession: { date: { gte: cutoff14d } } } },
      },
    }),
    // Paquetes vencidos con créditos sin usar
    prisma.userPackage.count({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        expiresAt: { lt: now },
        classesRemaining: { gt: 0 },
      },
    }),
  ])

  // En riesgo = activos en 45d pero no en 14d
  const studentsAtRisk = Math.max(0, studentsActive45d - studentsActive14d)

  // Top clases afectadas (con más alumnos que dejaron de ir)
  const atRiskSessions = await prisma.booking.groupBy({
    by: ['classSessionId'],
    where: {
      studioId,
      status: 'CONFIRMED',
      classSession: { date: { gte: cutoff45d, lt: cutoff14d } },
      user: { bookings: { none: { status: 'CONFIRMED', classSession: { date: { gte: cutoff14d } } } } },
    },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 5,
  })

  const sessionIds = atRiskSessions.map(s => s.classSessionId)
  const sessions = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, classType: { select: { name: true } } },
  })
  const sessMap: Record<string, string> = {}
  for (const s of sessions) sessMap[s.id] = s.classType.name

  const dropByType: Record<string, number> = {}
  for (const s of atRiskSessions) {
    const name = sessMap[s.classSessionId] ?? 'Otro'
    dropByType[name] = (dropByType[name] ?? 0) + s._count.id
  }
  const mostAffectedClassTypes = Object.entries(dropByType)
    .map(([name, dropCount]) => ({ name, dropCount }))
    .sort((a, b) => b.dropCount - a.dropCount)
    .slice(0, 3)

  return { totalActiveStudents, studentsAtRisk, studentsExpiredPackage: expiredPackages, mostAffectedClassTypes }
}

async function aggregateScheduleOptimization(studioId: string): Promise<ScheduleOptimizationData> {
  const monthStart = arMonthStart()
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1))

  const sessions = await prisma.classSession.findMany({
    where: { studioId, cancelledAt: null, date: { gte: monthStart, lt: nextMonthStart } },
    select: {
      date: true,
      time: true,
      capacityOverride: true,
      classType: { select: { defaultCapacity: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
  })

  // Agrupar por día+hora
  const slotMap: Record<string, { sessionCount: number; totalBookings: number; capacity: number }> = {}
  for (const s of sessions) {
    const dow = DAYS_ES[s.date.getDay()] ?? 'lunes'
    const key = `${dow}__${s.time}`
    const cap = s.capacityOverride ?? s.classType?.defaultCapacity ?? 10
    if (!slotMap[key]) slotMap[key] = { sessionCount: 0, totalBookings: 0, capacity: 0 }
    slotMap[key].sessionCount++
    slotMap[key].totalBookings += s._count.bookings
    slotMap[key].capacity += cap
  }

  const sessionsByDayTime = Object.entries(slotMap).map(([key, v]) => {
    const [dayOfWeek, time] = key.split('__')
    const avgOccupancyPct = v.capacity > 0 ? Math.round((v.totalBookings / v.capacity) * 100) : 0
    return { dayOfWeek: dayOfWeek ?? '', time: time ?? '', sessionCount: v.sessionCount, avgOccupancyPct, totalBookings: v.totalBookings }
  }).sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)

  const totalBookings = sessions.reduce((s, sess) => s + sess._count.bookings, 0)
  const totalCapacity = sessions.reduce((s, sess) => s + (sess.capacityOverride ?? sess.classType?.defaultCapacity ?? 10), 0)
  const avgOccupancyPct = totalCapacity > 0 ? Math.round((totalBookings / totalCapacity) * 100) : 0

  return {
    monthLabel: monthLabelES(monthStart),
    totalSessions: sessions.length,
    avgOccupancyPct,
    underperformingSlots: sessionsByDayTime.filter(s => s.avgOccupancyPct < 40),
    topSlots: sessionsByDayTime.filter(s => s.avgOccupancyPct >= 80),
    sessionsByDayTime,
  }
}

// ── Claude API call ───────────────────────────────────────────────────────────

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  // Instanciar dentro de la función para soportar rotación de API key sin redeploy
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Respuesta inesperada del modelo.')
  }
  return block.text.trim()
}

// ── System prompts ────────────────────────────────────────────────────────────
//
// Contexto compartido que se inyecta en todos los prompts para que Claude
// entienda el modelo de negocio antes de analizar los datos.

const CONTEXTO_PILATES = `
CONTEXTO DEL NEGOCIO
Sos el asistente de análisis de Flexa, una plataforma para estudios de pilates en Argentina.
Los estudios son boutique (1 a 3 salas). El cupo es limitado por la cantidad de camas/reformer.
Analizás datos del MES ANTERIOR (completo) y del MES ACTUAL (en curso) para dar perspectiva.

FILOSOFÍA DE ANÁLISIS
- No juzgues el desempeño de los instructores. Describí patrones de ocupación y retención por bloque horario para que el dueño saque sus conclusiones.
- Priorizá la eficiencia: es mejor "compactar" horarios (evitar baches de una hora vacía entre clases) que abrir nuevos.
- Diferenciá entre "Ocupación" (camas llenas) y "Salud Financiera" (si la ocupación es por clases pagas o recuperaciones pendientes).
- Un alumno "en riesgo" no es solo el que no viene, sino el que tiene créditos/clases de recuperación acumuladas sin usar.

CÓMO HABLAR
- Hablale directamente al/a la dueño/a del estudio (vos, ustedes). Lenguaje simple y cálido.
- Sé directo/a: diagnóstico primero, acción después.
- No uses markdown (negritas, cursivas), asteriscos, ni emojis.
- Solo texto plano y líneas separadoras ———.
`

const SYSTEM_MONTHLY_SUMMARY = `${CONTEXTO_PILATES}
TU ROL: Diagnóstico del estado general comparando el avance del mes actual vs. el mes anterior cerrado.

Estructura fija de respuesta:

Así viene el mes
———
[Analizá la facturación y ocupación actual comparada con el cierre del mes pasado. Mencioná si el ritmo de reservas es mayor o menor a esta misma altura del mes anterior.]

Ocupación vs. Ingresos
———
[Observá si el estudio está lleno pero la facturación no creció. Identificá si hay un alto volumen de cancelaciones que están liberando cupos tarde o si hay muchos créditos de recuperación circulando.]

Lo que los datos muestran
———
[2 observaciones descriptivas sobre el comportamiento de los alumnos este mes. Por ejemplo: cambios en la puntualidad de los pagos o en la antelación de las reservas.]

Sugerencia de gestión
———
[1 acción concreta para estabilizar los ingresos o mejorar la ocupación antes de que termine el mes.]

Máximo 280 palabras.`

const SYSTEM_CHURN_RISK = `${CONTEXTO_PILATES}
TU ROL: Identificar alumnos que pierden el ritmo y sugerir contacto humano.
Un alumno en riesgo es quien no reserva hace 14 días o tiene más de 2 clases "pendientes de recuperación" por vencer.

Estructura fija de respuesta:

Estado de la retención
———
[Cuántos alumnos están en zona de riesgo. Comparalo con el promedio de bajas del mes pasado para dar contexto de gravedad.]

Patrones detectados
———
[Describí si el riesgo se concentra en un horario específico o en alumnos nuevos vs. antiguos. Mencioná si hay muchos créditos de recuperación acumulados sin uso.]

Acciones de contacto
———
[3 sugerencias de contacto personal (vía WhatsApp). Priorizá a los que tienen clases por vencer. No sugieras mails automáticos.]

Para prevenir
———
[Una recomendación sobre la política de vencimiento de clases o comunicación para evitar que el alumno pierda el hábito.]

Máximo 260 palabras.`

const SYSTEM_SCHEDULE_OPTIMIZATION = `${CONTEXTO_PILATES}
TU ROL: Analizar la agenda para mejorar la eficiencia operativa sin juzgar a los profesionales.

Estructura fija de respuesta:

Panorama de la agenda
———
[Analizá la ocupación general. Identificá si la demanda es constante o si hay mucha disparidad entre días similares.]

Análisis de bloques
———
[Describí los 2 bloques horarios con mayor variabilidad (donde un día está lleno y otro vacío). Invitá al dueño a observar qué cambia en esos días (dinámica de clase, perfil de alumno, etc.).]

Oportunidades de eficiencia
———
[Identificá "huecos" u horas muertas entre clases llenas. Sugerí compactar turnos para reducir horas de apertura ineficientes. Listá el Top 5 de horarios con menor aprovechamiento.]

Recomendación principal
———
[Un cambio de organización que simplifique la operación, como unificar dos clases de baja ocupación en un horario intermedio.]

Máximo 280 palabras.`

// ── User prompt builders ──────────────────────────────────────────────────────

function buildMonthlySummaryPrompt(d: MonthlySummaryData): string {
  const variacion = d.revenueVariationPct !== null
    ? `${d.revenueVariationPct > 0 ? '+' : ''}${d.revenueVariationPct}%`
    : 'sin dato anterior'

  return `Analizá el desempeño de este estudio de pilates durante ${d.monthLabel}.

INGRESOS
- Facturación: $${d.revenueARS.toLocaleString('es-AR')} ARS
- Mes anterior: $${d.prevMonthRevenueARS.toLocaleString('es-AR')} ARS
- Variación: ${variacion}
- MercadoPago: $${d.revenueByMethod.mercadopago.toLocaleString('es-AR')} / Efectivo+Transferencia: $${d.revenueByMethod.cash.toLocaleString('es-AR')}

CLASES
- Clases dictadas: ${d.totalSessions}
- Reservas confirmadas: ${d.totalConfirmedBookings}
- Ocupación promedio: ${d.avgOccupancyPct}%
- No-shows: ${d.monthNoShows}
- Cancelaciones de alumnos: ${d.monthCancellations}

ALUMNOS
- Total activos: ${d.totalActiveStudents}
- Nuevas este mes: ${d.newStudentsThisMonth}
- Sin ninguna reserva este mes: ${d.studentsWithoutActivity}

CLASES MÁS RESERVADAS
${d.topClassTypes.length > 0 ? d.topClassTypes.map(c => `- ${c.name}: ${c.bookingCount} reservas`).join('\n') : '- Sin datos suficientes'}

Con estos datos:
1. Identificá los 2 puntos más fuertes del mes.
2. Señalá los 2 riesgos o áreas de mejora más urgentes.
3. Dá 2 recomendaciones concretas para el mes siguiente.`
}

function buildChurnRiskPrompt(d: ChurnRiskData): string {
  return `Análisis de riesgo de abandono para este estudio de pilates.

ESTADO ACTUAL
- Alumnos activos totales: ${d.totalActiveStudents}
- Alumnos en riesgo (sin reservas en últimas 2 semanas, pero activos en el último mes y medio): ${d.studentsAtRisk}
- Paquetes vencidos con créditos sin usar: ${d.studentsExpiredPackage}

CLASES CON MAYOR CAÍDA DE ASISTENCIA
${d.mostAffectedClassTypes.length > 0 ? d.mostAffectedClassTypes.map(c => `- ${c.name}: ${c.dropCount} alumnos inactivos`).join('\n') : '- Sin caídas significativas detectadas'}

Con estos datos:
1. Evaluá la gravedad del riesgo de churn actual.
2. Identificá posibles causas (estacionalidad, precio, horarios, etc.).
3. Sugerí 3 acciones concretas para reactivar a los alumnos en riesgo.
4. Recomendá 1 cambio preventivo para evitar este patrón en el futuro.`
}

function buildScheduleOptimizationPrompt(d: ScheduleOptimizationData): string {
  const underperforming = d.underperformingSlots.length > 0
    ? d.underperformingSlots.map(s => `- ${s.dayOfWeek} ${s.time}: ${s.avgOccupancyPct}% promedio`).join('\n')
    : '- Ninguno: todos los horarios superan el 40% de ocupación'

  const top = d.topSlots.length > 0
    ? d.topSlots.map(s => `- ${s.dayOfWeek} ${s.time}: ${s.avgOccupancyPct}% promedio`).join('\n')
    : '- Ninguno supera el 80% aún'

  const detail = d.sessionsByDayTime
    .map(s => `- ${s.dayOfWeek} ${s.time}: ${s.avgOccupancyPct}% ocupación (${s.totalBookings} reservas en ${s.sessionCount} clases)`)
    .join('\n')

  return `Analizá la distribución de clases de este estudio durante ${d.monthLabel}.

RESUMEN GENERAL
- Total de clases dictadas: ${d.totalSessions}
- Ocupación promedio general: ${d.avgOccupancyPct}%

HORARIOS CON BAJA OCUPACIÓN (menos del 40%)
${underperforming}

HORARIOS CON ALTA DEMANDA (más del 80%)
${top}

DETALLE POR DÍA Y HORARIO
${detail || '- Sin datos suficientes'}

Con estos datos:
1. Identificá los 2 horarios que deberían eliminarse o reasignarse.
2. Identificá los 2 horarios donde agregar una segunda clase sería rentable.
3. Sugerí el horario ideal para una clase nueva si el estudio quisiera expandirse.
4. Dá 1 recomendación sobre la distribución semanal.`
}
