export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { name, email, password, phone } = body as Record<string, string>

  // ── Validaciones ──────────────────────────────────────────────────────────
  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido', field: 'name' }, { status: 422 })
  }
  if (!EMAIL_REGEX.test(email ?? '')) {
    return NextResponse.json({ error: 'Email inválido', field: 'email' }, { status: 422 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 8 caracteres', field: 'password' },
      { status: 422 },
    )
  }
  if (password.length > 72) {
    return NextResponse.json(
      { error: 'La contraseña no puede superar 72 caracteres', field: 'password' },
      { status: 422 },
    )
  }

  // ── Verificar que el estudio existe y está activo ─────────────────────────
  const studio = await prisma.studio.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      active: true,
      settings: { select: { trialCreditEnabled: true } },
    },
  })

  if (!studio || !studio.active) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }

  // ── Verificar que el email no está en uso en este estudio ─────────────────
  const existing = await prisma.user.findFirst({
    where: { studioId: studio.id, email: email.toLowerCase() },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Este email ya está registrado en el estudio', field: 'email' },
      { status: 409 },
    )
  }

  // ── Crear alumna + crédito de prueba (en una sola transacción) ───────────
  const passwordHash = await bcrypt.hash(password, 8)

  try {
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          studioId: studio.id,
          email: email.toLowerCase().trim(),
          passwordHash,
          name: name.trim(),
          phone: phone?.trim() || null,
          role: 'STUDENT',
          active: true,
        },
        select: { id: true },
      })

      // Crédito de prueba — dentro de la misma transacción
      if (studio.settings?.trialCreditEnabled) {
        const now = new Date()
        const trialExpiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
        const trialPkg = await tx.userPackage.create({
          data: {
            studioId: studio.id,
            userId: newUser.id,
            paymentMethod: 'ADMIN_GRANT',
            paymentStatus: 'APPROVED',
            classesTotal: 1,
            classesRemaining: 1,
            activatedAt: now,
            expiresAt: trialExpiresAt,
            isTrial: true,
          },
          select: { id: true },
        })
        await tx.creditTransaction.create({
          data: {
            studioId: studio.id,
            userPackageId: trialPkg.id,
            type: 'ADMIN_ADJUSTMENT',
            amount: 1,
            balanceAfter: 1,
            note: 'Clase de prueba gratuita',
          },
        })
      }

      return newUser
    })

    console.log(`[join] Nueva alumna en ${slug}: userId=${user.id}${studio.settings?.trialCreditEnabled ? ' (con crédito de prueba)' : ''}`)

    // Emails post-registro — en try/catch independiente para no bloquear la respuesta
    try {
      const admin = await prisma.user.findFirst({
        where: { studioId: studio.id, role: 'STUDIO_ADMIN' },
        select: { email: true, name: true },
      })
      await Promise.all([
        sendEmail(email.toLowerCase(), 'bienvenida-alumno', {
          studentName: name.trim(),
          studioName: studio.name,
        }),
        ...(admin ? [sendEmail(admin.email, 'nuevo-alumno-admin', {
          adminName: admin.name ?? 'Admin',
          studentName: name.trim(),
          studioName: studio.name,
        })] : []),
      ])
    } catch (emailErr) {
      console.error('[join] Error enviando emails:', emailErr)
    }

    return NextResponse.json(
      { userId: user.id, message: 'Cuenta creada. Ya podés iniciar sesión.' },
      { status: 201 },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json(
        { error: 'Este email ya está registrado', field: 'email' },
        { status: 409 },
      )
    }
    console.error('[join] Error:', err)
    return NextResponse.json({ error: 'Error interno al crear la cuenta' }, { status: 500 })
  }
}
