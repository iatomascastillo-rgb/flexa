import { prisma } from '@/lib/prisma'
import type { DayOfWeek } from '@prisma/client'

// ── Tipos ──────────────────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

export type RecurringOutcome = 'credit' | 'grace' | 'full' | 'no_coverage'

export type GraceSettings = {
  gracePeriodEnabled: boolean
  graceRequiresHistory: boolean
  gracePeriodCutoffDay: number
}

export interface StudioResult {
  studioId: string
  sessionsGenerated: number
  bookingsCredit: number
  bookingsGrace: number
  skippedAlreadyBooked: number
  skippedFull: number
  alertUserIds: string[]
  error?: string
}

export interface ScheduleDecision {
  scheduleId: string
  userId: string
  classTypeName: string
  dayOfWeek: DayOfWeek
  time: string
  outcomes: Array<{
    sessionId: string
    date: string
    outcome: RecurringOutcome | 'already_booked'
    packageId?: string
  }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_TO_UTC: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

/** Todos los días del mes (year/month 0-indexed). Incluye fines de semana. */
export function getAllDaysOfMonth(year: number, month: number): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(Date.UTC(year, month, day)))
  }
  return dates
}

/** @deprecated Usar getAllDaysOfMonth. Mantenido por compatibilidad con código existente. */
export function getWeekdaysOfMonth(year: number, month: number): Date[] {
  return getAllDaysOfMonth(year, month).filter((d) => {
    const dow = d.getUTCDay()
    return dow >= 1 && dow <= 5
  })
}

/** Verifica si un alumno califica para reserva en período de gracia. */
export async function checkGrace(
  tx: TxClient,
  userId: string,
  studioId: string,
  settings: GraceSettings,
): Promise<boolean> {
  if (!settings.gracePeriodEnabled) return false

  const nowUTC = new Date()
  const nowArt = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  if (nowArt.getUTCDate() >= settings.gracePeriodCutoffDay) return false

  if (settings.graceRequiresHistory) {
    const startOfMonthUTC = new Date(
      Date.UTC(nowArt.getUTCFullYear(), nowArt.getUTCMonth(), 1, 3, 0, 0, 0),
    )
    const history = await tx.userPackage.findFirst({
      where: {
        userId,
        studioId,
        paymentStatus: 'APPROVED',
        activatedAt: { lt: startOfMonthUTC },
      },
      select: { id: true },
    })
    if (!history) return false
  }

  return true
}

// ── Lógica de reserva recurrente ───────────────────────────────────────────────

export async function createRecurringBookingInTx(
  tx: TxClient,
  userId: string,
  studioId: string,
  classSessionId: string,
  settings: GraceSettings,
): Promise<{ outcome: RecurringOutcome; packageId?: string }> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { active: true },
  })
  if (!user?.active) return { outcome: 'no_coverage' }

  const session = await tx.classSession.findUnique({
    where: { id: classSessionId },
    include: { classType: { select: { defaultCapacity: true } } },
  })
  if (!session) return { outcome: 'no_coverage' }

  const capacity = session.capacityOverride ?? session.classType.defaultCapacity
  const confirmedCount = await tx.booking.count({
    where: { classSessionId, studioId, status: 'CONFIRMED' },
  })
  if (confirmedCount >= capacity) return { outcome: 'full' }

  // FOR UPDATE en UserPackage — previene race condition en classesRemaining
  await tx.$queryRaw`
    SELECT id FROM user_packages
    WHERE "userId" = ${userId}
      AND "studioId" = ${studioId}
      AND "paymentStatus" = 'APPROVED'
      AND "classesRemaining" > 0
    ORDER BY "expiresAt" ASC
    LIMIT 1
    FOR UPDATE
  `

  const pkg = await tx.userPackage.findFirst({
    where: { userId, studioId, paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
    orderBy: { expiresAt: 'asc' },
  })

  if (pkg) {
    const updated = await tx.userPackage.update({
      where: { id: pkg.id },
      data: { classesRemaining: { decrement: 1 } },
      select: { classesRemaining: true },
    })

    const booking = await tx.booking.create({
      data: { userId, studioId, classSessionId, userPackageId: pkg.id, status: 'CONFIRMED', origin: 'RECURRING' },
      select: { id: true },
    })

    await tx.creditTransaction.create({
      data: {
        studioId,
        userPackageId: pkg.id,
        type: 'BOOKING_DEDUCT',
        amount: -1,
        balanceAfter: updated.classesRemaining,
        bookingId: booking.id,
      },
    })

    await tx.auditLog.create({
      data: {
        studioId,
        userId,
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: booking.id,
        after: { classSessionId, status: 'CONFIRMED', origin: 'RECURRING', isGrace: false },
      },
    })

    return { outcome: 'credit', packageId: pkg.id }
  }

  const qualifies = await checkGrace(tx, userId, studioId, settings)
  if (qualifies) {
    const booking = await tx.booking.create({
      data: { userId, studioId, classSessionId, userPackageId: null, status: 'CONFIRMED', origin: 'RECURRING' },
      select: { id: true },
    })

    await tx.auditLog.create({
      data: {
        studioId,
        userId,
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: booking.id,
        after: { classSessionId, status: 'CONFIRMED', origin: 'RECURRING', isGrace: true },
      },
    })

    return { outcome: 'grace' }
  }

  return { outcome: 'no_coverage' }
}

// ── Procesamiento por estudio ─────────────────────────────────────────────────

/**
 * Genera sesiones y aplica schedules recurrentes para un estudio y mes dados.
 *
 * PASO 1 — Sesiones:
 *   • Usa ClassScheduleTemplate como fuente de verdad del horario del estudio.
 *   • Fallback: si el estudio no tiene templates aún, deriva slots desde RecurringSchedules
 *     (compatibilidad con estudios configurados antes de esta feature).
 *   • createMany + skipDuplicates → 100% idempotente, seguro de re-ejecutar.
 *
 * PASO 2 — Bookings:
 *   • Aplica RecurringSchedule por alumna sobre las sesiones del mes.
 *
 * verbose=true → incluye detalle de decisiones por schedule (para el endpoint de test).
 */
export async function generateForStudio(
  studioId: string,
  year: number,
  month: number,
  opts: { verbose?: boolean; fromDate?: Date; skipGrace?: boolean } = {},
): Promise<Omit<StudioResult, 'studioId'> & { decisions?: ScheduleDecision[] }> {

  // Una sola ronda de queries en paralelo
  const monthStart = new Date(Date.UTC(year, month, 1))
  const monthEnd = new Date(Date.UTC(year, month + 1, 0))

  const [templates, classTypes, settings, schedules, holidays] = await Promise.all([
    prisma.classScheduleTemplate.findMany({
      where: { studioId, active: true },
      select: { classTypeId: true, dayOfWeek: true, time: true, instructorName: true, roomId: true },
    }),
    prisma.classType.findMany({
      where: { studioId, active: true },
      select: { id: true, name: true },
    }),
    prisma.studioSettings.findUniqueOrThrow({
      where: { studioId },
      select: { gracePeriodEnabled: true, graceRequiresHistory: true, gracePeriodCutoffDay: true },
    }),
    prisma.recurringSchedule.findMany({
      where: { studioId, active: true },
      select: { id: true, userId: true, classTypeId: true, dayOfWeek: true, time: true },
    }),
    // Feriados del mes con política NO_CLASSES
    prisma.studioHoliday.findMany({
      where: {
        studioId,
        policy: 'NO_CLASSES',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { date: true },
    }),
  ])

  // Set de timestamps UTC de días sin clases (para O(1) lookup)
  const holidaySet = new Set(holidays.map((h) => h.date.getTime()))

  const classTypeMap = new Map(classTypes.map((ct) => [ct.id, ct.name]))

  // ── PASO 1: Generar ClassSessions del mes ─────────────────────────────────
  //
  // Construir slotsByDow: Map<diaSemana(0-6), [{time, classTypeId}]>
  //
  // Ruta A — ClassScheduleTemplate (horario permanente del estudio):
  //   El admin lo configura una vez en "Gestionar clases".
  //   Soporta todos los días de la semana, incluidos fines de semana.
  //
  // Ruta B — Fallback legacy (derivar desde RecurringSchedules):
  //   Para estudios que aún no tienen templates. Solo genera los slots
  //   que al menos una alumna tiene configurados como recurrencia.

  const slotsByDow = new Map<number, Array<{ time: string; classTypeId: string; instructorName: string | null; roomId: string | null }>>()

  const source = templates.length > 0 ? templates : schedules
  for (const item of source) {
    const dow = DAY_OF_WEEK_TO_UTC[item.dayOfWeek]
    if (!slotsByDow.has(dow)) slotsByDow.set(dow, [])
    const existing = slotsByDow.get(dow)!
    const roomId = 'roomId' in item ? (item.roomId ?? null) : null
    if (!existing.some((e) => e.time === item.time && e.classTypeId === item.classTypeId && e.roomId === roomId)) {
      existing.push({
        time: item.time,
        classTypeId: item.classTypeId,
        instructorName: 'instructorName' in item ? (item.instructorName ?? null) : null,
        roomId,
      })
    }
  }

  let sessionsGenerated = 0
  if (slotsByDow.size > 0) {
    const allDays = getAllDaysOfMonth(year, month)
    const sessionsToCreate = allDays.flatMap((date) => {
      // Saltar días feriados con política NO_CLASSES
      if (holidaySet.has(date.getTime())) return []
      const dow = date.getUTCDay()
      return (slotsByDow.get(dow) ?? []).map(({ time, classTypeId, instructorName, roomId }) => ({
        studioId,
        date,
        time,
        classTypeId,
        instructorName: instructorName ?? null,
        roomId: roomId ?? null,
      }))
    })

    if (sessionsToCreate.length > 0) {
      const { count } = await prisma.classSession.createMany({
        data: sessionsToCreate,
        skipDuplicates: true, // idempotente — re-ejecutar es seguro
      })
      sessionsGenerated = count
    }
  }

  // Sin recurrencias activas → no hay bookings que aplicar
  if (schedules.length === 0) {
    return {
      sessionsGenerated,
      bookingsCredit: 0,
      bookingsGrace: 0,
      skippedAlreadyBooked: 0,
      skippedFull: 0,
      alertUserIds: [],
      ...(opts.verbose ? { decisions: [] } : {}),
    }
  }

  // ── PASO 2: Aplicar RecurringSchedules ────────────────────────────────────

  let bookingsCredit = 0
  let bookingsGrace = 0
  let skippedAlreadyBooked = 0
  let skippedFull = 0
  const alertUserIds = new Set<string>()
  const decisions: ScheduleDecision[] = []

  const startOfMonth = opts.fromDate ?? new Date(Date.UTC(year, month, 1))
  const startOfNextMonth = new Date(Date.UTC(year, month + 1, 1))

  // Traemos TODAS las sesiones del mes en una sola query y filtramos en memoria
  const allMonthSessions = await prisma.classSession.findMany({
    where: {
      studioId,
      cancelledAt: null,
      date: { gte: startOfMonth, lt: startOfNextMonth },
    },
    select: { id: true, date: true, classTypeId: true, time: true },
  })

  for (const schedule of schedules) {
    const targetDow = DAY_OF_WEEK_TO_UTC[schedule.dayOfWeek]
    const sessions = allMonthSessions.filter(
      (s) =>
        s.classTypeId === schedule.classTypeId &&
        s.time === schedule.time &&
        s.date.getUTCDay() === targetDow,
    )

    const decision: ScheduleDecision = {
      scheduleId: schedule.id,
      userId: schedule.userId,
      classTypeName: classTypeMap.get(schedule.classTypeId) ?? schedule.classTypeId,
      dayOfWeek: schedule.dayOfWeek,
      time: schedule.time,
      outcomes: [],
    }

    for (const session of sessions) {
      // TC-14 fix: ignorar bookings en WAITLIST → intentar nueva reserva CONFIRMED
      const existing = await prisma.booking.findUnique({
        where: { userId_classSessionId: { userId: schedule.userId, classSessionId: session.id } },
        select: { id: true, status: true },
      })
      if (existing?.status === 'CONFIRMED' || existing?.status === 'CANCELLED') {
        skippedAlreadyBooked++
        if (opts.verbose) {
          decision.outcomes.push({
            sessionId: session.id,
            date: session.date.toISOString().slice(0, 10),
            outcome: 'already_booked',
          })
        }
        continue
      }

      let result: { outcome: RecurringOutcome; packageId?: string }
      try {
        const effectiveSettings = opts.skipGrace
          ? { ...settings, gracePeriodEnabled: false }
          : settings
        result = await prisma.$transaction((tx) =>
          createRecurringBookingInTx(tx, schedule.userId, studioId, session.id, effectiveSettings),
        )
      } catch (err) {
        console.error(`[recurring.service] Error creating booking user=${schedule.userId} session=${session.id}:`, err)
        alertUserIds.add(schedule.userId)
        if (opts.verbose) {
          decision.outcomes.push({
            sessionId: session.id,
            date: session.date.toISOString().slice(0, 10),
            outcome: 'no_coverage',
          })
        }
        continue
      }

      if (result.outcome === 'credit') bookingsCredit++
      else if (result.outcome === 'grace') bookingsGrace++
      else if (result.outcome === 'full') skippedFull++
      else alertUserIds.add(schedule.userId)

      if (opts.verbose) {
        decision.outcomes.push({
          sessionId: session.id,
          date: session.date.toISOString().slice(0, 10),
          outcome: result.outcome,
          packageId: result.packageId,
        })
      }
    }

    if (opts.verbose) decisions.push(decision)
  }

  return {
    sessionsGenerated,
    bookingsCredit,
    bookingsGrace,
    skippedAlreadyBooked,
    skippedFull,
    alertUserIds: [...alertUserIds],
    ...(opts.verbose ? { decisions } : {}),
  }
}
