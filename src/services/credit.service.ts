import { prisma } from '@/lib/prisma'
import { AppError } from '@/types/errors'

// ── Tipos ───────────────────────────────────────────────────────────────────

interface AdminAdjustCreditsParams {
  adminUserId: string
  studentUserId: string
  studioId: string
  amount: number  // positivo = sumar, negativo = restar
  note: string    // requerido
}

interface AdminAdjustCreditsResult {
  userPackageId: string
  balanceBefore: number
  balanceAfter: number
  wasNewPackage: boolean
}

// ── adminAdjustCredits ──────────────────────────────────────────────────────

/**
 * Asignación manual de créditos por el admin (Flujo 6 del DATABASE.md).
 * - Busca el paquete activo más reciente del alumno.
 * - Si no existe, crea un UserPackage ADMIN_GRANT que vence a fin de mes.
 * - Registra CreditTransaction ADMIN_ADJUSTMENT con nota obligatoria.
 * - AuditLog con before/after.
 * - Notifica al alumno post-transacción si la cantidad es positiva.
 */
export async function adminAdjustCredits({
  adminUserId,
  studentUserId,
  studioId,
  amount,
  note,
}: AdminAdjustCreditsParams): Promise<AdminAdjustCreditsResult> {
  if (!note.trim()) {
    throw new Error('El motivo es obligatorio')
  }

  const result = await prisma.$transaction(async (tx) => {
    // PRE: verificar que el admin pertenece al estudio
    const admin = await tx.user.findUnique({
      where: { id: adminUserId },
      select: { studioId: true, role: true },
    })
    if (!admin || admin.studioId !== studioId) {
      throw new AppError('USER_NOT_ACTIVE')
    }

    // PRE: verificar que el alumno pertenece al estudio
    const student = await tx.user.findUnique({
      where: { id: studentUserId },
      select: { studioId: true, active: true },
    })
    if (!student || student.studioId !== studioId) {
      throw new AppError('USER_NOT_ACTIVE')
    }

    // FOR UPDATE para prevenir race conditions sobre classesRemaining
    await tx.$queryRaw`
      SELECT id FROM user_packages
      WHERE "userId" = ${studentUserId}
        AND "studioId" = ${studioId}
        AND "paymentStatus" = 'APPROVED'
      ORDER BY "expiresAt" DESC
      LIMIT 1
      FOR UPDATE
    `

    // Paquete activo más reciente (puede tener saldo 0 — igual se usa)
    const existingPackage = await tx.userPackage.findFirst({
      where: {
        userId: studentUserId,
        studioId,
        paymentStatus: 'APPROVED',
      },
      orderBy: { expiresAt: 'desc' },
      select: { id: true, classesRemaining: true },
    })

    let userPackageId: string
    let balanceBefore: number
    let wasNewPackage = false

    if (existingPackage) {
      userPackageId = existingPackage.id
      balanceBefore = existingPackage.classesRemaining
    } else {
      // Sin paquete activo: solo permitir cantidad positiva para crear uno nuevo
      if (amount <= 0) {
        throw new Error('No hay paquete activo para descontar créditos')
      }

      // expiresAt = último segundo del mes actual (UTC midnight del día 1 del próximo mes - 1ms)
      const now = new Date()
      const lastDayOfMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59),
      )

      const newPkg = await tx.userPackage.create({
        data: {
          userId: studentUserId,
          studioId,
          packageId: null,
          paymentMethod: 'ADMIN_GRANT',
          paymentStatus: 'APPROVED',
          classesTotal: amount,
          classesRemaining: 0, // se actualiza en el paso siguiente
          expiresAt: lastDayOfMonth,
          activatedAt: now,
          approvedBy: adminUserId,
        },
        select: { id: true },
      })

      userPackageId = newPkg.id
      balanceBefore = 0
      wasNewPackage = true
    }

    // Verificar que el balance no quede negativo
    const newBalance = balanceBefore + amount
    if (newBalance < 0) {
      throw new Error(
        `Saldo insuficiente: quedarían ${newBalance} créditos (actual: ${balanceBefore})`,
      )
    }

    // Actualizar classesRemaining
    await tx.userPackage.update({
      where: { id: userPackageId },
      data: { classesRemaining: newBalance },
    })

    // CreditTransaction ADMIN_ADJUSTMENT — nota requerida por schema
    await tx.creditTransaction.create({
      data: {
        studioId,
        userPackageId,
        type: 'ADMIN_ADJUSTMENT',
        amount,
        balanceAfter: newBalance,
        note,
        createdBy: adminUserId,
      },
    })

    // AuditLog con before / after
    await tx.auditLog.create({
      data: {
        studioId,
        userId: adminUserId,
        action: 'CREDIT_ADJUSTED_MANUALLY',
        entityType: 'UserPackage',
        entityId: userPackageId,
        before: { classesRemaining: balanceBefore },
        after: { classesRemaining: newBalance },
      },
    })

    return { userPackageId, balanceBefore, balanceAfter: newBalance, wasNewPackage }
  })

  // POST-TRANSACCIÓN: notificar al alumno si se sumaron créditos
  try {
    if (amount > 0) {
      // TODO: reemplazar por sendNotification() cuando se implemente /prompt whatsapp
      // await sendNotification({ userId: studentUserId, studioId, type: 'CREDITS_ASSIGNED', data: { amount } })
    }
  } catch (err) {
    console.error('[adminAdjustCredits] Error enviando notificación:', err)
  }

  return result
}
