import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BreakEvenResult {
  costsEntered: boolean
  totalCosts: number     // pesos ARS
  revenue: number        // pesos ARS — ingresos del mes
  result: number         // revenue - totalCosts (positivo = ganancia)
  breakEvenClasses: number | null  // clases necesarias para cubrir costos
  avgPricePerClass: number | null  // precio promedio por clase vendida
}

export interface CommittedRevenueResult {
  total: number          // pesos ARS comprometidos (cobrado, no consumido)
  vsLastMonth: number | null // diferencia absoluta vs. mes anterior
  vsLastMonthPct: number | null
  packagesCount: number
  avgCreditsRemaining: number
}

// Solo IDs y valores monetarios — sin emails ni datos sensibles fuera del endpoint autenticado
export interface RevenueAtRiskResult {
  totalAtRisk: number    // pesos ARS en riesgo
  studentsAtRisk: {
    userId: string
    name: string         // solo visible en endpoint admin autenticado
    estimatedValue: number
    reason: 'expiring_package' | 'churn_risk'
  }[]
  // Alumnas que ya se fueron: sin reservas hace >45 días, con historial. Solo informativo, sin valor estimado.
  studentsLost: { userId: string; name: string; daysSinceLastBooking: number }[]
}

export interface ClassMarginResult {
  costsEntered: boolean
  byClassType: {
    classTypeId: string
    name: string
    revenuePerSession: number
    costPerSession: number | null
    marginPerSession: number | null
    sessionCount: number
  }[]
  topSlots: { label: string; margin: number }[]
  bottomSlots: { label: string; margin: number }[]
}

export interface LTVResult {
  ltv: number            // pesos ARS promedio por alumno — últimos 12 meses
  renewalRate: number    // 0–100
  ltvTrend: 'up' | 'down' | 'stable'
  renewalTrend: 'up' | 'down' | 'stable'
  sampleSize: number     // alumnas únicas en la muestra de LTV
}

export interface CashFlowProjectionResult {
  currentMonth: {
    guaranteed: number   // ingresos comprometidos (ya cobrado)
    month: string        // "YYYY-MM"
  }
  nextMonth: {
    projected: number
    month: string
  }
  twoMonths: {
    projected: number
    month: string
  }
}

export interface FinancialDashboard {
  breakEven: BreakEvenResult
  committedRevenue: CommittedRevenueResult
  revenueAtRisk: RevenueAtRiskResult
  classMargin: ClassMarginResult
  ltv: LTVResult
  cashFlow: CashFlowProjectionResult
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowAR(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
}

function monthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end   = new Date(Date.UTC(year, month, 1))
  return { start, end }
}

// ─── Bloque 1: Break-even ────────────────────────────────────────────────────

export async function getBreakEven(
  studioId: string,
  month: number,
  year: number,
): Promise<BreakEvenResult> {
  const { start, end } = monthBounds(year, month)

  const [costs, packages] = await Promise.all([
    prisma.studioFixedCosts.findUnique({
      where: { studioId_month_year: { studioId, month, year } },
      select: { rentCost: true, staffCost: true, otherCosts: true },
    }),
    prisma.userPackage.findMany({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        activatedAt: { gte: start, lt: end },
        packageId: { not: null },
        isRecovery: false,
        isTrial: false,
      },
      select: {
        package: { select: { price: true, classCount: true } },
        classesTotal: true,
      },
    }),
  ])

  const revenue = packages.reduce((sum, p) => sum + (p.package?.price ?? 0), 0) / 100
  const totalClassesSold = packages.reduce((sum, p) => sum + p.classesTotal, 0)
  const avgPricePerClass = totalClassesSold > 0 ? revenue / totalClassesSold : null

  if (!costs) {
    return {
      costsEntered: false,
      totalCosts: 0,
      revenue,
      result: revenue,
      breakEvenClasses: null,
      avgPricePerClass,
    }
  }

  const totalCosts = (costs.rentCost + costs.staffCost + costs.otherCosts) / 100
  const result = revenue - totalCosts
  const breakEvenClasses =
    avgPricePerClass && avgPricePerClass > 0
      ? Math.ceil(totalCosts / avgPricePerClass)
      : null

  return { costsEntered: true, totalCosts, revenue, result, breakEvenClasses, avgPricePerClass }
}

// ─── Bloque 2: Ingresos comprometidos ────────────────────────────────────────

export async function getCommittedRevenue(studioId: string): Promise<CommittedRevenueResult> {
  const now = new Date()
  const ar = nowAR()
  const lastMonthEnd = new Date(Date.UTC(ar.getFullYear(), ar.getMonth(), 1))
  const lastMonthStart = new Date(Date.UTC(ar.getFullYear(), ar.getMonth() - 1, 1))

  const [current, lastMonth] = await Promise.all([
    // Paquetes activos con créditos restantes — dinero ya cobrado, no consumido
    prisma.userPackage.findMany({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
        expiresAt: { gte: now },
        isRecovery: false,
        isTrial: false,
        packageId: { not: null },
      },
      select: {
        classesRemaining: true,
        package: { select: { price: true, classCount: true } },
      },
    }),
    // Mismo cálculo para el mes anterior (para comparativa)
    prisma.userPackage.findMany({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
        expiresAt: { gte: lastMonthStart, lt: lastMonthEnd },
        isRecovery: false,
        isTrial: false,
        packageId: { not: null },
      },
      select: {
        classesRemaining: true,
        package: { select: { price: true, classCount: true } },
      },
    }),
  ])

  const calcTotal = (pkgs: typeof current) =>
    pkgs.reduce((sum, p) => {
      if (!p.package || p.package.classCount === 0) return sum
      const pricePerClass = p.package.price / p.package.classCount
      return sum + pricePerClass * p.classesRemaining
    }, 0) / 100

  const total = calcTotal(current)
  const lastMonthTotal = calcTotal(lastMonth)

  const vsLastMonth = lastMonthTotal > 0 ? total - lastMonthTotal : null
  const vsLastMonthPct =
    lastMonthTotal > 0 ? Math.round(((total - lastMonthTotal) / lastMonthTotal) * 100) : null

  const avgCreditsRemaining =
    current.length > 0
      ? Math.round(current.reduce((s, p) => s + p.classesRemaining, 0) / current.length)
      : 0

  return { total, vsLastMonth, vsLastMonthPct, packagesCount: current.length, avgCreditsRemaining }
}

// ─── Bloque 3: Revenue en riesgo ─────────────────────────────────────────────
// ⚠️ Expone nombres — solo consumir desde endpoint admin autenticado

export async function getRevenueAtRisk(studioId: string): Promise<RevenueAtRiskResult> {
  const now = new Date()
  const in15Days  = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000)
  const ago21Days = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
  const ago45Days = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
  const ago90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const [expiringPkgs, churnRiskUsers, lostUsers] = await Promise.all([
    // Paquetes que vencen en ≤15 días con créditos restantes
    prisma.userPackage.findMany({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
        expiresAt: { gte: now, lte: in15Days },
        isRecovery: false,
        isTrial: false,
        packageId: { not: null },
      },
      select: {
        userId: true,
        user: { select: { name: true } },
        package: { select: { price: true, classCount: true } },
        classesRemaining: true,
      },
    }),

    // Alumnas que se están alejando: sin reserva en 21–45 días
    prisma.user.findMany({
      where: {
        studioId,
        role: 'STUDENT',
        active: true,
        bookings: {
          none: { status: 'CONFIRMED', classSession: { date: { gte: ago21Days } } },
          some: { status: 'CONFIRMED', classSession: { date: { gte: ago45Days } } },
        },
      },
      select: {
        id: true,
        name: true,
        userPackages: {
          where: { paymentStatus: 'APPROVED', packageId: { not: null }, isRecovery: false },
          orderBy: { activatedAt: 'desc' },
          take: 1,
          select: { package: { select: { price: true } } },
        },
      },
      take: 30,
    }),

    // Alumnas que ya se fueron: sin reserva en >45 días pero con historial reciente (≤90 días)
    prisma.user.findMany({
      where: {
        studioId,
        role: 'STUDENT',
        active: true,
        bookings: {
          none: { status: 'CONFIRMED', classSession: { date: { gte: ago45Days } } },
          some: { status: 'CONFIRMED', classSession: { date: { gte: ago90Days } } },
        },
      },
      select: {
        id: true,
        name: true,
        bookings: {
          where: { status: 'CONFIRMED' },
          orderBy: { classSession: { date: 'desc' } },
          take: 1,
          select: { classSession: { select: { date: true } } },
        },
      },
      take: 20,
    }),
  ])

  const studentsAtRisk: RevenueAtRiskResult['studentsAtRisk'] = []
  const seenUserIds = new Set<string>()

  // Paquetes por vencer — valor = precio proporcional a créditos restantes
  for (const pkg of expiringPkgs) {
    if (seenUserIds.has(pkg.userId)) continue
    seenUserIds.add(pkg.userId)
    const estimatedValue =
      pkg.package && pkg.package.classCount > 0
        ? Math.round((pkg.package.price / pkg.package.classCount) * pkg.classesRemaining) / 100
        : 0
    studentsAtRisk.push({
      userId: pkg.userId,
      name: pkg.user.name,
      estimatedValue,
      reason: 'expiring_package',
    })
  }

  // Alumnas alejándose — valor = precio del último paquete (estimación de renovación)
  for (const user of churnRiskUsers) {
    if (seenUserIds.has(user.id)) continue
    seenUserIds.add(user.id)
    const estimatedValue = (user.userPackages[0]?.package?.price ?? 0) / 100
    studentsAtRisk.push({
      userId: user.id,
      name: user.name,
      estimatedValue,
      reason: 'churn_risk',
    })
  }

  const totalAtRisk = studentsAtRisk.reduce((s, r) => s + r.estimatedValue, 0)

  // Alumnas que ya se fueron (informativo, sin valor monetario)
  const studentsLost: RevenueAtRiskResult['studentsLost'] = lostUsers
    .filter((u) => !seenUserIds.has(u.id))
    .map((u) => {
      const lastDate = u.bookings[0]?.classSession?.date
      const daysSince = lastDate
        ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / (24 * 60 * 60 * 1000))
        : 90
      return { userId: u.id, name: u.name, daysSinceLastBooking: daysSince }
    })

  return { totalAtRisk, studentsAtRisk, studentsLost }
}

// ─── Bloque 4: Margen por clase ───────────────────────────────────────────────

export async function getClassMargin(
  studioId: string,
  month: number,
  year: number,
): Promise<ClassMarginResult> {
  const { start, end } = monthBounds(year, month)
  const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const [costs, sessions] = await Promise.all([
    prisma.studioFixedCosts.findUnique({
      where: { studioId_month_year: { studioId, month, year } },
      select: { staffCost: true },
    }),
    prisma.classSession.findMany({
      where: {
        studioId,
        date: { gte: start, lt: end },
        cancelledAt: null,
      },
      select: {
        id: true,
        date: true,
        time: true,
        classType: { select: { id: true, name: true } },
        bookings: {
          where: { status: 'CONFIRMED', userPackageId: { not: null } },
          select: {
            userPackage: {
              select: {
                package: { select: { price: true, classCount: true } },
                isRecovery: true,
                isTrial: true,
              },
            },
          },
        },
      },
    }),
  ])

  const totalSessions = sessions.length
  const costPerSession =
    costs && totalSessions > 0 ? costs.staffCost / 100 / totalSessions : null

  // Agrupar revenue por classType
  const typeMap = new Map<
    string,
    { name: string; totalRevenue: number; sessionCount: number; sessionRevenues: number[] }
  >()

  for (const session of sessions) {
    const key = session.classType.id
    if (!typeMap.has(key)) {
      typeMap.set(key, {
        name: session.classType.name,
        totalRevenue: 0,
        sessionCount: 0,
        sessionRevenues: [],
      })
    }
    const entry = typeMap.get(key)!
    let sessionRevenue = 0
    for (const b of session.bookings) {
      const pkg = b.userPackage
      if (!pkg || pkg.isRecovery || pkg.isTrial || !pkg.package || pkg.package.classCount === 0)
        continue
      sessionRevenue += pkg.package.price / pkg.package.classCount
    }
    sessionRevenue /= 100
    entry.totalRevenue += sessionRevenue
    entry.sessionCount++
    entry.sessionRevenues.push(sessionRevenue)
  }

  const byClassType = [...typeMap.entries()].map(([classTypeId, data]) => {
    const revenuePerSession = data.sessionCount > 0 ? data.totalRevenue / data.sessionCount : 0
    const marginPerSession =
      costPerSession !== null ? revenuePerSession - costPerSession : null
    return {
      classTypeId,
      name: data.name,
      revenuePerSession: Math.round(revenuePerSession),
      costPerSession: costPerSession !== null ? Math.round(costPerSession) : null,
      marginPerSession: marginPerSession !== null ? Math.round(marginPerSession) : null,
      sessionCount: data.sessionCount,
    }
  })

  // Agrupar por slot (día + hora) para ranking
  const slotMap = new Map<string, number[]>()
  for (const session of sessions) {
    // Usar zona horaria Argentina para que el día de semana sea correcto (clases nocturnas)
    const arDate = new Date(new Date(session.date).toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
    const label = `${DAYS[arDate.getDay()]} ${session.time}`
    if (!slotMap.has(label)) slotMap.set(label, [])
    let sessionRevenue = 0
    for (const b of session.bookings) {
      const pkg = b.userPackage
      if (!pkg || pkg.isRecovery || pkg.isTrial || !pkg.package || pkg.package.classCount === 0)
        continue
      sessionRevenue += pkg.package.price / pkg.package.classCount
    }
    slotMap.get(label)!.push(sessionRevenue / 100)
  }

  const slotMargins = [...slotMap.entries()]
    .map(([label, revenues]) => {
      const avg = revenues.reduce((a, b) => a + b, 0) / revenues.length
      const margin = costPerSession !== null ? avg - costPerSession : avg
      return { label, margin: Math.round(margin) }
    })
    .sort((a, b) => b.margin - a.margin)

  return {
    costsEntered: !!costs,
    byClassType,
    topSlots: slotMargins.slice(0, 3),
    bottomSlots: slotMargins.slice(-3).reverse(),
  }
}

// ─── Bloque 5: LTV y tasa de renovación ──────────────────────────────────────

export async function getLTVAndRenewal(studioId: string): Promise<LTVResult> {
  const now = new Date()
  const twelveMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1))
  const threeMonthsAgo  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
  const sixMonthsAgo    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1))

  // LTV = últimos 12 meses (evita distorsión por inflación en historial largo)
  const recentPaid = await prisma.userPackage.findMany({
    where: {
      studioId,
      paymentStatus: 'APPROVED',
      packageId: { not: null },
      isRecovery: false,
      isTrial: false,
      activatedAt: { gte: twelveMonthsAgo },
    },
    select: { userId: true, package: { select: { price: true } }, activatedAt: true },
  })

  const uniqueStudents12m = new Set(recentPaid.map((p) => p.userId))
  const totalRevenue12m   = recentPaid.reduce((s, p) => s + (p.package?.price ?? 0), 0) / 100
  const ltv = uniqueStudents12m.size > 0 ? Math.round(totalRevenue12m / uniqueStudents12m.size) : 0
  const sampleSize = uniqueStudents12m.size

  // LTV de últimos 3 meses vs. 3 anteriores (tendencia)
  const recent3 = recentPaid.filter(
    (p) => p.activatedAt && new Date(p.activatedAt) >= threeMonthsAgo,
  )
  const prev3 = recentPaid.filter(
    (p) =>
      p.activatedAt &&
      new Date(p.activatedAt) >= sixMonthsAgo &&
      new Date(p.activatedAt) < threeMonthsAgo,
  )

  const ltvRecent =
    new Set(recent3.map((p) => p.userId)).size > 0
      ? recent3.reduce((s, p) => s + (p.package?.price ?? 0), 0) /
        100 /
        new Set(recent3.map((p) => p.userId)).size
      : 0
  const ltvPrev =
    new Set(prev3.map((p) => p.userId)).size > 0
      ? prev3.reduce((s, p) => s + (p.package?.price ?? 0), 0) /
        100 /
        new Set(prev3.map((p) => p.userId)).size
      : 0

  const ltvTrend: LTVResult['ltvTrend'] =
    ltvPrev === 0 ? 'stable' : ltvRecent > ltvPrev * 1.05 ? 'up' : ltvRecent < ltvPrev * 0.95 ? 'down' : 'stable'

  // Tasa de renovación: alumnas con primer paquete hace >30 días que compraron un 2do
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const renewalData = await prisma.userPackage.groupBy({
    by: ['userId'],
    where: {
      studioId,
      paymentStatus: 'APPROVED',
      packageId: { not: null },
      isRecovery: false,
      isTrial: false,
    },
    _count: { id: true },
    _min: { activatedAt: true },
  })

  const eligible = renewalData.filter(
    (r) => r._min.activatedAt && new Date(r._min.activatedAt) < thirtyDaysAgo,
  )
  const renewed = eligible.filter((r) => r._count.id >= 2)
  const renewalRate = eligible.length > 0 ? Math.round((renewed.length / eligible.length) * 100) : 0

  // Tendencia de renovación: últimos 3 meses vs. 3 anteriores
  const recentEligible = eligible.filter(
    (r) => r._min.activatedAt && new Date(r._min.activatedAt) >= threeMonthsAgo,
  )
  const prevEligible = eligible.filter(
    (r) =>
      r._min.activatedAt &&
      new Date(r._min.activatedAt) >= sixMonthsAgo &&
      new Date(r._min.activatedAt) < threeMonthsAgo,
  )

  const recentRenewalRate =
    recentEligible.length > 0
      ? recentEligible.filter((r) => r._count.id >= 2).length / recentEligible.length
      : 0
  const prevRenewalRate =
    prevEligible.length > 0
      ? prevEligible.filter((r) => r._count.id >= 2).length / prevEligible.length
      : 0

  const renewalTrend: LTVResult['renewalTrend'] =
    prevRenewalRate === 0
      ? 'stable'
      : recentRenewalRate > prevRenewalRate + 0.05
      ? 'up'
      : recentRenewalRate < prevRenewalRate - 0.05
      ? 'down'
      : 'stable'

  return { ltv, renewalRate, ltvTrend, renewalTrend, sampleSize }
}

// ─── Bloque 6: Proyección de caja 90 días ────────────────────────────────────

export async function getCashFlowProjection(studioId: string): Promise<CashFlowProjectionResult> {
  const ar = nowAR()
  const thisMonth = `${ar.getFullYear()}-${String(ar.getMonth() + 1).padStart(2, '0')}`
  const nextMonthDate = new Date(ar.getFullYear(), ar.getMonth() + 1, 1)
  const twoMonthsDate = new Date(ar.getFullYear(), ar.getMonth() + 2, 1)
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`
  const twoMonths = `${twoMonthsDate.getFullYear()}-${String(twoMonthsDate.getMonth() + 1).padStart(2, '0')}`

  const [committed, { renewalRate }, activePkgs] = await Promise.all([
    getCommittedRevenue(studioId),
    getLTVAndRenewal(studioId),
    prisma.userPackage.findMany({
      where: {
        studioId,
        paymentStatus: 'APPROVED',
        classesRemaining: { gt: 0 },
        expiresAt: { gte: new Date() },
        isRecovery: false,
        isTrial: false,
        packageId: { not: null },
      },
      select: { package: { select: { price: true } } },
    }),
  ])

  const avgPackagePrice =
    activePkgs.length > 0
      ? activePkgs.reduce((s, p) => s + (p.package?.price ?? 0), 0) / 100 / activePkgs.length
      : 0

  const renewalFactor = renewalRate / 100

  // Mes +1: alumnas activas × tasa de renovación × precio promedio
  // Mes +2: aplicar la misma tasa sobre el resultado del mes +1 (compuesto)
  const projectedNext = Math.round(activePkgs.length * renewalFactor * avgPackagePrice)
  const projectedTwo  = Math.round(projectedNext * renewalFactor)

  return {
    currentMonth: { guaranteed: Math.round(committed.total), month: thisMonth },
    nextMonth: { projected: projectedNext, month: nextMonth },
    twoMonths: { projected: projectedTwo, month: twoMonths },
  }
}

// ─── Dashboard completo ───────────────────────────────────────────────────────

export async function getFinancialDashboard(studioId: string): Promise<FinancialDashboard> {
  const ar = nowAR()
  const month = ar.getMonth() + 1
  const year = ar.getFullYear()

  const [breakEven, committedRevenue, revenueAtRisk, classMargin, ltv, cashFlow] =
    await Promise.all([
      getBreakEven(studioId, month, year),
      getCommittedRevenue(studioId),
      getRevenueAtRisk(studioId),
      getClassMargin(studioId, month, year),
      getLTVAndRenewal(studioId),
      getCashFlowProjection(studioId),
    ])

  return { breakEven, committedRevenue, revenueAtRisk, classMargin, ltv, cashFlow }
}
