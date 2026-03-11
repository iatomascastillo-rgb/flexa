import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { BrandingForm } from './_BrandingForm'

export default async function BrandingSettingsPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const [studioData, branding] = await Promise.all([
    prisma.studio.findUnique({
      where: { id: tenant.studioId },
      select: { name: true },
    }),
    prisma.studioBranding.findUnique({
      where: { studioId: tenant.studioId },
      select: { primaryColor: true, accentColor: true, logoUrl: true, welcomeMessage: true },
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
      }}
    />
  )
}
