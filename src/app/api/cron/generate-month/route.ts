import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { DayOfWeek } from '@prisma/client'

// Vercel: extender timeout a 5 minutos para estudios grandes
export const maxDuration = 300

// ── Helpers ───────────────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

type GraceSettings = {
  gracePeriodEnabled: boolean
  graceRequiresHistory: boolean
  gracePeriodCutoffDay: number
}

const DAY_OF_WEEK_TO_UTC: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
}

/** Retorna todas las fechas lunes-viernes del mes (year/month, 0-indexed). */
function getWeekdaysOfMonth(year: number, month: number): Date[] {
  const dates: Date[] = []
  // new Date(year, month + 1, 0) devuelve el último día del mes — JS maneja overflow
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month, day))
    const dow = date.getUTCDay() // 0=Dom, 1=Lun, ..., 6=Sáb
    if (dow >= 1 && dow <= 5) dates.push(date)
  }
  return dates
}

/** Verifica si un alumno califica para reserva en período de gracia. */
async function checkGrace(
  tx: TxClient,
  userId: string,
  studioId: string,
  settings: GraceSettings,
): Promise<boolean> {
  if (!settings.gracePeriodEnabled) return false

  const nowUTC = new Date()
  const nowArt = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000) // UTC-3, sin DST
  if (nowArt.getUTCDate() >= settings.gracePeriodCutoffDay) return false

  if (settings.graceRequiresHistory) {
    // Primer momento del mes corriente en Argentina (00:00 ART = 03:00 UTC)
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

// ── Lógica de reserva recurrente (sin bookingWindowHours — es acción de sistema) ──

type RecurringOutcome = 'credit' | 'grace' | 'full' | 'no_coverage'

async function createRecurringBookingInTx(
  tx: TxClient,
  userId: string,
  studioId: string,
  classSessionId: string,
  settings: GraceSettings,
): Promise<RecurringOutcome> {
  // Verificar que el alumno sigue activo
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { active: true },
  })
  if (!user?.active) return 'no_coverage'

  // Verificar capacidad
  const session = await tx.classSession.findUnique({
    where: { id: classSessionId },
    include: { classType: { select: { defaultCapacity: true } } },
  })
  if (!session) return 'no_coverage'

  const capacity = session.capacityOverride ?? session.classType.defaultCapacity
  const confirmedCount = await tx.booking.count({
    where: { classSessionId, studioId, status: 'CONFIRMED' },
  })
  if (confirmedCount >= capacity) return 'full'

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

  // FIFO: paquete que vence antes, primero. Sin filtrar por expiresAt.
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

    return 'credit'
  }

  // Sin créditos: verificar gracia
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

    return 'grace'
  }

  return 'no_coverage'
}

// ── Procesamiento por estudio ─────────────────────────────────────────────────

interface StudioResult {
  studioId: string
  sessionsGenerated: number
  bookingsCredit: number
  bookingsGrace: number
  skippedAlreadyBooked: number
  skippedFull: number
  alertUserIds: string[]
  error?: string
}

async function generateForStudio(
  studioId: string,
  year: number,
  month: number,
): Promise<Omit<StudioResult, 'studioId'>> {
  // ── PASO 1: Generar ClassSessions del mes siguiente ───────────────────────
  const classTypes = await prisma.classType.findMany({
    where: { studioId, active: true },
    select: { id: true },
  })

  if (classTypes.length === 0) {
    return { sessionsGenerated: 0, bookingsCredit: 0, bookingsGrace: 0, skippedAlreadyBooked: 0, skippedFull: 0, alertUserIds: [] }
  }

  const weekdays = getWeekdaysOfMonth(year, month)
  // Horas de 9 a 20 (en punto). "de 9 a 20" = 12 slots.
  const hours = Array.from({ length: 12 }, (_, i) => i + 9)

  const sessionsToCreate = weekdays.flatMap((date) =>
    hours.flatMap((hour) =>
      classTypes.map((ct) => ({
        studioId,
        date,
        time: `${String(hour).padStart(2, '0')}:00`,
        classTypeId: ct.id,
      })),
    ),
  )

  // createMany + skipDuplicates = ON CONFLICT DO NOTHING → idempotente
  const { count: sessionsGenerated } = await prisma.classSession.createMany({
    data: sessionsToCreate,
    skipDuplicates: true,
  })

  // ── PASO 2: Aplicar RecurringSchedules ────────────────────────────────────
  const settings = await prisma.studioSettings.findUniqueOrThrow({
    where: { studioId },
    select: { gracePeriodEnabled: true, graceRequiresHistory: true, gracePeriodCutoffDay: true },
  })

  const schedules = await prisma.recurringSchedule.findMany({
    where: { studioId, active: true },
    select: { userId: true, classTypeId: true, dayOfWeek: true, time: true },
  })

  let bookingsCredit = 0
  let bookingsGrace = 0
  let skippedAlreadyBooked = 0
  let skippedFull = 0
  const alertUserIds = new Set<string>()

  // Rango del mes para queries
  const startOfMonth = new Date(Date.UTC(year, month, 1))
  const startOfNextMonth = new Date(Date.UTC(year, month + 1, 1)) // JS maneja overflow de mes

  for (const schedule of schedules) {
    // Buscar sesiones del mes que coincidan con classTypeId + time
    const matchingSessions = await prisma.classSession.findMany({
      where: {
        studioId,
        classTypeId: schedule.classTypeId,
        time: schedule.time,
        cancelledAt: null,
        date: { gte: startOfMonth, lt: startOfNextMonth },
      },
      select: { id: true, date: true },
    })

    // Filtrar por día de la semana (la query de DB no puede filtrar por DOW directamente)
    const targetDow = DAY_OF_WEEK_TO_UTC[schedule.dayOfWeek]
    const sessions = matchingSessions.filter((s) => s.date.getUTCDay() === targetDow)

    for (const session of sessions) {
      // Si ya existe booking para este usuario+sesión → skip
      const existing = await prisma.booking.findUnique({
        where: { userId_classSessionId: { userId: schedule.userId, classSessionId: session.id } },
        select: { id: true },
      })
      if (existing) {
        skippedAlreadyBooked++
        continue
      }

      // Crear reserva en su propia transacción
      let outcome: RecurringOutcome
      try {
        outcome = await prisma.$transaction((tx) =>
          createRecurringBookingInTx(tx, schedule.userId, studioId, session.id, settings),
        )
      } catch (err) {
        console.error(`[cron/generate-month] Error creating booking user=${schedule.userId} session=${session.id}:`, err)
        alertUserIds.add(schedule.userId)
        continue
      }

      if (outcome === 'credit') bookingsCredit++
      else if (outcome === 'grace') bookingsGrace++
      else if (outcome === 'full') skippedFull++
      else alertUserIds.add(schedule.userId) // 'no_coverage'
    }
  }

  return {
    sessionsGenerated,
    bookingsCredit,
    bookingsGrace,
    skippedAlreadyBooked,
    skippedFull,
    alertUserIds: [...alertUserIds],
  }
}

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

  for (const studio of studios) {
    try {
      const result = await generateForStudio(studio.id, nextYear, nextMonth)
      results.push({ studioId: studio.id, ...result })

      // PASO 3: email resumen al admin — fuera de la lógica principal en try/catch separado
      try {
        // TODO: sendNotification CRON_GENERATE_SUMMARY con result
        // await sendEmail({ studioId: studio.id, type: 'CRON_SUMMARY', data: result })
      } catch (emailErr) {
        console.error(`[cron/generate-month] Error sending summary email studio=${studio.id}:`, emailErr)
      }
    } catch (err) {
      console.error(`[cron/generate-month] Fatal error studio=${studio.id}:`, err)
      results.push({
        studioId: studio.id,
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

  const month = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}`
  return NextResponse.json({ ok: true, month, studiosProcessed: studios.length, results })
}
