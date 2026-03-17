import { prisma } from '@/lib/prisma'
import { AppError } from '@/types/errors'
import { sendEmail } from '@/lib/email'
import type { BookingOrigin } from '@prisma/client'

// ── Tipos ──────────────────────────────────────────────────────────────────

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

// ── createRecoveryPackageTx ────────────────────────────────────────────────
/**
 * Crea un UserPackage de recuperación con 1 crédito y vencimiento en N días.
 * Llamar solo dentro de una transacción, cuando recoveryEnabled = true
 * y el alumno acaba de perder un crédito (no-show o cancelación tardía).
 */
async function createRecoveryPackageTx(
  tx: TxClient,
  params: {
    studioId: string
    userId: string
    recoveryDays: number
    bookingId: string
  },
): Promise<void> {
  const { studioId, userId, recoveryDays, bookingId } = params
  const now = new Date()
  // "Fin del día N en Argentina" = día N+1 a las 02:59:59 UTC (UTC-3)
  const base = new Date(now.getTime() + recoveryDays * 24 * 60 * 60 * 1000)
  const expiresAt = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + 1, // +1 en UTC = fin del día AR anterior
    2, 59, 59, 999,
  ))

  const recoveryPackage = await tx.userPackage.create({
    data: {
      studioId,
      userId,
      packageId: null,
      paymentStatus: 'APPROVED',
      paymentMethod: 'ADMIN_GRANT',
      classesTotal: 1,
      classesRemaining: 1,
      expiresAt,
      activatedAt: now,
      isRecovery: true,
    },
    select: { id: true },
  })

  await tx.creditTransaction.create({
    data: {
      studioId,
      userPackageId: recoveryPackage.id,
      type: 'RECOVERY_CREDIT',
      amount: 1,
      balanceAfter: 1,
      bookingId,
      note: `Recuperación automática — ${recoveryDays} días`,
    },
  })
}

interface CreateBookingParams {
  userId: string
  studioId: string
  classSessionId: string
  origin?: BookingOrigin
}

interface CreateBookingResult {
  bookingId: string
  isGrace: boolean
  creditsRemaining: number | null
}

type SettingsForGrace = {
  gracePeriodEnabled: boolean
  graceRequiresHistory: boolean
  gracePeriodCutoffDay: number
}

// ── createBooking ──────────────────────────────────────────────────────────

/**
 * Crea una reserva siguiendo exactamente el Flujo 1 del DATABASE.md.
 * Todas las validaciones y escrituras ocurren dentro de una transacción
 * con FOR UPDATE en ClassSession para prevenir race conditions.
 */
export async function createBooking({
  userId,
  studioId,
  classSessionId,
  origin = 'MANUAL',
}: CreateBookingParams): Promise<CreateBookingResult> {
  const result = await prisma.$transaction(async (tx) => {
    // ── PRE: FOR UPDATE en ClassSession ───────────────────────────────────
    // Bloquea la fila para que reservas concurrentes esperen y no sobre-reserven.
    await tx.$queryRaw`
      SELECT id FROM class_sessions
      WHERE id = ${classSessionId} AND "studioId" = ${studioId}
      FOR UPDATE
    `

    // Cargar sesión con classType (para obtener capacidad por defecto)
    const session = await tx.classSession.findUnique({
      where: { id: classSessionId },
      include: { classType: { select: { defaultCapacity: true } } },
    })
    if (!session || session.studioId !== studioId) {
      throw new AppError('CLASS_NOT_FOUND')
    }

    // Cargar settings — toda la lógica de negocio viene de aquí, nunca hardcodeada
    const settings = await tx.studioSettings.findUniqueOrThrow({
      where: { studioId },
    })

    // ── Validación 1: User.active ─────────────────────────────────────────
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { active: true, studioId: true },
    })
    if (!user || user.studioId !== studioId || !user.active) {
      throw new AppError('USER_NOT_ACTIVE')
    }

    // ── Validación 2: Subscription activa ────────────────────────────────
    const subscription = await tx.subscription.findUnique({
      where: { studioId },
      select: { status: true },
    })
    if (
      !subscription ||
      subscription.status === 'SUSPENDED' ||
      subscription.status === 'CANCELLED'
    ) {
      throw new AppError('STUDIO_SUSPENDED')
    }

    // ── Validación 3: Sesión no cancelada ─────────────────────────────────
    if (session.cancelledAt !== null) {
      throw new AppError('SESSION_CANCELLED')
    }

    // ── Validación 4: Sesión futura ───────────────────────────────────────
    const sessionDateTimeUTC = getSessionDateTimeUTC(session.date, session.time)
    const now = new Date()
    if (sessionDateTimeUTC <= now) {
      throw new AppError('CLASS_IN_PAST')
    }

    // ── Validación 5: Ventana mínima de reserva ───────────────────────────
    const hoursUntilClass =
      (sessionDateTimeUTC.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntilClass < settings.bookingWindowHours) {
      throw new AppError('BOOKING_WINDOW_CLOSED')
    }

    // ── Validación 6: Capacidad disponible ────────────────────────────────
    const capacity =
      session.capacityOverride ?? session.classType.defaultCapacity

    const confirmedCount = await tx.booking.count({
      where: { classSessionId, studioId, status: 'CONFIRMED' },
    })

    if (confirmedCount >= capacity) {
      throw new AppError(
        settings.allowWaitlist ? 'CLASS_FULL_WAITLIST' : 'CLASS_FULL',
      )
    }

    // ── Validación 7: No duplicado ────────────────────────────────────────
    const existing = await tx.booking.findUnique({
      where: { userId_classSessionId: { userId, classSessionId } },
    })
    if (existing) throw new AppError('ALREADY_BOOKED')

    // ── Paso 8: Créditos disponibles (FIFO) o gracia ─────────────────────
    // FOR UPDATE en UserPackage: previene que dos transacciones concurrentes
    // decrementen el mismo paquete desde sesiones distintas (race condition).
    // Sin este lock, dos bookings simultáneos podrían disparar el CHECK constraint
    // y devolver un error de DB en lugar de un AppError('NO_CREDITS').
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

    // NO filtrar por expiresAt — los paquetes vencidos con saldo siguen disponibles.
    const availablePackage = await tx.userPackage.findFirst({
      where: {
        userId,
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
      },
      orderBy: { expiresAt: 'asc' }, // el que vence antes, primero (FIFO)
    })

    let bookingId: string
    let isGrace = false
    let creditsRemaining: number | null = null

    if (availablePackage) {
      // ── Tiene créditos: descontar ────────────────────────────────────────
      const updatedPackage = await tx.userPackage.update({
        where: { id: availablePackage.id },
        data: { classesRemaining: { decrement: 1 } },
        select: { classesRemaining: true },
      })

      const booking = await tx.booking.create({
        data: {
          userId,
          studioId,
          classSessionId,
          userPackageId: availablePackage.id,
          status: 'CONFIRMED',
          origin,
        },
        select: { id: true },
      })

      // Todo cambio en classesRemaining → CreditTransaction obligatorio
      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId: availablePackage.id,
          type: 'BOOKING_DEDUCT',
          amount: -1,
          balanceAfter: updatedPackage.classesRemaining,
          bookingId: booking.id,
        },
      })

      bookingId = booking.id
      creditsRemaining = updatedPackage.classesRemaining
    } else {
      // ── Sin créditos: verificar elegibilidad para período de gracia ──────
      const qualifies = await checkGraceEligibility(tx, userId, studioId, settings)
      if (!qualifies) throw new AppError('NO_CREDITS')

      // userPackageId=null es la señal de reserva en gracia (deuda pendiente)
      const booking = await tx.booking.create({
        data: {
          userId,
          studioId,
          classSessionId,
          userPackageId: null,
          status: 'CONFIRMED',
          origin,
        },
        select: { id: true },
      })

      bookingId = booking.id
      isGrace = true
    }

    // ── Paso 9: AuditLog ──────────────────────────────────────────────────
    await tx.auditLog.create({
      data: {
        studioId,
        userId,
        action: 'BOOKING_CREATED',
        entityType: 'Booking',
        entityId: bookingId,
        after: { classSessionId, status: 'CONFIRMED', isGrace, origin },
      },
    })

    return { bookingId, isGrace, creditsRemaining }
  })

  // ── POST-TRANSACCIÓN: email de confirmación ───────────────────────────────
  try {
    const [user, session] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
      prisma.classSession.findUnique({
        where: { id: classSessionId },
        include: { classType: { select: { name: true } } },
      }),
    ])

    if (user && session) {
      const date = session.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      await sendEmail(user.email, 'confirmacion-reserva', {
        studentName: user.name ?? 'Alumna',
        className: session.classType.name,
        date,
        time: session.time,
        creditsRemaining: result.creditsRemaining,
      })
    }
  } catch (err) {
    console.error('[createBooking] Error enviando email de confirmación:', err)
  }

  return result
}

// ── cancelBooking ──────────────────────────────────────────────────────────

interface CancelBookingParams {
  bookingId: string
  studioId: string
  cancelledByUserId: string   // para AuditLog; la autorización la verifica la API
  cancellationReason?: string
}

interface CancelBookingResult {
  creditRefunded: boolean
  promoted: { userId: string; isGrace: boolean } | null
  skippedUsers: string[]      // userIds que necesitan renovar paquete
}

/**
 * Cancela una reserva (Flujo 2).
 * - WAITLIST: sin crédito, sin refund.
 * - CONFIRMED: calcula ventana, devuelve crédito según política.
 * - Si waitlistAutoPromote: promueve al siguiente candidato.
 */
export async function cancelBooking({
  bookingId,
  studioId,
  cancelledByUserId,
  cancellationReason,
}: CancelBookingParams): Promise<CancelBookingResult> {
  const result = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { classSession: { select: { date: true, time: true } } },
    })

    if (!booking || booking.studioId !== studioId) {
      throw new AppError('CLASS_NOT_FOUND')
    }
    if (booking.status !== 'CONFIRMED' && booking.status !== 'WAITLIST') {
      throw new AppError('CLASS_NOT_FOUND')
    }

    const now = new Date()

    // ── WAITLIST: nunca tuvo crédito ───────────────────────────────────
    if (booking.status === 'WAITLIST') {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: cancellationReason ?? null,
          creditRefunded: false,
        },
      })

      await tx.auditLog.create({
        data: {
          studioId,
          userId: cancelledByUserId,
          action: 'BOOKING_CANCELLED',
          entityType: 'Booking',
          entityId: bookingId,
          after: { status: 'CANCELLED', wasWaitlist: true, creditRefunded: false },
        },
      })

      return { creditRefunded: false, promoted: null, skippedUsers: [] }
    }

    // ── CONFIRMED ─────────────────────────────────────────────────────
    const settings = await tx.studioSettings.findUniqueOrThrow({ where: { studioId } })

    const sessionDateTimeUTC = getSessionDateTimeUTC(
      booking.classSession.date,
      booking.classSession.time,
    )
    const hoursUntilClass = (sessionDateTimeUTC.getTime() - now.getTime()) / (1000 * 60 * 60)
    const isLate = hoursUntilClass < settings.cancellationHours

    // Gracia (userPackageId=null) → creditRefunded siempre false (no había crédito)
    const shouldRefund =
      booking.userPackageId !== null &&
      (isLate ? settings.lateCancellationPolicy === 'KEEP_CREDIT' : true)

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: cancellationReason ?? null,
        creditRefunded: shouldRefund,
      },
    })

    if (shouldRefund && booking.userPackageId) {
      const updated = await tx.userPackage.update({
        where: { id: booking.userPackageId },
        data: { classesRemaining: { increment: 1 } },
        select: { classesRemaining: true },
      })

      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId: booking.userPackageId,
          type: 'CANCELLATION_REFUND',
          amount: 1,
          balanceAfter: updated.classesRemaining,
          bookingId,
        },
      })
    }

    // ── Recovery credit por cancelación tardía ─────────────────────────
    // Si el crédito se perdió (no refund), hay paquete original y el estudio
    // tiene recovery habilitado → generar crédito de recuperación.
    const creditLostOnLateCancellation =
      !shouldRefund && isLate && booking.userPackageId !== null
    if (creditLostOnLateCancellation && settings.recoveryEnabled) {
      await createRecoveryPackageTx(tx, {
        studioId,
        userId: booking.userId,
        recoveryDays: settings.recoveryDays,
        bookingId,
      })
    }

    let promoted: { userId: string; isGrace: boolean } | null = null
    let skippedUsers: string[] = []

    if (settings.waitlistAutoPromote) {
      const promoteResult = await promoteFromWaitlistTx(
        tx,
        booking.classSessionId,
        studioId,
        settings,
      )
      promoted = promoteResult.promoted
      skippedUsers = promoteResult.skipped
    }

    await tx.auditLog.create({
      data: {
        studioId,
        userId: cancelledByUserId,
        action: 'BOOKING_CANCELLED',
        entityType: 'Booking',
        entityId: bookingId,
        after: {
          status: 'CANCELLED',
          creditRefunded: shouldRefund,
          isLate,
          cancellationReason: cancellationReason ?? null,
        },
      },
    })

    return { creditRefunded: shouldRefund, promoted, skippedUsers }
  })

  // POST-TRANSACCIÓN: notificaciones
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        classSession: { include: { classType: { select: { name: true } } } },
      },
    })

    if (booking) {
      const date = booking.classSession.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      const className = booking.classSession.classType.name
      const time = booking.classSession.time

      // Email al alumno que canceló
      const user = await prisma.user.findUnique({
        where: { id: booking.userId },
        select: { email: true, name: true },
      })

      let creditsRemaining: number | undefined
      if (result.creditRefunded) {
        const pkg = await prisma.userPackage.findFirst({
          where: { userId: booking.userId, studioId, paymentStatus: 'APPROVED' },
          orderBy: { expiresAt: 'desc' },
          select: { classesRemaining: true },
        })
        creditsRemaining = pkg?.classesRemaining
      }

      if (user) {
        await sendEmail(user.email, 'cancelacion-reserva', {
          studentName: user.name ?? 'Alumna',
          className,
          date,
          time,
          creditRefunded: result.creditRefunded,
          creditsRemaining,
        })
      }

      // Email al alumno promovido desde lista de espera
      if (result.promoted) {
        const promotedUser = await prisma.user.findUnique({
          where: { id: result.promoted.userId },
          select: { email: true, name: true },
        })
        if (promotedUser) {
          await sendEmail(promotedUser.email, 'lista-de-espera-promovida', {
            studentName: promotedUser.name ?? 'Alumna',
            className,
            date,
            time,
          })
        }
      }
    }
  } catch (err) {
    console.error('[cancelBooking] Error enviando notificaciones:', err)
  }

  return result
}

// ── promoteFromWaitlist ─────────────────────────────────────────────────────

interface PromoteResult {
  promoted: { userId: string; isGrace: boolean } | null
  skipped: string[]   // userIds que no tienen créditos ni gracia → notificar "renovar"
}

/**
 * Lógica interna de promoción (Flujo 3).
 * Reutilizable dentro de transacciones existentes.
 * Itera candidatos WAITLIST en orden (createdAt ASC), se detiene al primero promovido.
 */
async function promoteFromWaitlistTx(
  tx: TxClient,
  classSessionId: string,
  studioId: string,
  settings: SettingsForGrace,
): Promise<PromoteResult> {
  const candidates = await tx.booking.findMany({
    where: { classSessionId, studioId, status: 'WAITLIST' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true },
  })

  const skipped: string[] = []

  for (const candidate of candidates) {
    // FOR UPDATE en UserPackage: mismo racional que en createBooking.
    await tx.$queryRaw`
      SELECT id FROM user_packages
      WHERE "userId" = ${candidate.userId}
        AND "studioId" = ${studioId}
        AND "paymentStatus" = 'APPROVED'
        AND "classesRemaining" > 0
      ORDER BY "expiresAt" ASC
      LIMIT 1
      FOR UPDATE
    `

    // Buscar crédito disponible (FIFO)
    const pkg = await tx.userPackage.findFirst({
      where: {
        userId: candidate.userId,
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
      },
      orderBy: { expiresAt: 'asc' },
    })

    if (pkg) {
      // Tiene créditos → promover con crédito
      const updated = await tx.userPackage.update({
        where: { id: pkg.id },
        data: { classesRemaining: { decrement: 1 } },
        select: { classesRemaining: true },
      })

      await tx.booking.update({
        where: { id: candidate.id },
        data: { status: 'CONFIRMED', userPackageId: pkg.id },
      })

      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId: pkg.id,
          type: 'BOOKING_DEDUCT',
          amount: -1,
          balanceAfter: updated.classesRemaining,
          bookingId: candidate.id,
        },
      })

      return { promoted: { userId: candidate.userId, isGrace: false }, skipped }
    }

    // Sin créditos → verificar gracia
    const qualifies = await checkGraceEligibility(tx, candidate.userId, studioId, settings)
    if (qualifies) {
      await tx.booking.update({
        where: { id: candidate.id },
        data: { status: 'CONFIRMED', userPackageId: null },
      })

      return { promoted: { userId: candidate.userId, isGrace: true }, skipped }
    }

    // Sin créditos ni gracia → saltear, notificar después
    skipped.push(candidate.userId)
  }

  // Ningún candidato pudo ser promovido
  return { promoted: null, skipped }
}

/**
 * Promueve desde waitlist de forma standalone (Flujo 3).
 * Útil para llamadas manuales desde el admin.
 */
export async function promoteFromWaitlist(
  classSessionId: string,
  studioId: string,
): Promise<PromoteResult> {
  const result = await prisma.$transaction(async (tx) => {
    const settings = await tx.studioSettings.findUniqueOrThrow({ where: { studioId } })
    return promoteFromWaitlistTx(tx, classSessionId, studioId, settings)
  })

  try {
    if (result.promoted) {
      const [promotedUser, session] = await Promise.all([
        prisma.user.findUnique({
          where: { id: result.promoted.userId },
          select: { email: true, name: true },
        }),
        prisma.classSession.findUnique({
          where: { id: classSessionId },
          include: { classType: { select: { name: true } } },
        }),
      ])
      if (promotedUser && session) {
        const date = session.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
        await sendEmail(promotedUser.email, 'lista-de-espera-promovida', {
          studentName: promotedUser.name ?? 'Alumna',
          className: session.classType.name,
          date,
          time: session.time,
        })
      }
    }
  } catch (err) {
    console.error('[promoteFromWaitlist] Error enviando notificaciones:', err)
  }

  return result
}

// ── cancelSession ──────────────────────────────────────────────────────────

interface CancelSessionParams {
  classSessionId: string
  studioId: string
  cancelledByUserId?: string  // null para acciones de sistema
}

interface CancelSessionResult {
  affectedConfirmed: number
  affectedWaitlist: number
  creditsRefunded: number
}

/**
 * Cancela una sesión entera (Flujo 4).
 * - CONFIRMED + crédito → devuelve crédito + CreditTransaction.
 * - CONFIRMED + gracia → cancela sin refund.
 * - WAITLIST → cancela sin refund.
 * Notifica a todos los afectados post-transacción.
 */
export async function cancelSession({
  classSessionId,
  studioId,
  cancelledByUserId,
}: CancelSessionParams): Promise<CancelSessionResult> {
  // Pre-query para notificaciones post-cancelación (fuera de la transacción)
  const [affectedForNotif, sessionForNotif] = await Promise.all([
    prisma.booking.findMany({
      where: { classSessionId, studioId, status: { in: ['CONFIRMED', 'WAITLIST'] } },
      select: {
        status: true,
        userPackageId: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.classSession.findUnique({
      where: { id: classSessionId },
      select: {
        date: true, time: true,
        classType: { select: { name: true } },
        studio: { select: { name: true } },
      },
    }),
  ])

  const result = await prisma.$transaction(async (tx) => {
    // PRE: verificar que la sesión pertenece al estudio
    const session = await tx.classSession.findUnique({
      where: { id: classSessionId },
      select: { studioId: true, cancelledAt: true },
    })

    if (!session || session.studioId !== studioId) {
      throw new AppError('CLASS_NOT_FOUND')
    }
    if (session.cancelledAt !== null) {
      throw new AppError('SESSION_CANCELLED')
    }

    const now = new Date()

    // 1. Marcar sesión como cancelada
    await tx.classSession.update({
      where: { id: classSessionId },
      data: { cancelledAt: now },
    })

    // Cancelar WAITLIST en bloque (nunca hubo crédito)
    const { count: affectedWaitlist } = await tx.booking.updateMany({
      where: { classSessionId, studioId, status: 'WAITLIST' },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: 'CLASS_CANCELLED',
        creditRefunded: false,
      },
    })

    // Cancelar CONFIRMED en gracia (userPackageId=null) en bloque
    await tx.booking.updateMany({
      where: { classSessionId, studioId, status: 'CONFIRMED', userPackageId: null },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: 'CLASS_CANCELLED',
        creditRefunded: false,
      },
    })

    // CONFIRMED con crédito → refund individual (necesitamos el userPackageId)
    const creditedBookings = await tx.booking.findMany({
      where: {
        classSessionId,
        studioId,
        status: 'CONFIRMED',
        userPackageId: { not: null },
      },
      select: { id: true, userId: true, userPackageId: true },
    })

    for (const booking of creditedBookings) {
      // userPackageId nunca es null acá (filtrado arriba)
      const pkgId = booking.userPackageId as string

      const updated = await tx.userPackage.update({
        where: { id: pkgId },
        data: { classesRemaining: { increment: 1 } },
        select: { classesRemaining: true },
      })

      await tx.creditTransaction.create({
        data: {
          studioId,
          userPackageId: pkgId,
          type: 'CANCELLATION_REFUND',
          amount: 1,
          balanceAfter: updated.classesRemaining,
          bookingId: booking.id,
        },
      })

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: 'CLASS_CANCELLED',
          creditRefunded: true,
        },
      })
    }

    const affectedConfirmed = creditedBookings.length +
      (await tx.booking.count({
        where: { classSessionId, studioId, status: 'CANCELLED', userPackageId: null, cancellationReason: 'CLASS_CANCELLED' },
      }))

    // 3. AuditLog con cantidad de afectados
    await tx.auditLog.create({
      data: {
        studioId,
        userId: cancelledByUserId ?? null,
        action: 'SESSION_CANCELLED',
        entityType: 'ClassSession',
        entityId: classSessionId,
        after: {
          affectedConfirmed,
          affectedWaitlist,
          creditsRefunded: creditedBookings.length,
        },
      },
    })

    return {
      affectedConfirmed,
      affectedWaitlist,
      creditsRefunded: creditedBookings.length,
    }
  })

  // POST-TRANSACCIÓN: notificar a todos los afectados
  try {
    if (sessionForNotif && affectedForNotif.length > 0) {
      const date = sessionForNotif.date.toLocaleDateString('es-AR', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
      await Promise.all(
        affectedForNotif.map((booking) =>
          sendEmail(booking.user.email, 'clase-cancelada-alumna', {
            studentName: booking.user.name ?? 'Alumna',
            className: sessionForNotif.classType.name,
            studioName: sessionForNotif.studio.name,
            date,
            time: sessionForNotif.time,
            creditsRefunded: booking.status === 'CONFIRMED' && booking.userPackageId !== null,
          })
        )
      )
    }
  } catch (err) {
    console.error('[cancelSession] Error enviando notificaciones:', err)
  }

  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Combina la fecha de la sesión (viene de @db.Date → midnight UTC en Prisma)
 * con la hora en formato "HH:mm" expresada en hora Argentina (UTC-3, sin DST)
 * y devuelve un Date en UTC para comparaciones correctas.
 */
function getSessionDateTimeUTC(sessionDate: Date, sessionTime: string): Date {
  const [hours, minutes] = sessionTime.split(':').map(Number)
  const y = sessionDate.getUTCFullYear()
  const m = sessionDate.getUTCMonth()
  const d = sessionDate.getUTCDate()
  // Argentina = UTC-3 → para convertir a UTC sumamos 3 horas
  return new Date(Date.UTC(y, m, d, hours + 3, minutes, 0, 0))
}

/**
 * Verifica si un alumno califica para reservar en período de gracia (sin créditos).
 *
 * Condiciones (todas deben cumplirse):
 * 1. gracePeriodEnabled = true en el estudio
 * 2. El día actual (hora Argentina) es ANTERIOR al gracePeriodCutoffDay del mes
 * 3. Si graceRequiresHistory = true: al menos 1 UserPackage APPROVED de un mes anterior
 */
async function checkGraceEligibility(
  tx: TxClient,
  userId: string,
  studioId: string,
  settings: SettingsForGrace,
): Promise<boolean> {
  if (!settings.gracePeriodEnabled) return false

  // Hora actual en Argentina (UTC-3, sin DST)
  const nowUTC = new Date()
  const nowArgentina = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const currentDay = nowArgentina.getUTCDate()

  // Si ya pasó el día de corte, no aplica gracia
  if (currentDay >= settings.gracePeriodCutoffDay) return false

  if (settings.graceRequiresHistory) {
    // Primer momento del mes corriente en Argentina → 00:00 ART = 03:00 UTC
    const startOfCurrentMonthUTC = new Date(
      Date.UTC(
        nowArgentina.getUTCFullYear(),
        nowArgentina.getUTCMonth(),
        1, // día 1
        3, // 03:00 UTC = 00:00 ART
        0,
        0,
        0,
      ),
    )

    // Buscar al menos 1 paquete pagado en un mes anterior
    const history = await tx.userPackage.findFirst({
      where: {
        userId,
        studioId,
        paymentStatus: 'APPROVED',
        activatedAt: { lt: startOfCurrentMonthUTC },
      },
      select: { id: true },
    })

    if (!history) return false
  }

  return true
}
