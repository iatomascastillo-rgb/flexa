import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import StudioLoginForm from './_StudioLoginForm'

export default async function StudioLoginPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  // Si la alumna ya tiene sesión activa, mandarla directo al estudio sin mostrar el login
  const session = await auth()
  if (session?.user) {
    redirect(`/${studio}`)
  }

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
