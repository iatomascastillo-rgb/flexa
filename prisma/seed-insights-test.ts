/**
 * seed-insights-test.ts v2 — Datos de ejemplo para IA Insights
 *
 * Mes base:   Marzo 2026 (completo, para comparación)
 * Mes actual: Abril 2026 (today = Apr 9, past con asistencia + future con reservas)
 *
 * Cubre TODOS los escenarios de análisis IA:
 *
 *   monthly_summary
 *     - Revenue abr: $218.000 ARS (5×pkg8 + 7×pkg4)
 *     - Revenue mar: $252.000 ARS → variación -13.5% (3 alumnas no renovaron)
 *     - 1 alumna nueva (María González, se sumó el 1° de abril)
 *     - 5 no-shows (Isabella sistemática + Ana 1 vez)
 *     - 1 cancelación (Martina, Apr 1)
 *
 *   churn_risk (cutoffs: 45d = Feb 23, 14d = Mar 26)
 *     - Valentina López:  última reserva Mar 25 → en riesgo ✓
 *     - Lucía Fernández:  última reserva Mar 14 → en riesgo ✓
 *     - Camila Torres:    última reserva Mar 20 → en riesgo ✓
 *     - Paquetes mar vencidos con créditos sin usar: Valentina 3, Lucía 1, Camila 2
 *
 *   schedule_optimization (sesiones de abril)
 *     - TOP  100%  : lun/mié/vie 09:00 Reformer (6/6, LLENO)
 *     - MOD  40-60%: sáb 10:00 Mat, lun/mié/vie 11:00 Ref, 18:00 Mat
 *     - BAJO  ~17% : lun/mié/vie 08:00 Reformer (1/6)
 *     - MUERTO  0% : lun/mié/vie 19:00 Mat
 *
 *   lista de espera
 *     - Agustina Peralta en WAITLIST Apr 13 y Apr 20 (09:00 Ref lleno)
 *
 *   asistencia
 *     - Isabella Sánchez: books pero siempre NO_SHOW (patrón crónico)
 *     - Martina Cabrera:  cancela frecuentemente
 *     - Florencia Ríos:   vino 2 veces y desapareció (sin future bookings)
 *
 * Ejecutar:
 *   npx tsx prisma/seed-insights-test.ts
 *
 * Admin: admin@centropilates.com / Admin1234!
 * URL:   http://localhost:3000/centro-pilates/admin?tab=ia
 */

import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

function createClient() {
  const cs = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!cs) throw new Error('DATABASE_URL/DIRECT_URL no configurado')
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: cs }) })
}

/** Fecha UTC a medianoche */
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day))

async function main() {
  const prisma = createClient()
  console.log('🌱 seed-insights-test v2: iniciando...\n')

  // ── Entidades base ───────────────────────────────────────────────────────────
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
    select: { id: true, defaultCapacity: true },
  })
  const ctMat = await prisma.classType.findUniqueOrThrow({
    where: { id: 'seed-ct-mat' },
    select: { id: true, defaultCapacity: true },
  })
  const pkg8 = await prisma.package.findUniqueOrThrow({
    where: { id: 'seed-pkg-8' },
    select: { id: true, classCount: true },
  })
  const pkg4 = await prisma.package.findUniqueOrThrow({
    where: { id: 'seed-pkg-4' },
    select: { id: true, classCount: true },
  })

  // ── Alumnas ──────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Test1234!', 10)

  async function upsertStudent(
    id: string,
    email: string,
    name: string,
    createdAt: Date,
    forceCreatedAt = false,
  ): Promise<string> {
    const s = await prisma.user.upsert({
      where: { email_studioId: { email, studioId: sid } },
      update: { name, active: true, role: 'STUDENT', ...(forceCreatedAt ? { createdAt } : {}) },
      create: { id, studioId: sid, email, passwordHash: hash, name, role: 'STUDENT', active: true, createdAt },
      select: { id: true },
    })
    console.log(`  ✅ ${name}`)
    return s.id
  }

  console.log('Alumnas:')

  // Regulares (renuevan abril)
  const sofiaId     = await upsertStudent('it-s-sofia',     'alumna@centropilates.com',        'Sofía Martínez',    d(2025, 10, 1))
  const anaId       = await upsertStudent('it-s-ana',       'ana.rodriguez@test.com',           'Ana Rodríguez',     d(2025, 12, 5))
  const carolinaId  = await upsertStudent('it-s-carolina',  'carolina.diaz@test.com',           'Carolina Díaz',     d(2026, 1, 15))
  const elenaId     = await upsertStudent('it-s-elena',     'elena.morales@test.com',           'Elena Morales',     d(2025, 11, 20))
  const renataId    = await upsertStudent('it-s-renata',    'renata.suarez@test.com',           'Renata Suárez',     d(2025, 9, 3))
  const pilarId     = await upsertStudent('it-s-pilar',     'pilar.dominguez@test.com',         'Pilar Domínguez',   d(2026, 2, 1))

  // Patrones especiales (renuevan abril)
  const isabellaId  = await upsertStudent('it-s-isabella',  'isabella.sanchez@test.com',        'Isabella Sánchez',  d(2025, 9, 10))  // siempre NO_SHOW
  const martinaId   = await upsertStudent('it-s-martina',   'martina.cabrera@test.com',         'Martina Cabrera',   d(2026, 1, 10))  // cancela seguido
  const mariaId     = await upsertStudent('it-s-maria',     'maria.gonzalez@test.com',          'María González',    d(2026, 4, 1),   true)  // nueva alumna abril
  const danielaId   = await upsertStudent('it-s-daniela',   'daniela.vega@test.com',            'Daniela Vega',      d(2025, 11, 5))  // solo sábados
  const florenciaId = await upsertStudent('it-s-florencia', 'florencia.rios@test.com',          'Florencia Ríos',    d(2026, 2, 20))  // vino 2 veces y desapareció
  const agustinaId  = await upsertStudent('it-s-agustina',  'agustina.peralta@test.com',        'Agustina Peralta',  d(2026, 3, 15))  // en lista de espera

  // Abandono (no renuevan abril)
  const valentinaId = await upsertStudent('it-s-valentina', 'alumna2@centropilates.com',        'Valentina López',   d(2025, 8, 10))
  const luciaId     = await upsertStudent('it-s-lucia',     'lucia.fernandez@test.com',         'Lucía Fernández',   d(2025, 10, 1))
  const camilaId    = await upsertStudent('it-s-camila',    'camila.torres@test.com',           'Camila Torres',     d(2026, 1, 20))

  // ── Limpieza de ejecuciones anteriores ──────────────────────────────────────
  // Borra todos los bookings de alumnas seed en Mar-Abr para que el seed sea re-ejecutable
  console.log('\nLimpiando datos de ejecuciones anteriores...')
  const seedStudentIds = [
    sofiaId, anaId, carolinaId, elenaId, renataId, pilarId,
    isabellaId, martinaId, mariaId, danielaId, florenciaId, agustinaId,
    valentinaId, luciaId, camilaId,
  ]
  const deleted = await prisma.booking.deleteMany({
    where: {
      studioId: sid,
      userId: { in: seedStudentIds },
      classSession: { date: { gte: d(2026, 3, 1) } },
    },
  })
  console.log(`  ✅ ${deleted.count} bookings eliminados`)

  // Elimina TODOS los paquetes de las alumnas seed desde enero 2026 en adelante
  // (cubre paquetes de seed.ts principal + cualquier versión anterior del seed de IA)
  // Primero borrar credit_transactions que referencian esos paquetes
  const pkgsToDelete = await prisma.userPackage.findMany({
    where: {
      studioId: sid,
      userId: { in: seedStudentIds },
      activatedAt: { gte: d(2026, 1, 1) },
    },
    select: { id: true },
  })
  const pkgIdsToDelete = pkgsToDelete.map(p => p.id)
  if (pkgIdsToDelete.length > 0) {
    await prisma.creditTransaction.deleteMany({
      where: { userPackageId: { in: pkgIdsToDelete } },
    })
  }
  const deletedPkgs = await prisma.userPackage.deleteMany({
    where: {
      studioId: sid,
      userId: { in: seedStudentIds },
      activatedAt: { gte: d(2026, 1, 1) },
    },
  })
  console.log(`  ✅ ${deletedPkgs.count} paquetes eliminados`)

  // ── Paquetes ENERO ───────────────────────────────────────────────────────────
  // Revenue ene: 4×pkg8 + 2×pkg4 = $96k + $28k = $124k ARS (estudio en crecimiento)
  const janStart = d(2026, 1, 1)
  const janEnd   = new Date(Date.UTC(2026, 0, 31, 23, 59, 59))
  console.log('\nPaquetes enero:')
  await upsertPkg('it-jp-sofia',     sofiaId,    pkg8.id, 8, janStart, janEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-jp-ana',       anaId,      pkg8.id, 8, janStart, janEnd, 0, 'TRANSFER')
  await upsertPkg('it-jp-carolina',  carolinaId, pkg8.id, 8, janStart, janEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-jp-elena',     elenaId,    pkg8.id, 8, janStart, janEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-jp-renata',    renataId,   pkg4.id, 4, janStart, janEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-jp-isabella',  isabellaId, pkg4.id, 4, janStart, janEnd, 0, 'CASH')
  console.log('  Revenue: 4×$24k + 2×$14k = $124.000 ARS')

  // ── Paquetes FEBRERO ─────────────────────────────────────────────────────────
  // Revenue feb: 5×pkg8 + 3×pkg4 = $120k + $42k = $162k ARS
  const febStart = d(2026, 2, 1)
  const febEnd   = new Date(Date.UTC(2026, 1, 28, 23, 59, 59))
  console.log('\nPaquetes febrero:')
  await upsertPkg('it-fp-sofia',     sofiaId,     pkg8.id, 8, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-fp-ana',       anaId,       pkg8.id, 8, febStart, febEnd, 0, 'TRANSFER')
  await upsertPkg('it-fp-carolina',  carolinaId,  pkg8.id, 8, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-fp-elena',     elenaId,     pkg8.id, 8, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-fp-renata',    renataId,    pkg8.id, 8, febStart, febEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-fp-pilar',     pilarId,     pkg4.id, 4, febStart, febEnd, 0, 'CASH')
  await upsertPkg('it-fp-isabella',  isabellaId,  pkg4.id, 4, febStart, febEnd, 0, 'CASH')
  await upsertPkg('it-fp-valentina', valentinaId, pkg4.id, 4, febStart, febEnd, 0, 'MERCADOPAGO')
  console.log('  Revenue: 5×$24k + 3×$14k = $162.000 ARS')

  // ── Paquetes MARZO ───────────────────────────────────────────────────────────
  // Todos los 15 estudiantes tuvieron paquete en marzo.
  // Revenue mar: 7×pkg8 ($24k) + 6×pkg4 ($14k) = $168k + $84k = $252k ARS
  const marStart = d(2026, 3, 1)
  const marEnd   = new Date(Date.UTC(2026, 2, 31, 23, 59, 59))

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
        id, studioId: sid, userId, packageId: pkgId,
        paymentMethod: method, paymentStatus: 'APPROVED',
        classesTotal: classCount, classesRemaining: remaining,
        activatedAt, expiresAt, approvedBy: admin.id,
      },
      select: { id: true },
    })
    return up.id
  }

  console.log('\nPaquetes marzo (base de comparación):')
  // pkg8: Sofia, Ana, Carolina, Elena, Renata, Isabella, Valentina = 7 × $24k = $168k
  await upsertPkg('it-mp-sofia',     sofiaId,     pkg8.id, 8, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-ana',       anaId,       pkg8.id, 8, marStart, marEnd, 0, 'TRANSFER')
  await upsertPkg('it-mp-carolina',  carolinaId,  pkg8.id, 8, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-elena',     elenaId,     pkg8.id, 8, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-renata',    renataId,    pkg8.id, 8, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-isabella',  isabellaId,  pkg8.id, 8, marStart, marEnd, 0, 'CASH')
  await upsertPkg('it-mp-valentina', valentinaId, pkg8.id, 8, marStart, marEnd, 3, 'MERCADOPAGO') // churn: 3 créditos sin usar
  // pkg4: Pilar, Martina, Daniela, Florencia, Lucía, Camila = 6 × $14k = $84k
  await upsertPkg('it-mp-pilar',     pilarId,     pkg4.id, 4, marStart, marEnd, 0, 'CASH')
  await upsertPkg('it-mp-martina',   martinaId,   pkg4.id, 4, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-daniela',   danielaId,   pkg4.id, 4, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-florencia', florenciaId, pkg4.id, 4, marStart, marEnd, 0, 'MERCADOPAGO')
  await upsertPkg('it-mp-lucia',     luciaId,     pkg4.id, 4, marStart, marEnd, 1, 'CASH')        // churn: 1 crédito sin usar
  await upsertPkg('it-mp-camila',    camilaId,    pkg4.id, 4, marStart, marEnd, 2, 'MERCADOPAGO') // churn: 2 créditos sin usar
  console.log('  Revenue: 7×$24k + 6×$14k = $252.000 ARS')

  // ── Paquetes ABRIL ───────────────────────────────────────────────────────────
  // Churn trio (Valentina, Lucía, Camila) NO renuevan → solo 12 paquetes
  // Revenue abr: 5×pkg8 ($24k) + 7×pkg4 ($14k) = $120k + $98k = $218k ARS (-13.5%)
  const aprStart = d(2026, 4, 1)
  const aprEnd   = new Date(Date.UTC(2026, 3, 30, 23, 59, 59))

  console.log('\nPaquetes abril (mes actual):')
  // pkg8: Sofia, Ana, Carolina, Elena, Renata = 5 × $24k = $120k
  await upsertPkg('it-ap-sofia',     sofiaId,     pkg8.id, 8, aprStart, aprEnd, 4,  'MERCADOPAGO')
  await upsertPkg('it-ap-ana',       anaId,       pkg8.id, 8, aprStart, aprEnd, 4,  'TRANSFER')
  await upsertPkg('it-ap-carolina',  carolinaId,  pkg8.id, 8, aprStart, aprEnd, 2,  'MERCADOPAGO')
  await upsertPkg('it-ap-elena',     elenaId,     pkg8.id, 8, aprStart, aprEnd, 4,  'MERCADOPAGO')
  await upsertPkg('it-ap-renata',    renataId,    pkg8.id, 8, aprStart, aprEnd, 4,  'MERCADOPAGO')
  // pkg4: Pilar, Isabella, Martina, Daniela, Florencia, María, Agustina = 7 × $14k = $98k
  await upsertPkg('it-ap-pilar',     pilarId,     pkg4.id, 4, aprStart, aprEnd, 1,  'CASH')
  await upsertPkg('it-ap-isabella',  isabellaId,  pkg4.id, 4, aprStart, aprEnd, 0,  'CASH')
  await upsertPkg('it-ap-martina',   martinaId,   pkg4.id, 4, aprStart, aprEnd, 2,  'MERCADOPAGO')
  await upsertPkg('it-ap-daniela',   danielaId,   pkg4.id, 4, aprStart, aprEnd, 3,  'MERCADOPAGO')
  await upsertPkg('it-ap-florencia', florenciaId, pkg4.id, 4, aprStart, aprEnd, 2,  'MERCADOPAGO')
  await upsertPkg('it-ap-maria',     mariaId,     pkg4.id, 4, aprStart, aprEnd, 2,  'MERCADOPAGO')
  await upsertPkg('it-ap-agustina',  agustinaId,  pkg4.id, 4, aprStart, aprEnd, 4,  'MERCADOPAGO')
  console.log('  Revenue: 5×$24k + 7×$14k = $218.000 ARS (-13.5% vs mar)')

  // ── Helper de sesiones ───────────────────────────────────────────────────────
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

  // ── Sesiones MARZO ───────────────────────────────────────────────────────────
  // Estructura: lun/mié/vie 09:00+11:00+18:00 Ref, sáb 10:00 Mat
  const marDates = {
    mon: [d(2026,3,2),  d(2026,3,9),  d(2026,3,16), d(2026,3,23), d(2026,3,30)],
    wed: [d(2026,3,4),  d(2026,3,11), d(2026,3,18), d(2026,3,25)],
    fri: [d(2026,3,6),  d(2026,3,13), d(2026,3,20), d(2026,3,27)],
    sat: [d(2026,3,7),  d(2026,3,14), d(2026,3,21), d(2026,3,28)],
  }
  const marAllWeekday = [...marDates.mon, ...marDates.wed, ...marDates.fri]

  // Mapas: clave = ISO date string → sessionId
  const mS09: Record<string, string> = {}
  const mS11: Record<string, string> = {}
  const mS18: Record<string, string> = {}
  const mSSat10: Record<string, string> = {}

  for (const date of marAllWeekday) {
    const k = date.toISOString().slice(0, 10)
    mS09[k]  = await getOrCreateSession(date, '09:00', ctRef.id)
    mS11[k]  = await getOrCreateSession(date, '11:00', ctRef.id)
    mS18[k]  = await getOrCreateSession(date, '18:00', ctMat.id)
  }
  for (const date of marDates.sat) {
    const k = date.toISOString().slice(0, 10)
    mSSat10[k] = await getOrCreateSession(date, '10:00', ctMat.id)
  }
  console.log('\n  ✅ Sesiones marzo: ' + (Object.keys(mS09).length * 3 + Object.keys(mSSat10).length) + ' sesiones')

  // ── Sesiones ABRIL ───────────────────────────────────────────────────────────
  // Calendario:
  //   Past:   Apr 1(Mié), 3(Vie), 4(Sáb), 6(Lun), 8(Mié)   ← tienen asistencia
  //   Future: Apr 10(Vie), 11(Sáb), 13(Lun), 15(Mié), 17(Vie), 18(Sáb),
  //           20(Lun), 22(Mié), 24(Vie), 25(Sáb), 27(Lun), 29(Mié)

  const aprPastWD  = [d(2026,4,1), d(2026,4,3), d(2026,4,6), d(2026,4,8)]
  const aprPastSat = [d(2026,4,4)]
  const aprFutWD   = [
    d(2026,4,10), d(2026,4,13), d(2026,4,15), d(2026,4,17),
    d(2026,4,20), d(2026,4,22), d(2026,4,24), d(2026,4,27), d(2026,4,29),
  ]
  const aprFutSat  = [d(2026,4,11), d(2026,4,18), d(2026,4,25)]
  const aprAllWD   = [...aprPastWD, ...aprFutWD]
  const aprAllSat  = [...aprPastSat, ...aprFutSat]

  // Slots weekday: 08:00 Ref (muerto), 09:00 Ref (lleno), 11:00 Ref (mod),
  //               18:00 Mat (mod), 19:00 Mat (muerto)
  const aS: Record<string, Record<string, string>> = {
    '08:00': {}, '09:00': {}, '11:00': {}, '18:00': {}, '19:00': {},
  }
  const aSat: Record<string, Record<string, string>> = {
    '10:00': {}, '11:00': {},
  }

  for (const date of aprAllWD) {
    const k = date.toISOString().slice(0, 10)
    aS['08:00'][k] = await getOrCreateSession(date, '08:00', ctRef.id)
    aS['09:00'][k] = await getOrCreateSession(date, '09:00', ctRef.id)
    aS['11:00'][k] = await getOrCreateSession(date, '11:00', ctRef.id)
    aS['18:00'][k] = await getOrCreateSession(date, '18:00', ctMat.id)
    aS['19:00'][k] = await getOrCreateSession(date, '19:00', ctMat.id)
  }
  for (const date of aprAllSat) {
    const k = date.toISOString().slice(0, 10)
    aSat['10:00'][k] = await getOrCreateSession(date, '10:00', ctMat.id)
    aSat['11:00'][k] = await getOrCreateSession(date, '11:00', ctRef.id)
  }
  const aprSessions = Object.values(aS).reduce((n, m) => n + Object.keys(m).length, 0)
               + Object.values(aSat).reduce((n, m) => n + Object.keys(m).length, 0)
  console.log('  ✅ Sesiones abril: ' + aprSessions + ' sesiones')

  // ── Helper de bookings ───────────────────────────────────────────────────────
  let bookingsCreated = 0

  async function book(
    userId: string,
    sessionId: string,
    userPackageId: string | null,
    status: 'CONFIRMED' | 'CANCELLED' | 'WAITLIST' = 'CONFIRMED',
    attendanceStatus?: 'ATTENDED' | 'NO_SHOW',
    cancelledAt?: Date,
  ) {
    const existing = await prisma.booking.findUnique({
      where: { userId_classSessionId: { userId, classSessionId: sessionId } },
    })
    if (existing) return
    await prisma.booking.create({
      data: {
        studioId: sid, userId, classSessionId: sessionId,
        userPackageId,
        status, origin: 'MANUAL',
        attendanceStatus: attendanceStatus ?? null,
        cancelledAt: cancelledAt ?? null,
      },
    })
    bookingsCreated++
  }

  // ── BOOKINGS MARZO: alumnas regulares (09:00 Ref todo el mes) ────────────────
  console.log('\nCreando bookings marzo...')
  const reg09 = [
    { id: sofiaId,    pkg: 'it-mp-sofia' },
    { id: anaId,      pkg: 'it-mp-ana' },
    { id: carolinaId, pkg: 'it-mp-carolina' },
    { id: elenaId,    pkg: 'it-mp-elena' },
    { id: renataId,   pkg: 'it-mp-renata' },
    { id: pilarId,    pkg: 'it-mp-pilar' },
  ]
  for (const s of reg09) {
    for (const [k, sessId] of Object.entries(mS09)) {
      await book(s.id, sessId, s.pkg, 'CONFIRMED', 'ATTENDED')
    }
  }

  // Isabella: 11:00 Ref todo marzo, siempre NO_SHOW
  for (const [, sessId] of Object.entries(mS11)) {
    await book(isabellaId, sessId, 'it-mp-isabella', 'CONFIRMED', 'NO_SHOW')
  }

  // Martina: 11:00 Mié/Vie, cancela los primeros 2 y luego asiste
  let martinaCancel = 0
  for (const [k, sessId] of Object.entries(mS11)) {
    if (martinaCancel < 2) {
      await book(martinaId, sessId, 'it-mp-martina', 'CANCELLED', undefined, new Date(k + 'T03:00:00Z'))
      martinaCancel++
    } else {
      await book(martinaId, sessId, 'it-mp-martina', 'CONFIRMED', 'ATTENDED')
    }
  }

  // Daniela: sábados 10:00 Mat
  for (const [, sessId] of Object.entries(mSSat10)) {
    await book(danielaId, sessId, 'it-mp-daniela', 'CONFIRMED', 'ATTENDED')
  }

  // Florencia: 11:00 Ref todo marzo (activa, pero desaparecerá en abril)
  for (const [, sessId] of Object.entries(mS11)) {
    await book(florenciaId, sessId, 'it-mp-florencia', 'CONFIRMED', 'ATTENDED')
  }

  // ── BOOKINGS MARZO: churn trio ────────────────────────────────────────────────
  // Dashboard usa ventana 21 días — cutoff = Apr 9 - 21d = Mar 19.
  // Para aparecer como "en riesgo", la última reserva debe ser ANTERIOR al Mar 19.

  // Valentina: activa hasta Mar 16 (24 días antes del Apr 9 → en riesgo ✓)
  const valMarchKeys = [
    '2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11', '2026-03-16',
  ]
  for (const k of valMarchKeys) {
    const sessId = mS09[k]; if (sessId) await book(valentinaId, sessId, 'it-mp-valentina', 'CONFIRMED', 'ATTENDED')
  }

  // Lucía: activa solo primera semana de marzo (última = Mar 6)
  for (const k of ['2026-03-02', '2026-03-04', '2026-03-06']) {
    const sessId = mS09[k] ?? mS18[k]; if (sessId) await book(luciaId, sessId, 'it-mp-lucia', 'CONFIRMED', 'ATTENDED')
  }

  // Camila: activa hasta Mar 13 (27 días antes del Apr 9 → en riesgo ✓)
  for (const k of ['2026-03-02', '2026-03-06', '2026-03-09', '2026-03-11', '2026-03-13']) {
    const sessId = mS09[k] ?? mS18[k]; if (sessId) await book(camilaId, sessId, 'it-mp-camila', 'CONFIRMED', 'ATTENDED')
  }

  console.log('  ✅ Bookings marzo: ' + bookingsCreated + ' reservas')

  // ── BOOKINGS ABRIL PASADO (Apr 1-8, con asistencia) ──────────────────────────
  console.log('\nCreando bookings abril pasado (1-9)...')
  const prevCount = bookingsCreated

  const aprPastWDKeys = aprPastWD.map(x => x.toISOString().slice(0, 10))
  const aprPastSatKeys = aprPastSat.map(x => x.toISOString().slice(0, 10))

  // 09:00 Reformer — LLENO (6/6): Sofia, Ana, Carolina, Elena, Renata, Pilar
  const pkg09Map: Record<string, string> = {
    [sofiaId]:    'it-ap-sofia',
    [anaId]:      'it-ap-ana',
    [carolinaId]: 'it-ap-carolina',
    [elenaId]:    'it-ap-elena',
    [renataId]:   'it-ap-renata',
    [pilarId]:    'it-ap-pilar',
  }
  for (const k of aprPastWDKeys) {
    const sessId = aS['09:00'][k]
    if (!sessId) continue
    for (const [uid, pkgId] of Object.entries(pkg09Map)) {
      // Ana: NO_SHOW el Apr 1
      const att: 'ATTENDED' | 'NO_SHOW' = (uid === anaId && k === '2026-04-01') ? 'NO_SHOW' : 'ATTENDED'
      await book(uid, sessId, pkgId, 'CONFIRMED', att)
    }
  }

  // 11:00 Reformer — Isabella (NO_SHOW), Florencia (Apr 1+3 solo), Martina (canceló Apr 1, asiste Apr 6+8)
  for (const k of aprPastWDKeys) {
    const sessId = aS['11:00'][k]
    if (!sessId) continue
    await book(isabellaId, sessId, 'it-ap-isabella', 'CONFIRMED', 'NO_SHOW')
    if (k === '2026-04-01' || k === '2026-04-03') {
      await book(florenciaId, sessId, 'it-ap-florencia', 'CONFIRMED', 'ATTENDED')
    }
    if (k === '2026-04-01') {
      await book(martinaId, sessId, 'it-ap-martina', 'CANCELLED', undefined, new Date('2026-04-01T01:00:00Z'))
    } else if (k === '2026-04-06' || k === '2026-04-08') {
      await book(martinaId, sessId, 'it-ap-martina', 'CONFIRMED', 'ATTENDED')
    }
  }

  // 18:00 Mat — María (nueva), Elena, Carolina
  for (const k of aprPastWDKeys) {
    const sessId = aS['18:00'][k]
    if (!sessId) continue
    await book(mariaId,    sessId, 'it-ap-maria',    'CONFIRMED', 'ATTENDED')
    await book(elenaId,    sessId, 'it-ap-elena',    'CONFIRMED', 'ATTENDED')
    await book(carolinaId, sessId, 'it-ap-carolina', 'CONFIRMED', 'ATTENDED')
  }

  // 08:00 Reformer — casi muerto: solo Renata en Apr 6 (Lun) pide clase extra
  if (aS['08:00']['2026-04-06']) {
    await book(renataId, aS['08:00']['2026-04-06']!, 'it-ap-renata', 'CONFIRMED', 'ATTENDED')
  }
  if (aS['08:00']['2026-04-08']) {
    await book(sofiaId, aS['08:00']['2026-04-08']!, 'it-ap-sofia', 'CONFIRMED', 'ATTENDED')
  }

  // 19:00 Mat — muerto: nadie reserva (queda en 0%)

  // Sábados pasados (Apr 4)
  for (const k of aprPastSatKeys) {
    // 10:00 Mat: Daniela + María
    if (aSat['10:00'][k]) {
      await book(danielaId, aSat['10:00'][k]!, 'it-ap-daniela', 'CONFIRMED', 'ATTENDED')
      await book(mariaId,   aSat['10:00'][k]!, 'it-ap-maria',   'CONFIRMED', 'ATTENDED')
    }
    // 11:00 Ref Sáb: Carolina + Sofia
    if (aSat['11:00'][k]) {
      await book(carolinaId, aSat['11:00'][k]!, 'it-ap-carolina', 'CONFIRMED', 'ATTENDED')
      await book(sofiaId,    aSat['11:00'][k]!, 'it-ap-sofia',    'CONFIRMED', 'ATTENDED')
    }
  }

  console.log('  ✅ Bookings abril pasado: ' + (bookingsCreated - prevCount) + ' reservas')

  // ── BOOKINGS ABRIL FUTURO (Apr 10-30) ────────────────────────────────────────
  console.log('\nCreando bookings abril futuro (10-30)...')
  const prevCount2 = bookingsCreated

  const aprFutWDKeys = aprFutWD.map(x => x.toISOString().slice(0, 10))
  const aprFutSatKeys = aprFutSat.map(x => x.toISOString().slice(0, 10))

  // 09:00 Reformer futuro — mismas 6 regulares (100% lleno)
  for (const k of aprFutWDKeys) {
    const sessId = aS['09:00'][k]
    if (!sessId) continue
    for (const [uid, pkgId] of Object.entries(pkg09Map)) {
      await book(uid, sessId, pkgId, 'CONFIRMED')
    }
  }

  // Lista de espera: Agustina en Apr 13 y Apr 20 (lunes, sesión más demandada)
  // userPackageId=null porque el crédito aún no se reserva en waitlist
  if (aS['09:00']['2026-04-13']) {
    await book(agustinaId, aS['09:00']['2026-04-13']!, null, 'WAITLIST')
  }
  if (aS['09:00']['2026-04-20']) {
    await book(agustinaId, aS['09:00']['2026-04-20']!, null, 'WAITLIST')
  }

  // 11:00 Reformer futuro — Isabella (sigue reservando, seguirá faltando), Martina (algunas)
  const martinaFutKeys = ['2026-04-13', '2026-04-15', '2026-04-20', '2026-04-22', '2026-04-27']
  for (const k of aprFutWDKeys) {
    const sessId = aS['11:00'][k]
    if (!sessId) continue
    await book(isabellaId, sessId, 'it-ap-isabella', 'CONFIRMED')
    if (martinaFutKeys.includes(k)) {
      await book(martinaId, sessId, 'it-ap-martina', 'CONFIRMED')
    }
  }

  // 18:00 Mat futuro — María, Elena, Carolina (slot nocturno en crecimiento)
  for (const k of aprFutWDKeys) {
    const sessId = aS['18:00'][k]
    if (!sessId) continue
    await book(mariaId,    sessId, 'it-ap-maria',    'CONFIRMED')
    await book(elenaId,    sessId, 'it-ap-elena',    'CONFIRMED')
    await book(carolinaId, sessId, 'it-ap-carolina', 'CONFIRMED')
  }

  // 08:00 Reformer futuro — muy bajo: solo Renata en lunes
  for (const k of ['2026-04-13', '2026-04-20', '2026-04-27']) {
    if (aS['08:00'][k]) await book(renataId, aS['08:00'][k]!, 'it-ap-renata', 'CONFIRMED')
  }

  // Sábados futuros
  for (const k of aprFutSatKeys) {
    // 10:00 Mat: Daniela, María, Carolina
    if (aSat['10:00'][k]) {
      await book(danielaId,  aSat['10:00'][k]!, 'it-ap-daniela',  'CONFIRMED')
      await book(mariaId,    aSat['10:00'][k]!, 'it-ap-maria',    'CONFIRMED')
      await book(carolinaId, aSat['10:00'][k]!, 'it-ap-carolina', 'CONFIRMED')
    }
    // 11:00 Ref Sáb: Sofia, Carolina, Elena
    if (aSat['11:00'][k]) {
      await book(sofiaId,    aSat['11:00'][k]!, 'it-ap-sofia',    'CONFIRMED')
      await book(carolinaId, aSat['11:00'][k]!, 'it-ap-carolina', 'CONFIRMED')
      await book(elenaId,    aSat['11:00'][k]!, 'it-ap-elena',    'CONFIRMED')
    }
  }

  console.log('  ✅ Bookings abril futuro: ' + (bookingsCreated - prevCount2) + ' reservas (incl. 2 lista de espera)')

  // ── Trial IA ─────────────────────────────────────────────────────────────────
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 30)
  await prisma.subscription.update({
    where: { studioId: sid },
    data: { aiInsightTrialEndsAt: trialEnd },
  })

  // ── Resumen ───────────────────────────────────────────────────────────────────
  console.log('\n──────────────────────────────────────────────────────────────────')
  console.log('🎉 seed-insights-test v2 completado. Today = April 9, 2026\n')
  console.log('  SEÑALES DISPONIBLES:\n')
  console.log('  monthly_summary')
  console.log('    Revenue abr:  $218.000 ARS  (5×pkg8 + 7×pkg4)')
  console.log('    Revenue mar:  $252.000 ARS  → variación -13.5%')
  console.log('    Alumna nueva: María González (unió Apr 1)')
  console.log('    No-shows abr: Isabella ×4 + Ana ×1 = 5')
  console.log('    Cancelaciones: Martina ×1 (Apr 1)')
  console.log('    Sesiones abr:  ' + aprSessions + ' (incl. pasadas y futuras)')
  console.log('')
  console.log('  churn_risk  (dashboard 21d = Mar 19 | AI 14d = Mar 26)')
  console.log('    En riesgo: Valentina (últ. Mar 16), Lucía (últ. Mar 6), Camila (últ. Mar 13)')
  console.log('    Paquetes mar vencidos c/ créditos: Valentina 3, Lucía 1, Camila 2')
  console.log('    ⚠  Si ves datos viejos en UI: el cache se renueva en 1h o reiniciá next dev')
  console.log('')
  console.log('  schedule_optimization')
  console.log('    LLENO  100% : lun/mié/vie 09:00 Reformer  ← lista de espera!')
  console.log('    MODERADO 50%: lun/mié/vie 11:00 Ref, 18:00 Mat, sáb 10:00 Mat')
  console.log('    MUY BAJO 17%: lun/mié 08:00 Reformer (2 sesiones, 1-2 alumnas)')
  console.log('    MUERTO    0%: lun/mié/vie 19:00 Mat')
  console.log('')
  console.log('  lista de espera')
  console.log('    Agustina Peralta: WAITLIST Apr 13 09:00 + Apr 20 09:00')
  console.log('')
  console.log('  patrones de asistencia')
  console.log('    Isabella Sánchez: books 09 sesiones, NO_SHOW en TODAS (mar+abr)')
  console.log('    Martina Cabrera:  cancela ~40% de sus reservas')
  console.log('    Florencia Ríos:   vino Apr 1+3, no volvió a reservar (sin future bookings)')
  console.log('')
  console.log('  Credenciales:')
  console.log('    admin@centropilates.com / Admin1234!')
  console.log('    alumna@centropilates.com / Alumna1234!  (Sofía, 09:00 regular)')
  console.log('    alumna2@centropilates.com / Alumna1234! (Valentina, CHURN)')
  console.log('')
  console.log('  URL: http://localhost:3000/centro-pilates/admin?tab=ia')
  console.log('──────────────────────────────────────────────────────────────────')
}

main().catch((e) => {
  console.error('❌ Error:', e)
  process.exit(1)
})
