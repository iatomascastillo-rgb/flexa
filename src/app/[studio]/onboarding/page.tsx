import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export default async function OnboardingIndexPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const [classTypesCount, packagesCount] = await Promise.all([
    prisma.classType.count({ where: { studioId: tenant.studioId } }),
    prisma.package.count({ where: { studioId: tenant.studioId } }),
  ])

  // Si ya tiene tipos de clase Y paquetes: onboarding completo
  if (classTypesCount > 0 && packagesCount > 0) {
    redirect(`/${studio}`)
  }

  redirect(`/${studio}/onboarding/1`)
}
