import { requireStudioAdminPage } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { BrandingForm } from './_BrandingForm'

export default async function BrandingSettingsPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  const [studioData, branding] = await Promise.all([
    prisma.studio.findUnique({
      where: { id: studioId },
      select: { name: true },
    }),
    prisma.studioBranding.findUnique({
      where: { studioId },
      select: {
        primaryColor: true,
        accentColor: true,
        logoUrl: true,
        welcomeMessage: true,
        fontDisplay: true,
        fontBody: true,
        backgroundColor: true,
        coverUrl: true,
        darkMode: true,
        navColor: true,
        instagramUrl: true,
        whatsappUrl: true,
        websiteUrl: true,
      },
    }),
  ])

  return (
    <BrandingForm
      studio={studio}
      studioName={studioData?.name ?? studio}
      initial={{
        primaryColor: branding?.primaryColor ?? '#5C7A5E',
        accentColor: branding?.accentColor ?? '#C4774A',
        logoUrl: branding?.logoUrl ?? null,
        welcomeMessage: branding?.welcomeMessage ?? '',
        fontDisplay: branding?.fontDisplay ?? 'cormorant',
        fontBody: branding?.fontBody ?? 'dm_sans',
        backgroundColor: branding?.backgroundColor ?? '#F7F3EE',
        coverUrl: branding?.coverUrl ?? null,
        darkMode: branding?.darkMode ?? false,
        navColor: branding?.navColor ?? '',
        instagramUrl: branding?.instagramUrl ?? '',
        whatsappUrl: branding?.whatsappUrl ?? '',
        websiteUrl: branding?.websiteUrl ?? '',
      }}
    />
  )
}
