import { Cormorant_Garamond, DM_Sans, Playfair_Display, Lora, EB_Garamond, Inter, Nunito, Lato } from 'next/font/google'
import { prisma } from '@/lib/prisma'
import { getTenantBySlug } from '@/lib/tenant'
import { auth } from '@/lib/auth'
import { BottomNav } from './_components/BottomNav'
import OnboardingGuide from './_components/OnboardingGuide'

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

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const ebGaramond = EB_Garamond({
  variable: '--font-eb-garamond',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

const lato = Lato({
  variable: '--font-lato',
  subsets: ['latin'],
  weight: ['400', '700'],
})

const FONT_DISPLAY_MAP: Record<string, string> = {
  cormorant: 'var(--font-cormorant)',
  playfair: 'var(--font-playfair)',
  lora: 'var(--font-lora)',
  eb_garamond: 'var(--font-eb-garamond)',
}

const FONT_BODY_MAP: Record<string, string> = {
  dm_sans: 'var(--font-dm-sans)',
  inter: 'var(--font-inter)',
  nunito: 'var(--font-nunito)',
  lato: 'var(--font-lato)',
}

const ALL_FONT_CLASSES = [
  cormorant.variable,
  dmSans.variable,
  playfair.variable,
  lora.variable,
  ebGaramond.variable,
  inter.variable,
  nunito.variable,
  lato.variable,
].join(' ')

// ── Layout ────────────────────────────────────────────────────────────────────

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

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
        instructorPending = unregistered.length
      }
    } catch {
      // No bloquear el layout si falla
    }
  }

  const branding = tenant
    ? await prisma.studioBranding.findUnique({
        where: { studioId: tenant.studioId },
        select: {
          primaryColor: true,
          accentColor: true,
          fontDisplay: true,
          fontBody: true,
          backgroundColor: true,
          darkMode: true,
          navColor: true,
        },
      }).catch(() => null)
    : null

  // Construir override de CSS variables
  const brandingStyle: Record<string, string> = {}
  if (branding?.primaryColor) {
    brandingStyle['--sage'] = branding.primaryColor
    brandingStyle['--sage-light'] = branding.primaryColor + 'CC'
  }
  if (branding?.accentColor) {
    brandingStyle['--terracotta'] = branding.accentColor
    brandingStyle['--terracotta-light'] = branding.accentColor + '28'
  }
  if (branding?.backgroundColor) {
    brandingStyle['--cream'] = branding.backgroundColor
  }
  if (branding?.fontDisplay && FONT_DISPLAY_MAP[branding.fontDisplay]) {
    brandingStyle['--font-display'] = FONT_DISPLAY_MAP[branding.fontDisplay]
  }
  if (branding?.fontBody && FONT_BODY_MAP[branding.fontBody]) {
    brandingStyle['--font-body'] = FONT_BODY_MAP[branding.fontBody]
  }

  const darkModeClass = branding?.darkMode ? ' studio-dark' : ''

  return (
    <div
      className={`${ALL_FONT_CLASSES}${darkModeClass}`}
      style={brandingStyle as React.CSSProperties}
    >
      <main
        className="min-h-screen pb-20"
        style={{ background: 'var(--cream)', fontFamily: 'var(--font-body, var(--font-dm-sans, sans-serif))' }}
      >
        {children}
      </main>
      <BottomNav studio={studio} role={role} pendingCount={instructorPending} navColor={branding?.navColor ?? undefined} />
      {(role === 'STUDENT' || role === 'INSTRUCTOR') && (
        <OnboardingGuide studio={studio} role={role as 'STUDENT' | 'INSTRUCTOR'} />
      )}
    </div>
  )
}
