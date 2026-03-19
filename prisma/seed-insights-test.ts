/**
 * seed-insights-test.ts — Datos ficticios para testear AI Insights
 *
 * Crea señales claras para los 3 tipos de insight:
 *
 *   monthly_summary:
 *     - Feb: 8 paquetes vendidos → $152.000 ARS
 *     - Mar (1–16): 6 paquetes → $124.000 ARS (parcial, buen ritmo)
 *     - 2 no-shows, 3 cancelaciones, 1 alumna nueva (María)
 *     - Ocupación promedio ~31% (estudio con potencial de crecimiento)
 *
 *   churn_risk:
 *     - 3 alumnas activas en Feb pero SIN reservas desde el 2 de marzo:
 *       Lucía Fernández, Camila Torres, Valentina López
 *
 *   schedule_optimization:
 *     - TOP: lunes/miércoles 09:00 (67–83%, cap 6)
 *     - MUERTO: viernes 09:00 (33%), todos los 11:00 (0–17%)
 *     - BAJO: 18:00 lun/vie (10–20%), sábado 10:00 (30–40%)
 *     - BUENO: miércoles 18:00 (40–50%)
 *
 * Ejecutar: npx tsx prisma/seed-insights-test.ts
 */

import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

function createClient() {
  const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!cs) throw new Error('DATABASE_URL/DIRECT_URL no configurado')
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: cs }) })
}

/** Fecha UTC sin hora */
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))

async function main() {
  const prisma = createClient()
  console.log('🌱 seed-insights-test: iniciando...\n')

  // ── Lookup de entidades existentes ──────────────────────────────────────────
  const studio = await prisma.studio.findUniqueOrThrow({
    where: { slug: 'centro-pilates' },
    select: { id: true },
  })
  const sid = studio.id

  const admin = await prisma.user.findFirstOrThrow({
    where: { studioId: sid, role: 'STUDIO_ADMIN' },
    select: { id: true },
  })

  const ctRef = await prisma.classType.findUniqueOrThrow({
    where: { id: 'seed-ct-reformer' },
    select: { id: true },
  })
  const ctMat = await prisma.classType.findUniqueOrThrow({
    where: { id: 'seed-ct-mat' },
    select: { id: true },
  })
  const pkg8 = await prisma.package.findUniqueOrThrow({
    where: { id: 'seed-pkg-8' },
    select: { id: true, classCount: true, price: true },
  })
  const pkg4 = await prisma.package.findUniqueOrThrow({
    where: { id: 'seed-pkg-4' },
    select: { id: true, classCount: true, price: true },
  })

  const sofia = await prisma.user.findFirstOrThrow({
    where: { email: 'alumna@centropilates.com', studioId: sid },
    select: { id: true },
  })
  const valentina = await prisma.user.findFirstOrThrow({
    where: { email: 'alumna2@centropilates.com', studioId: sid },
    select: { id: true },
  })

  // ── Nuevas alumnas ───────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Test1234!', 10)

  async function upsertStudent(
    id: string,
    email: string,
    name: string,
    createdAt: Date,
  ): Promise<string> {
    const s = await prisma.user.upsert({
      where: { email_studioId: { email, studioId: sid } },
      update: {},
      create: { id, studioId: sid, email, passwordHash: hash, name, role: 'STUDENT', active: true, createdAt },
      select: { id: true },
    })
    console.log(`  ✅ Alumna: ${name}`)
    return s.id
  }

  const anaId       = await upsertStudent('it-s-ana',      'ana.rodriguez@test.com',   'Ana Rodríguez',   d(2025, 12, 5))
  const carolinaId  = await upsertStudent('it-s-carolina', 'carolina.diaz@test.com',   'Carolina Díaz',   d(2026, 2, 1))
  const elenaId     = await upsertStudent('it-s-elena',    'elena.morales@test.com',   'Elena Morales',   d(2025, 11, 15))
  const luciaId     = await upsertStudent('it-s-lucia',    'lucia.fernandez@test.com', 'Lucía Fernández', d(2025, 10, 1))
  const camilaId    = await upsertStudent('it-s-camila',   'camila.torres@test.com',   'Camila Torres',   d(2026, 1, 20))
  const isabellaId  = await upsertStudent('it-s-isabella', 'isabella.sanchez@test.com','Isabella Sánchez',d(2025, 9, 10))
  const mariaId     = await upsertStudent('it-s-maria',    'maria.gonzalez@test.com',  'María González',  d(2026, 3, 3))

  // ── Paquetes ─────────────────────────────────────────────────────────────────
  const febStart = d(2026, 2, 2)
  const febEnd   = new Date(Date.UTC(2026, 1, 28, 23, 59, 59))   // Feb 28 23:59:59
  const marStart = d(2026, 3, 1)
  const marEnd   = new Date(Date.UTC(2026, 2, 31, 23, 59, 59))   // Mar 31 23:59:59

  async function upsertPkg(
    id: string,
    userId: string,
    pkgId: string,
    classCount: number,
    activatedAt: Date,
    expiresAt: Date,
    remaining: number,
    method: 'MERCADOPAGO' | 'TRANSFER' | 'CASH',
  ): Promise<string> {
    const up = await prisma.userPackage.upsert({
      where: { id },
      update: {},
      create: {
        id,
        studioId: sid,
        userId,
        packageId: pkgId,
        paymentMethod: method,
        paymentStatus: 'APPROVED',
        classesTotal: classCount,
        classesRemaining: remaining,
        activatedAt,
        expiresAt,
        approvedBy: admin.id,
      },
      select: { id: true },
    })
    return up.id
  }

  // Paquetes febrero — todos vencidos (remaining = 0)
  await upsertPkg('it-up-sofia-feb',     sofia.id,     pkg8.id, pkg8.classCount, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-up-ana-feb',       anaId,         pkg8.id, pkg8.classCount, febStart, febEnd, 0, 'TRANSFER')
  await upsertPkg('it-up-carolina-feb',  carolinaId,    pkg8.id, pkg8.classCount, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-up-elena-feb',     elenaId,       pkg8.id, pkg8.classCount, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-up-lucia-feb',     luciaId,       pkg4.id, pkg4.classCount, febStart, febEnd, 0, 'CASH')
  await upsertPkg('it-up-camila-feb',    camilaId,      pkg4.id, pkg4.classCount, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-up-valentina-feb', valentina.id,  pkg4.id, pkg4.classCount, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-up-isabella-feb',  isabellaId,    pkg4.id, pkg4.classCount, febStart, febEnd, 0, 'CASH')

  // Paquetes marzo — en curso, con créditos restantes
  await upsertPkg('it-up-sofia-mar',     sofia.id,    pkg8.id, pkg8.classCount, marStart,              marEnd, 3, 'MERCADOPAGO')
  await upsertPkg('it-up-ana-mar',       anaId,        pkg8.id, pkg8.classCount, marStart,              marEnd, 3, 'TRANSFER')
  await upsertPkg('it-up-carolina-mar',  carolinaId,   pkg8.id, pkg8.classCount, marStart,              marEnd, 2, 'MERCADOPAGO')
  await upsertPkg('it-up-elena-mar',     elenaId,      pkg8.id, pkg8.classCount, marStart,              marEnd, 3, 'MERCADOPAGO')
  await upsertPkg('it-up-isabella-mar',  isabellaId,   pkg4.id, pkg4.classCount, d(2026, 3, 7),         marEnd, 2, 'CASH')
  await upsertPkg('it-up-maria-mar',     mariaId,      pkg4.id, pkg4.classCount, d(2026, 3, 9),         marEnd, 0, 'MERCADOPAGO')

  // Revenue Feb:  4×$24.000 + 4×$14.000 = $152.000 ARS
  // Revenue Mar:  4×$24.000 + 2×$14.000 = $124.000 ARS (mes en curso, buen ritmo)
  console.log('\n  ✅ Paquetes Feb + Mar creados')
  console.log('     Feb: 4×pkg8 + 4×pkg4 = $152.000 ARS')
  console.log('     Mar: 4×pkg8 + 2×pkg4 = $124.000 ARS\n')

  // ── Sesiones ─────────────────────────────────────────────────────────────────
  async function getOrCreateSession(date: Date, time: string, classTypeId: string): Promise<string> {
    const existing = await prisma.classSession.findFirst({
      where: { studioId: sid, date, time, classTypeId },
      select: { id: true },
    })
    if (existing) return existing.id

    const created = await prisma.classSession.create({
      data: { studioId: sid, classTypeId, date, time },
      select: { id: true },
    })
    return created.id
  }

  // Febrero: solo 3 sesiones (miércoles 09:00) para dar bookings a las alumnas en riesgo
  const feb_wed09 = [d(2026, 2, 4), d(2026, 2, 11), d(2026, 2, 18)]
  const febSessIds: string[] = []
  for (const date of feb_wed09) {
    febSessIds.push(await getOrCreateSession(date, '09:00', ctRef.id))
  }

  // Marzo 1–16: sesiones completas con patrones claros de ocupación
  // Lunes:    2, 9, 16
  // Miércoles: 4, 11
  // Viernes:   6, 13
  // Sábado:    7, 14
  const marMon = [d(2026, 3, 2), d(2026, 3, 9),  d(2026, 3, 16)]
  const marWed = [d(2026, 3, 4), d(2026, 3, 11)]
  const marFri = [d(2026, 3, 6), d(2026, 3, 13)]
  const marSat = [d(2026, 3, 7), d(2026, 3, 14)]

  // IDs de sesiones mar (indexados por posición)
  const S = {
    mon09: [] as string[], wed09: [] as string[], fri09: [] as string[],
    mon11: [] as string[], wed11: [] as string[], fri11: [] as string[],
    mon18: [] as string[], wed18: [] as string[], fri18: [] as string[],
    sat10: [] as string[],
  }

  for (const date of marMon) {
    S.mon09.push(await getOrCreateSession(date, '09:00', ctRef.id))
    S.mon11.push(await getOrCreateSession(date, '11:00', ctRef.id))
    S.mon18.push(await getOrCreateSession(date, '18:00', ctMat.id))
  }
  for (const date of marWed) {
    S.wed09.push(await getOrCreateSession(date, '09:00', ctRef.id))
    S.wed11.push(await getOrCreateSession(date, '11:00', ctRef.id))
    S.wed18.push(await getOrCreateSession(date, '18:00', ctMat.id))
  }
  for (const date of marFri) {
    S.fri09.push(await getOrCreateSession(date, '09:00', ctRef.id))
    S.fri11.push(await getOrCreateSession(date, '11:00', ctRef.id))
    S.fri18.push(await getOrCreateSession(date, '18:00', ctMat.id))
  }
  for (const date of marSat) {
    S.sat10.push(await getOrCreateSession(date, '10:00', ctMat.id))
  }

  console.log('  ✅ Sesiones creadas (3 feb + 25 mar)\n')

  // ── Bookings ──────────────────────────────────────────────────────────────────
  let bookingsCreated = 0

  async function book(
    userId: string,
    sessionId: string,
    userPackageId: string,
    opts: {
      status?: 'CONFIRMED' | 'CANCELLED'
      attendanceStatus?: 'ATTENDED' | 'NO_SHOW'
      cancelledAt?: Date
    } = {},
  ) {
    if (!sessionId) return
    const existing = await prisma.booking.findUnique({
      where: { userId_classSessionId: { userId, classSessionId: sessionId } },
    })
    if (existing) return

    await prisma.booking.create({
      data: {
        studioId: sid,
        userId,
        classSessionId: sessionId,
        userPackageId,
        status: opts.status ?? 'CONFIRMED',
        origin: 'MANUAL',
        attendanceStatus: opts.attendanceStatus ?? null,
        cancelledAt: opts.cancelledAt ?? null,
      },
    })
    bookingsCreated++
  }

  // ── Febrero: bookings de alumnas en riesgo (para que aparezcan en churn_risk)
  // Todas tienen bookings en Feb pero NINGUNA en Mar → churn candidates
  for (const sessId of febSessIds) {
    await book(luciaId,        sessId, 'it-up-lucia-feb')
    await book(camilaId,       sessId, 'it-up-camila-feb')
    await book(valentina.id,   sessId, 'it-up-valentina-feb')
  }

  // ── Marzo 09:00 Reformer ──────────────────────────────────────────────────────
  // Lunes 09:00 (alta ocupación: 4–5/6)
  // Mar 2:  Sofia, Ana, Carolina, Elena          = 4/6 = 67%
  // Mar 9:  Sofia, Ana, Carolina, Elena, María   = 5/6 = 83%
  // Mar 16: Sofia, Ana, Carolina, Elena, María   = 5/6 = 83%
  const mon09Batches = [
    [sofia.id, anaId, carolinaId, elenaId],
    [sofia.id, anaId, carolinaId, elenaId, mariaId],
    [sofia.id, anaId, carolinaId, elenaId, mariaId],
  ]
  for (let i = 0; i < S.mon09.length; i++) {
    for (const uid of mon09Batches[i]!) {
      const pkg = { [sofia.id]: 'it-up-sofia-mar', [anaId]: 'it-up-ana-mar', [carolinaId]: 'it-up-carolina-mar', [elenaId]: 'it-up-elena-mar', [mariaId]: 'it-up-maria-mar' }[uid]!
      await book(uid, S.mon09[i]!, pkg)
    }
  }

  // Miércoles 09:00 (alta ocupación: 4–5/6)
  // Mar 4:  Sofia, Ana(no-show), Carolina, Elena         = 3 attend + 1 no-show
  // Mar 11: Sofia, Ana, Carolina, Elena(no-show), María  = 4 attend + 1 no-show
  const wed09Batches: Array<[string, string, { attendanceStatus?: 'ATTENDED' | 'NO_SHOW' }]> = [
    // [userId, pkgId, opts]
    [sofia.id,    'it-up-sofia-mar',    {}],
    [anaId,       'it-up-ana-mar',      { attendanceStatus: 'NO_SHOW' }], // no-show #1
    [carolinaId,  'it-up-carolina-mar', {}],
    [elenaId,     'it-up-elena-mar',    {}],
  ]
  const wed09Batches2: Array<[string, string, { attendanceStatus?: 'ATTENDED' | 'NO_SHOW' }]> = [
    [sofia.id,    'it-up-sofia-mar',    {}],
    [anaId,       'it-up-ana-mar',      {}],
    [carolinaId,  'it-up-carolina-mar', {}],
    [elenaId,     'it-up-elena-mar',    { attendanceStatus: 'NO_SHOW' }], // no-show #2
    [mariaId,     'it-up-maria-mar',    {}],
  ]
  for (const [uid, pkgId, opts] of wed09Batches) {
    await book(uid, S.wed09[0]!, pkgId, opts)
  }
  for (const [uid, pkgId, opts] of wed09Batches2) {
    await book(uid, S.wed09[1]!, pkgId, opts)
  }

  // Viernes 09:00 (baja ocupación: 2/6 = 33%)
  for (const sessId of S.fri09) {
    await book(sofia.id,   sessId, 'it-up-sofia-mar')
    await book(carolinaId, sessId, 'it-up-carolina-mar')
  }

  // ── Cancelaciones: alumnas en riesgo que intentaron volver pero cancelaron
  await book(luciaId,      S.wed09[0]!, 'it-up-lucia-feb',    { status: 'CANCELLED', cancelledAt: d(2026, 3, 3) })
  await book(camilaId,     S.fri09[0]!, 'it-up-camila-feb',   { status: 'CANCELLED', cancelledAt: d(2026, 3, 5) })
  await book(valentina.id, S.mon18[0]!, 'it-up-valentina-feb',{ status: 'CANCELLED', cancelledAt: d(2026, 3, 1) })

  // ── Marzo 11:00 Reformer (slot muerto: 0–1/6) ──────────────────────────────
  // Solo Isabella en viernes 11:00 (1/6 = 17%)
  // Todos los lunes/miércoles 11:00 quedan vacíos → claro candidato a eliminar
  for (const sessId of S.fri11) {
    await book(isabellaId, sessId, 'it-up-isabella-mar')
  }

  // ── Marzo 18:00 Mat ──────────────────────────────────────────────────────────
  // Lunes 18:00 (bajo: 2/10 = 20%)
  for (const sessId of S.mon18) {
    await book(anaId,      sessId, 'it-up-ana-mar')
    await book(carolinaId, sessId, 'it-up-carolina-mar')
  }

  // Miércoles 18:00 (moderado: 4–5/10 = 40–50%)
  // Mar 4:  Sofia, Ana, Carolina, Elena              = 4/10
  // Mar 11: Sofia, Ana, Carolina, Elena, María       = 5/10
  const wed18Students0 = [sofia.id, anaId, carolinaId, elenaId]
  const wed18Students1 = [sofia.id, anaId, carolinaId, elenaId, mariaId]
  const wed18PkgMap: Record<string, string> = {
    [sofia.id]: 'it-up-sofia-mar', [anaId]: 'it-up-ana-mar',
    [carolinaId]: 'it-up-carolina-mar', [elenaId]: 'it-up-elena-mar',
    [mariaId]: 'it-up-maria-mar',
  }
  for (const uid of wed18Students0) await book(uid, S.wed18[0]!, wed18PkgMap[uid]!)
  for (const uid of wed18Students1) await book(uid, S.wed18[1]!, wed18PkgMap[uid]!)

  // Viernes 18:00 (muy bajo: 1/10 = 10%)
  for (const sessId of S.fri18) {
    await book(sofia.id, sessId, 'it-up-sofia-mar')
  }

  // ── Marzo 10:00 Mat (Sábado) (bajo-moderado: 3–4/10) ──────────────────────
  // Mar 7:  Carolina, Elena, Isabella      = 3/10 = 30%
  // Mar 14: Carolina, Elena, Isabella, María = 4/10 = 40%
  const sat10Students0 = [carolinaId, elenaId, isabellaId]
  const sat10Students1 = [carolinaId, elenaId, isabellaId, mariaId]
  const sat10PkgMap: Record<string, string> = {
    [carolinaId]: 'it-up-carolina-mar', [elenaId]: 'it-up-elena-mar',
    [isabellaId]: 'it-up-isabella-mar', [mariaId]: 'it-up-maria-mar',
  }
  for (const uid of sat10Students0) await book(uid, S.sat10[0]!, sat10PkgMap[uid]!)
  for (const uid of sat10Students1) await book(uid, S.sat10[1]!, sat10PkgMap[uid]!)

  console.log(`  ✅ ${bookingsCreated} bookings creados`)

  // ── Habilitar trial IA insights en la suscripción ───────────────────────────
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 30)
  await prisma.subscription.update({
    where: { studioId: sid },
    data: { aiInsightTrialEndsAt: trialEnd },
  })
  console.log('  ✅ Trial IA habilitado (30 días)\n')

  // ── Resumen de señales generadas ─────────────────────────────────────────────
  console.log('─────────────────────────────────────────────────────────────')
  console.log('🎉 seed-insights-test completado. Señales generadas:\n')
  console.log('  monthly_summary (mes actual: marzo 2026)')
  console.log('    Ingresos mar: $124.000 ARS (4×pkg8 + 2×pkg4)')
  console.log('    Ingresos feb: $152.000 ARS (comparación: -18%)')
  console.log('    Alumnas nuevas en mar: 1 (María González)')
  console.log('    No-shows: 2 | Cancelaciones: 3')
  console.log('    Ocupación promedio: ~31%\n')
  console.log('  churn_risk')
  console.log('    En riesgo (activas en feb, sin reservas en mar):')
  console.log('    · Lucía Fernández   (última reserva: feb)')
  console.log('    · Camila Torres     (última reserva: feb)')
  console.log('    · Valentina López   (última reserva: feb)\n')
  console.log('  schedule_optimization (sesiones del mes actual)')
  console.log('    TOP  → lun 09:00 (67–83%) | mié 09:00 (67–83%)')
  console.log('    BAJO → vie 09:00 (33%) | 11:00 todos los días (0–17%)')
  console.log('    BAJO → 18:00 lun/vie (10–20%) | sáb 10:00 (30–40%)')
  console.log('    MEDIO → mié 18:00 (40–50%)\n')
  console.log('  Credenciales admin: admin@centropilates.com / Admin1234!')
  console.log('  URL: http://localhost:3000/centro-pilates/admin?tab=ia')
  console.log('─────────────────────────────────────────────────────────────')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
