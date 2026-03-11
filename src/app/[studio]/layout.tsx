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
      <BottomNav studio={studio} role={role} />
    </div>
  )
}
