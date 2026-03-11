/**
 * Seed de desarrollo — crea datos mínimos para testear el MVP.
 * Ejecutar: npm run db:seed
 *
 * Credenciales creadas:
 *   Admin:   admin@centropilates.com  / Admin1234!
 *   Alumna:  alumna@centropilates.com / Alumna1234!
 *   Slug:    centro-pilates
 */





import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

function createClient() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL/DIRECT_URL no configurado en .env.local')
  console.log('Connecting to:', new URL(connectionString).hostname)
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Último segundo del mes corriente (UTC) */
function endOfCurrentMonth(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
}

/** Retorna las fechas de los próximos N días que caen en los días pedidos (0=dom) */
function nextDates(daysOfWeek: number[], count: number): Date[] {
  const dates: Date[] = []
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  while (dates.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (daysOfWeek.includes(cursor.getUTCDay())) {
      dates.push(new Date(cursor))
    }
  }
  return dates
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = createClient()
  console.log('🌱 Iniciando seed...')

  // ── Studio SUPER_ADMIN (plataforma Flexa) ─────────────────────────────────
  const flexaStudio = await prisma.studio.upsert({
    where: { slug: 'flexa' },
    update: {},
    create: { name: 'Flexa Platform', slug: 'flexa', active: true },
  })

  await prisma.studioSettings.upsert({
    where: { studioId: flexaStudio.id },
    update: {},
    create: { studioId: flexaStudio.id },
  })

  await prisma.subscription.upsert({
    where: { studioId: flexaStudio.id },
    update: {},
    create: { studioId: flexaStudio.id, status: 'ACTIVE', plan: 'PRO' },
  })

  const superAdminHash = await bcrypt.hash('SuperAdmin1234!', 10)
  const superAdmin = await prisma.user.upsert({
    where: { email_studioId: { email: 'superadmin@flexa.app', studioId: flexaStudio.id } },
    update: {},
    create: {
      studioId: flexaStudio.id,
      email: 'superadmin@flexa.app',
      passwordHash: superAdminHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      active: true,
    },
  })
  console.log('✅ SuperAdmin:', superAdmin.email)

  // ── Studio ────────────────────────────────────────────────────────────────
  const studio = await prisma.studio.upsert({
    where: { slug: 'centro-pilates' },
    update: {},
    create: {
      name: 'Centro Pilates',
      slug: 'centro-pilates',
      active: true,
    },
  })
  console.log('✅ Studio:', studio.slug)

  // ── Settings ──────────────────────────────────────────────────────────────
  await prisma.studioSettings.upsert({
    where: { studioId: studio.id },
    update: {},
    create: {
      studioId: studio.id,
      cancellationHours: 12,
      lateCancellationPolicy: 'LOSE_CREDIT',
      allowWaitlist: true,
      bookingWindowHours: 1,
      waitlistAutoPromote: true,
      gracePeriodEnabled: true,
      gracePeriodCutoffDay: 10,
      graceRequiresHistory: false, // false para facilitar testeo
      graceOnNoPay: 'RELEASE_TO_WAITLIST',
    },
  })
  console.log('✅ StudioSettings')

  // ── Subscription ─────────────────────────────────────────────────────────
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)
  await prisma.subscription.upsert({
    where: { studioId: studio.id },
    update: {},
    create: {
      studioId: studio.id,
      status: 'TRIAL',
      plan: 'BASICO',
      trialEndsAt: trialEnd,
    },
  })
  console.log('✅ Subscription (TRIAL 14 días)')

  // ── Branding ──────────────────────────────────────────────────────────────
  await prisma.studioBranding.upsert({
    where: { studioId: studio.id },
    update: {},
    create: {
      studioId: studio.id,
      primaryColor: '#5C7A5E',
      accentColor: '#C4774A',
      welcomeMessage: '¡Bienvenida a Centro Pilates!',
    },
  })
  console.log('✅ StudioBranding')

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('Admin1234!', 10)
  const admin = await prisma.user.upsert({
    where: { email_studioId: { email: 'admin@centropilates.com', studioId: studio.id } },
    update: {},
    create: {
      studioId: studio.id,
      email: 'admin@centropilates.com',
      passwordHash: adminHash,
      name: 'Laura García',
      role: 'STUDIO_ADMIN',
      active: true,
    },
  })
  console.log('✅ Admin:', admin.email)

  const alumnaHash = await bcrypt.hash('Alumna1234!', 10)
  const alumna = await prisma.user.upsert({
    where: { email_studioId: { email: 'alumna@centropilates.com', studioId: studio.id } },
    update: {},
    create: {
      studioId: studio.id,
      email: 'alumna@centropilates.com',
      passwordHash: alumnaHash,
      name: 'Sofía Martínez',
      role: 'STUDENT',
      active: true,
    },
  })
  console.log('✅ Alumna:', alumna.email)

  // Alumna 2 sin créditos (para testear gracia)
  const alumna2Hash = await bcrypt.hash('Alumna1234!', 10)
  const alumna2 = await prisma.user.upsert({
    where: { email_studioId: { email: 'alumna2@centropilates.com', studioId: studio.id } },
    update: {},
    create: {
      studioId: studio.id,
      email: 'alumna2@centropilates.com',
      passwordHash: alumna2Hash,
      name: 'Valentina López',
      role: 'STUDENT',
      active: true,
    },
  })
  console.log('✅ Alumna2 (sin créditos):', alumna2.email)

  // ── Package catálogo ──────────────────────────────────────────────────────
  const pkg8 = await prisma.package.upsert({
    where: { id: 'seed-pkg-8' },
    update: {},
    create: {
      id: 'seed-pkg-8',
      studioId: studio.id,
      name: 'Paquete 8 clases',
      classCount: 8,
      price: 2400000, // $24.000 ARS en centavos
      active: true,
    },
  })
  const pkg4 = await prisma.package.upsert({
    where: { id: 'seed-pkg-4' },
    update: {},
    create: {
      id: 'seed-pkg-4',
      studioId: studio.id,
      name: 'Paquete 4 clases',
      classCount: 4,
      price: 1400000, // $14.000 ARS
      active: true,
    },
  })
  console.log('✅ Packages:', pkg8.name, '/', pkg4.name)

  // ── UserPackage para alumna (5 créditos restantes) ────────────────────────
  const existingUP = await prisma.userPackage.findFirst({
    where: { userId: alumna.id, studioId: studio.id, paymentStatus: 'APPROVED' },
  })
  let userPkg: { id: string }
  if (!existingUP) {
    userPkg = await prisma.userPackage.create({
      data: {
        studioId: studio.id,
        userId: alumna.id,
        packageId: pkg8.id,
        paymentMethod: 'MERCADOPAGO',
        paymentStatus: 'APPROVED',
        classesTotal: 8,
        classesRemaining: 5,
        expiresAt: endOfCurrentMonth(),
        activatedAt: new Date(),
        approvedBy: admin.id,
      },
      select: { id: true },
    })
    console.log('✅ UserPackage: 5 créditos para', alumna.name)
  } else {
    userPkg = existingUP
    console.log('⏭  UserPackage ya existe para', alumna.name)
  }

  // ── ClassType ─────────────────────────────────────────────────────────────
  const classType = await prisma.classType.upsert({
    where: { id: 'seed-ct-reformer' },
    update: {},
    create: {
      id: 'seed-ct-reformer',
      studioId: studio.id,
      name: 'Pilates Reformer',
      description: 'Clase de Pilates en máquina Reformer',
      level: 'Todos los niveles',
      defaultCapacity: 6,
      active: true,
    },
  })
  const classTypeMat = await prisma.classType.upsert({
    where: { id: 'seed-ct-mat' },
    update: {},
    create: {
      id: 'seed-ct-mat',
      studioId: studio.id,
      name: 'Pilates Mat',
      description: 'Clase de Pilates en colchoneta',
      level: 'Todos los niveles',
      defaultCapacity: 10,
      active: true,
    },
  })
  console.log('✅ ClassTypes:', classType.name, '/', classTypeMat.name)

  // ── ClassSessions próximas 3 semanas (Lun/Mié/Vie) ───────────────────────
  // Lunes=1, Miércoles=3, Viernes=5
  const sessionDates = nextDates([1, 3, 5], 12)
  const times = ['09:00', '11:00', '18:00']

  let sessionsCreated = 0
  const createdSessions: Array<{ id: string; date: Date; time: string }> = []

  for (const date of sessionDates) {
    for (const time of times) {
      const ct = time === '18:00' ? classTypeMat : classType
      try {
        const session = await prisma.classSession.upsert({
          where: {
            studioId_date_time_classTypeId: {
              studioId: studio.id,
              date,
              time,
              classTypeId: ct.id,
            },
          },
          update: {},
          create: {
            studioId: studio.id,
            classTypeId: ct.id,
            date,
            time,
          },
          select: { id: true, date: true, time: true },
        })
        createdSessions.push(session)
        sessionsCreated++
      } catch {
        // puede fallar si ya existe con otro classType — ignorar
      }
    }
  }
  console.log(`✅ ClassSessions: ${sessionsCreated} sesiones creadas`)

  // ── Bookings para alumna (3 clases próximas confirmadas) ─────────────────
  const futureSessions = createdSessions
    .filter((s) => s.date > new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 3)

  let bookingsCreated = 0
  for (const session of futureSessions) {
    const existing = await prisma.booking.findUnique({
      where: { userId_classSessionId: { userId: alumna.id, classSessionId: session.id } },
    })
    if (!existing) {
      await prisma.booking.create({
        data: {
          studioId: studio.id,
          userId: alumna.id,
          classSessionId: session.id,
          userPackageId: userPkg.id,
          status: 'CONFIRMED',
          origin: 'MANUAL',
        },
      })
      bookingsCreated++
    }
  }
  console.log(`✅ Bookings: ${bookingsCreated} reservas para ${alumna.name}`)

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────')
  console.log('🎉 Seed completado. Credenciales de prueba:')
  console.log('')
  console.log('  SUPER ADMIN')
  console.log('  URL:       http://localhost:3000/superadmin')
  console.log('  Estudio:   flexa')
  console.log('  Email:     superadmin@flexa.app')
  console.log('  Password:  SuperAdmin1234!')
  console.log('')
  console.log('  ADMIN')
  console.log('  URL:       http://localhost:3000/centro-pilates')
  console.log('  Email:     admin@centropilates.com')
  console.log('  Password:  Admin1234!')
  console.log('')
  console.log('  ALUMNA (con 5 créditos, 3 reservas)')
  console.log('  URL:       http://localhost:3000/centro-pilates')
  console.log('  Email:     alumna@centropilates.com')
  console.log('  Password:  Alumna1234!')
  console.log('')
  console.log('  ALUMNA 2 (sin créditos, para testear gracia)')
  console.log('  Email:     alumna2@centropilates.com')
  console.log('  Password:  Alumna1234!')
  console.log('─────────────────────────────────────────')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e)
    process.exit(1)
  })
  
