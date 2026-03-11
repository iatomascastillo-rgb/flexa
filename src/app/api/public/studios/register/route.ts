export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'

const SLUG_BLACKLIST = [
  'www', 'api', 'app', 'admin', 'login', 'logout',
  'registro', 'onboarding', 'soporte', 'support', 'superadmin',
]

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const {
    name,
    email,
    password,
    phone,
    studioName,
    slug: rawSlug,
  } = body as Record<string, string>

  // ── Validaciones básicas ───────────────────────────────────────────────────
  if (!name?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido', field: 'name' }, { status: 422 })
  }
  if (!EMAIL_REGEX.test(email ?? '')) {
    return NextResponse.json({ error: 'Email inválido', field: 'email' }, { status: 422 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres', field: 'password' }, { status: 422 })
  }
  if (!studioName?.trim()) {
    return NextResponse.json({ error: 'El nombre del estudio es requerido', field: 'studioName' }, { status: 422 })
  }

  const slug = rawSlug?.toLowerCase().trim() ?? ''
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json({
      error: 'El slug debe tener 3–40 caracteres, solo letras minúsculas, números y guiones',
      field: 'slug',
    }, { status: 422 })
  }
  if (SLUG_BLACKLIST.includes(slug)) {
    return NextResponse.json({ error: 'Este slug está reservado', field: 'slug' }, { status: 422 })
  }

  // ── Verificar disponibilidad (pre-transaction check) ───────────────────────
  const [slugExists, emailExists] = await Promise.all([
    prisma.studio.findUnique({ where: { slug }, select: { id: true } }),
    // Email único dentro de cada studio, pero un mismo email no debería usarse
    // para crear dos estudios distintos — verificamos globalmente
    prisma.user.findFirst({ where: { email: email.toLowerCase() }, select: { id: true } }),
  ])

  if (slugExists) {
    return NextResponse.json({ error: 'Este slug ya está en uso', field: 'slug' }, { status: 409 })
  }
  if (emailExists) {
    return NextResponse.json({ error: 'Este email ya está registrado', field: 'email' }, { status: 409 })
  }

  // ── Transaction: crear todo en un solo paso atómico ────────────────────────
  const passwordHash = await bcrypt.hash(password, 10)
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  let studioId: string
  let userId: string

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Studio
      const studio = await tx.studio.create({
        data: { name: studioName.trim(), slug, active: true },
        select: { id: true },
      })

      // 2. Admin user (vinculado al studio)
      const user = await tx.user.create({
        data: {
          studioId: studio.id,
          email: email.toLowerCase().trim(),
          passwordHash,
          name: name.trim(),
          phone: phone?.trim() || null,
          role: 'STUDIO_ADMIN',
          active: true,
        },
        select: { id: true },
      })

      // 3. StudioSettings con defaults seguros
      await tx.studioSettings.create({
        data: {
          studioId: studio.id,
          cancellationHours: 12,
          lateCancellationPolicy: 'LOSE_CREDIT',
          allowWaitlist: true,
          bookingWindowHours: 1,
          waitlistAutoPromote: true,
          gracePeriodEnabled: false,
          gracePeriodCutoffDay: 10,
          graceRequiresHistory: true,
          graceOnNoPay: 'RELEASE_TO_WAITLIST',
        },
      })

      // 4. StudioBranding con colores por defecto
      await tx.studioBranding.create({
        data: {
          studioId: studio.id,
          primaryColor: '#5C7A5E',
          accentColor: '#C4774A',
          welcomeMessage: `¡Bienvenida a ${studioName.trim()}!`,
        },
      })

      // 5. Subscription TRIAL 14 días
      await tx.subscription.create({
        data: {
          studioId: studio.id,
          status: 'TRIAL',
          plan: 'BASICO',
          trialEndsAt,
        },
      })

      return { studioId: studio.id, userId: user.id }
    })

    studioId = result.studioId
    userId = result.userId
  } catch (err) {
    // Puede fallar por unique constraint si hay race condition — manejar limpiamente
    const msg = err instanceof Error ? err.message : ''
    if (msg.includes('Unique constraint') || msg.includes('unique')) {
      return NextResponse.json({ error: 'El slug o email ya está en uso' }, { status: 409 })
    }
    console.error('[register] Error en transaction:', err)
    return NextResponse.json({ error: 'Error interno al crear el estudio' }, { status: 500 })
  }

  // ── Post-transacción: notificaciones ──────────────────────────────────────
  console.log(`[register] Nuevo estudio creado: ${slug} (studioId=${studioId}, userId=${userId})`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const studioUrl = `${baseUrl}/${slug}`
  const trialEndsFormatted = trialEndsAt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Email de bienvenida al admin
  sendEmail(email.toLowerCase(), 'bienvenida-estudio', {
    adminName: name.trim(),
    studioName: studioName.trim(),
    adminEmail: email.toLowerCase(),
    studioUrl,
  }).catch((e) => console.error('[register] Error email bienvenida:', e))

  // Notificación al Super Admin
  prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { email: true } })
    .then((superAdmins) => {
      for (const sa of superAdmins) {
        sendEmail(sa.email, 'nuevo-estudio-superadmin', {
          studioName: studioName.trim(),
          slug,
          adminName: name.trim(),
          adminEmail: email.toLowerCase(),
          trialEndsAt: trialEndsFormatted,
        }).catch((e) => console.error('[register] Error email superadmin:', e))
      }
    })
    .catch((e) => console.error('[register] Error buscando super admins:', e))

  return NextResponse.json(
    { studioId, slug, message: 'Estudio creado. Podés iniciar sesión ahora.' },
    { status: 201 },
  )
}
