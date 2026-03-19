/**
 * Seed de datos para testear las 14 complejidades de reservas recurrentes.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-recurring-tests.ts
 *
 * Requiere que exista un estudio con slug="test-studio" o lo crea.
 * SOLO USAR EN AMBIENTES DE DESARROLLO — no ejecutar en producción.
 *
 * Después de ejecutar, usar el endpoint de test para verificar:
 *   POST /api/cron/test-recurring
 *   { "studioId": "<id impreso al final>", "year": <año>, "month": <mes 0-indexed>, "dryRun": true }
 */

import { PrismaClient, DayOfWeek } from '@prisma/client'

const prisma = new PrismaClient()

// ── Helpers ───────────────────────────────────────────────────────────────────

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59))
}

// Mes objetivo: el siguiente al actual
const now = new Date()
const targetMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1
const targetYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()
const monthLabel = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}`

async function main() {
  console.log(`\n🌱 Seed de test para recurrencias — mes objetivo: ${monthLabel}\n`)
  console.log('⚠️  SOLO usar en desarrollo. Esto crea datos en la DB.\n')

  // ── Estudio de test ───────────────────────────────────────────────────────

  const studio = await prisma.studio.upsert({
    where: { slug: 'test-studio' },
    create: {
      name: 'Studio de Test',
      slug: 'test-studio',
      active: true,
    },
    update: { active: true },
  })

  // Suscripción activa (necesaria para que el cron lo procese)
  await prisma.subscription.upsert({
    where: { studioId: studio.id },
    create: {
      studioId: studio.id,
      status: 'TRIAL',
      plan: 'BASICO',
      currentPeriodStart: new Date(),
      currentPeriodEnd: endOfMonth(targetYear, targetMonth),
    },
    update: { status: 'TRIAL' },
  })

  // Settings: grace con cutoffDay=28 (para TC-02 — grace alcanzable desde día 25)
  await prisma.studioSettings.upsert({
    where: { studioId: studio.id },
    create: {
      studioId: studio.id,
      gracePeriodEnabled: true,
      gracePeriodCutoffDay: 28,
      graceRequiresHistory: false,
      bookingWindowHours: 2,
      cancellationHours: 12,
      allowWaitlist: true,
      waitlistAutoPromote: true,
      noShowPolicy: 'KEEP_CREDIT',
    },
    update: {
      gracePeriodEnabled: true,
      gracePeriodCutoffDay: 28,
      graceRequiresHistory: false,
    },
  })

  // Tipos de clase — sin unique compuesto en schema, usamos findFirst + create
  async function upsertClassType(name: string, defaultCapacity: number) {
    const existing = await prisma.classType.findFirst({
      where: { studioId: studio.id, name },
    })
    if (existing) {
      return prisma.classType.update({
        where: { id: existing.id },
        data: { active: true, defaultCapacity },
      })
    }
    return prisma.classType.create({
      data: { studioId: studio.id, name, defaultCapacity, active: true },
    })
  }

  const reformer = await upsertClassType('Reformer', 8)
  const mat = await upsertClassType('Mat', 12)

  console.log(`✅ Estudio: ${studio.id} (${studio.slug})`)
  console.log(`   Reformer: ${reformer.id} | Mat: ${mat.id}`)

  // ── Función para crear usuario de test ────────────────────────────────────

  async function makeUser(letter: string, active = true) {
    const email = `test-user-${letter.toLowerCase()}@test-studio.dev`
    const compound = { email, studioId: studio.id }
    return prisma.user.upsert({
      where: { email_studioId: compound },
      create: {
        email,
        name: `User ${letter}`,
        passwordHash: 'seed-hash-not-for-login',
        studioId: studio.id,
        role: 'STUDENT',
        active,
      },
      update: { active },
    })
  }

  async function makePackage(
    userId: string,
    classesRemaining: number,
    expiresAt: Date,
    approved = true,
  ) {
    const seedId = `seed-pkg-${userId}-${expiresAt.getTime()}`
    return prisma.userPackage.upsert({
      where: { id: seedId },
      create: {
        id: seedId,
        studioId: studio.id,
        userId,
        classesTotal: classesRemaining,
        classesRemaining,
        paymentStatus: approved ? 'APPROVED' : 'PENDING',
        paymentMethod: 'ADMIN_GRANT',
        expiresAt,
        activatedAt: approved ? new Date() : null,
      },
      update: { classesRemaining, paymentStatus: approved ? 'APPROVED' : 'PENDING' },
    })
  }

  async function makeSchedule(
    userId: string,
    classTypeId: string,
    dayOfWeek: DayOfWeek,
    time: string,
    active = true,
  ) {
    const existing = await prisma.recurringSchedule.findFirst({
      where: { studioId: studio.id, userId, classTypeId, dayOfWeek, time },
    })
    if (existing) {
      return prisma.recurringSchedule.update({ where: { id: existing.id }, data: { active } })
    }
    return prisma.recurringSchedule.create({
      data: { studioId: studio.id, userId, classTypeId, dayOfWeek, time, active },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TC-01: User A — tiene créditos suficientes
  // ─────────────────────────────────────────────────────────────────────────
  const userA = await makeUser('A')
  await makePackage(userA.id, 8, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userA.id, reformer.id, 'MONDAY', '09:00')
  console.log(`\nTC-01 User A (${userA.id}): Reformer LUNES 09:00 + 8 créditos`)
  console.log('  Esperado: bookingsCredit = count(lunes en el mes)')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-02: User B — sin créditos, gracia abierta (cutoffDay=28, corre día 25)
  // ─────────────────────────────────────────────────────────────────────────
  const userB = await makeUser('B')
  await makeSchedule(userB.id, mat.id, 'WEDNESDAY', '10:00')
  console.log(`\nTC-02 User B (${userB.id}): Mat MIÉRCOLES 10:00 + sin créditos`)
  console.log('  Esperado: bookingsGrace (si cron corre antes del día 28)')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-03: User C — sin créditos, gracia cerrada (cutoffDay=10 default)
  // ─────────────────────────────────────────────────────────────────────────
  const userC = await makeUser('C')
  await makeSchedule(userC.id, reformer.id, 'TUESDAY', '11:00')
  console.log(`\nTC-03 User C (${userC.id}): Reformer MARTES 11:00 + sin créditos`)
  console.log('  Esperado: alertUserIds incluye a User C (con cutoffDay=10 y cron en día 25)')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-04: User D — tiene créditos pero la sesión está llena
  // ─────────────────────────────────────────────────────────────────────────
  const userD = await makeUser('D')
  await makePackage(userD.id, 4, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userD.id, reformer.id, 'FRIDAY', '14:00')
  console.log(`\nTC-04 User D (${userD.id}): Reformer VIERNES 14:00 + 4 créditos`)
  console.log('  SETUP MANUAL: pre-llenar la sesión del primer viernes con 8 bookings antes del cron')
  console.log('  Esperado: skippedFull++ para esa sesión')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-05: User E — idempotencia (correr cron dos veces)
  // ─────────────────────────────────────────────────────────────────────────
  const userE = await makeUser('E')
  await makePackage(userE.id, 10, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userE.id, reformer.id, 'THURSDAY', '09:00')
  console.log(`\nTC-05 User E (${userE.id}): Reformer JUEVES 09:00 + 10 créditos`)
  console.log('  Esperado: 2da ejecución → skippedAlreadyBooked=N, créditos no dobles')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-06: User F — múltiples schedules
  // ─────────────────────────────────────────────────────────────────────────
  const userF = await makeUser('F')
  await makePackage(userF.id, 16, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userF.id, reformer.id, 'MONDAY', '09:00')
  await makeSchedule(userF.id, mat.id, 'WEDNESDAY', '16:00')
  console.log(`\nTC-06 User F (${userF.id}): 2 schedules (Reformer Lun 09:00 + Mat Mié 16:00) + 16 créditos`)
  console.log('  Esperado: bookingsCredit = count(lunes) + count(miércoles)')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-07: User G — FIFO entre dos paquetes
  // ─────────────────────────────────────────────────────────────────────────
  const userG = await makeUser('G')
  const pkgA = await makePackage(userG.id, 2, endOfMonth(targetYear, targetMonth))
  const pkgB = await makePackage(userG.id, 4, endOfMonth(targetYear, targetMonth + 1))
  await makeSchedule(userG.id, reformer.id, 'MONDAY', '10:00')
  console.log(`\nTC-07 User G (${userG.id}): 2 paquetes FIFO`)
  console.log(`   PkgA (${pkgA.id}): 2 créditos, vence ${pkgA.expiresAt.toISOString().slice(0, 10)}`)
  console.log(`   PkgB (${pkgB.id}): 4 créditos, vence ${pkgB.expiresAt.toISOString().slice(0, 10)}`)

  // ─────────────────────────────────────────────────────────────────────────
  // TC-08: User H — créditos exactos para sesiones exactas
  // ─────────────────────────────────────────────────────────────────────────
  const userH = await makeUser('H')
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()
  let tuesdayCount = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (new Date(Date.UTC(targetYear, targetMonth, d)).getUTCDay() === 2) tuesdayCount++
  }
  await makePackage(userH.id, tuesdayCount, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userH.id, mat.id, 'TUESDAY', '09:00')
  console.log(`\nTC-08 User H (${userH.id}): ${tuesdayCount} créditos para ${tuesdayCount} martes de Mat 09:00`)
  console.log('  Esperado: classesRemaining=0 después del cron, sin alertas')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-09: User I — desactivar schedule DESPUÉS del cron
  // ─────────────────────────────────────────────────────────────────────────
  const userI = await makeUser('I')
  await makePackage(userI.id, 10, endOfMonth(targetYear, targetMonth + 1))
  const scheduleI = await makeSchedule(userI.id, reformer.id, 'WEDNESDAY', '09:00')
  console.log(`\nTC-09 User I (${userI.id}): Reformer MIÉRCOLES 09:00 + 10 créditos`)
  console.log(`  Schedule ID: ${scheduleI.id}`)
  console.log('  Pasos: 1) Correr cron mes M')
  console.log(`         2) PATCH /api/test-studio/recurring/${scheduleI.id} { "active": false }`)
  console.log('         3) Correr cron mes M+1 → schedule ignorado')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-10: User J — cancelación de sesión con booking recurrente
  // ─────────────────────────────────────────────────────────────────────────
  const userJ = await makeUser('J')
  await makePackage(userJ.id, 5, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userJ.id, mat.id, 'THURSDAY', '10:00')
  console.log(`\nTC-10 User J (${userJ.id}): Mat JUEVES 10:00`)
  console.log('  Pasos: 1) Correr cron, 2) Admin cancela una sesión → crédito devuelto')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-11: User K — deuda de gracia + liquidación al pagar
  // ─────────────────────────────────────────────────────────────────────────
  const userK = await makeUser('K')
  await makeSchedule(userK.id, reformer.id, 'FRIDAY', '09:00')
  console.log(`\nTC-11 User K (${userK.id}): Reformer VIERNES 09:00, sin créditos`)
  console.log('  Pasos: 1) Correr cron (grace=true con cutoffDay=28), 2) Simular webhook de pago')
  console.log('  Esperado: GRACE_DEBT_SETTLEMENT, bookings vinculados al nuevo paquete')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-12: User L — alumno INACTIVO
  // ─────────────────────────────────────────────────────────────────────────
  const userL = await makeUser('L', false)
  await makePackage(userL.id, 5, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userL.id, mat.id, 'MONDAY', '11:00')
  console.log(`\nTC-12 User L (${userL.id}): INACTIVO + Mat LUNES 11:00 + 5 créditos`)
  console.log('  Esperado: outcome=no_coverage, créditos intactos')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-13: User M — ClassType desactivado antes del cron
  // ─────────────────────────────────────────────────────────────────────────
  const pilates = await upsertClassType('Pilates-Test', 6)
  const userM = await makeUser('M')
  await makePackage(userM.id, 5, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userM.id, pilates.id, 'TUESDAY', '10:00')
  console.log(`\nTC-13 User M (${userM.id}): Pilates-Test MARTES 10:00`)
  console.log('  SETUP MANUAL antes del cron:')
  console.log(`  await prisma.classType.update({ where: { id: '${pilates.id}' }, data: { active: false } })`)
  console.log('  Esperado: 0 sesiones generadas → 0 bookings, sin alerta')

  // ─────────────────────────────────────────────────────────────────────────
  // TC-14: User N — fix WAITLIST bloqueando re-booking
  // ─────────────────────────────────────────────────────────────────────────
  const userN = await makeUser('N')
  await makePackage(userN.id, 5, endOfMonth(targetYear, targetMonth))
  await makeSchedule(userN.id, reformer.id, 'THURSDAY', '11:00')
  console.log(`\nTC-14 User N (${userN.id}): Reformer JUEVES 11:00 — bug WAITLIST`)
  console.log('  Pasos: 1) Correr cron mes M-1 (User N termina en gracia, cutoffDay=28)')
  console.log('         2) grace-cutoff mueve booking a WAITLIST')
  console.log('         3) Correr cron mes M → con el FIX crea CONFIRMED nuevo')
  console.log('            Sin el fix: skippedAlreadyBooked (bug TC-14)')

  // ── Resumen final ─────────────────────────────────────────────────────────

  console.log('\n' + '─'.repeat(60))
  console.log('✅ Seed completado')
  console.log(`\n📋 Studio ID: ${studio.id}`)
  console.log(`📅 Mes objetivo: ${monthLabel} (year=${targetYear}, month=${targetMonth})`)
  console.log('\n🧪 Comando de test (dry-run):')
  console.log(`curl -X POST http://localhost:3000/api/cron/test-recurring \\`)
  console.log(`  -H "Content-Type: application/json" \\`)
  console.log(`  -H "Authorization: Bearer $CRON_SECRET" \\`)
  console.log(`  -d '{"studioId":"${studio.id}","year":${targetYear},"month":${targetMonth},"dryRun":true}'`)
  console.log('\n🧪 Comando de test (real):')
  console.log(`curl -X POST http://localhost:3000/api/cron/test-recurring \\`)
  console.log(`  -H "Content-Type: application/json" \\`)
  console.log(`  -H "Authorization: Bearer $CRON_SECRET" \\`)
  console.log(`  -d '{"studioId":"${studio.id}","year":${targetYear},"month":${targetMonth}}'`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
