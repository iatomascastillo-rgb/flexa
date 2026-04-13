import { prisma } from '@/lib/prisma'
import StudioLoginForm from './_StudioLoginForm'

export default async function StudioLoginPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const studioData = await prisma.studio.findUnique({
    where:  { slug: studio },
    select: {
      name:     true,
      branding: { select: { logoUrl: true } },
    },
  })

  const studioName = studioData?.name ?? studio
  const logoUrl    = studioData?.branding?.logoUrl ?? null

  return <StudioLoginForm studio={studio} studioName={studioName} logoUrl={logoUrl} />
}
