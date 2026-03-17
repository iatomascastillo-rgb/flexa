import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import { getTenantBySlug } from '@/lib/tenant'
import { auth } from '@/lib/auth'
import { BottomNav } from './_components/BottomNav'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '600'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  // Branding del estudio (no bloquea si no existe)
  const [tenant, session] = await Promise.all([
    getTenantBySlug(studio).catch(() => null),
    auth(),
  ])
  const role = session?.user?.role ?? 'STUDENT'

  // Para instructores: calcular sesiones pasadas con asistencia pendiente
  let instructorPending = 0
  if (role === 'INSTRUCTOR' && tenant) {
    try {
      const now = new Date()
      const arMs = now.getTime() + -3 * 60 * 60_000
      const ar = new Date(arMs)
      const todayUTC = new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth(), ar.getUTCDate()))
      const yesterdayUTC = new Date(todayUTC.getTime() - 86_400_000)
      const nowMin = ar.getUTCHours() * 60 + ar.getUTCMinutes()

      // Sesiones de ayer + hoy (hasta hora actual -30min)
      const pastSessions = await prisma.classSession.findMany({
        where: {
          studioId: tenant.studioId,
          cancelledAt: null,
          date: { gte: yesterdayUTC, lte: todayUTC },
        },
        select: { id: true, date: true, time: true },
      })

      const pastIds = pastSessions
        .filter((s) => {
          const isYesterday = s.date.getTime() === yesterdayUTC.getTime()
          const isToday = s.date.getTime() === todayUTC.getTime()
          const [h, m] = s.time.split(':').map(Number)
          const sessionMin = h * 60 + m
          return isYesterday || (isToday && sessionMin < nowMin - 30)
        })
        .map((s) => s.id)

      if (pastIds.length > 0) {
        // Contar bookings confirmadas sin attendanceStatus por sesión
        const unregistered = await prisma.booking.groupBy({
          by: ['classSessionId'],
          where: {
            studioId: tenant.studioId,
            classSessionId: { in: pastIds },
            status: 'CONFIRMED',
            attendanceStatus: null,
          },
          _count: { id: true },
          having: { id: { _count: { gt: 0 } } },
        })
        instructorPending = unregistered.length // cantidad de sesiones con pendientes
      }
    } catch {
      // No bloquear el layout si falla
    }
  }

  const branding = tenant
    ? await prisma.studioBranding.findUnique({
        where: { studioId: tenant.studioId },
        select: { primaryColor: true, accentColor: true },
      }).catch(() => null)
    : null

  // Construir override de CSS variables solo si el estudio tiene branding propio
  const brandingStyle: React.CSSProperties = {}
  if (branding?.primaryColor) {
    // --sage es el color primario en todo el sistema de diseño
    ;(brandingStyle as Record<string, string>)['--sage'] = branding.primaryColor
    // Variante más clara: mezclar con blanco a ~60% — aproximación via hex
    ;(brandingStyle as Record<string, string>)['--sage-light'] = branding.primaryColor + 'CC'
  }
  if (branding?.accentColor) {
    ;(brandingStyle as Record<string, string>)['--terracotta'] = branding.accentColor
    ;(brandingStyle as Record<string, string>)['--terracotta-light'] = branding.accentColor + '28'
  }

  return (
    <div
      className={`${cormorant.variable} ${dmSans.variable}`}
      style={brandingStyle}
    >
      <main
        className="min-h-screen pb-20"
        style={{ background: 'var(--cream)', fontFamily: 'var(--font-dm-sans, sans-serif)' }}
      >
        {children}
      </main>
      <BottomNav studio={studio} role={role} pendingCount={instructorPending} />
    </div>
  )
}
