import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Action ──────────────────────────────────────────────────────────────

async function saveStudioInfoAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const welcome = (formData.get('welcome') as string)?.trim()

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!name) return

  await prisma.studio.update({
    where: { id: tenant.studioId },
    data: { name },
  })

  await prisma.studioBranding.upsert({
    where: { studioId: tenant.studioId },
    update: { welcomeMessage: welcome || null },
    create: { studioId: tenant.studioId, welcomeMessage: welcome || null },
  })

  revalidatePath(`/${studio}/onboarding/1`)
  redirect(`/${studio}/onboarding/2`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingStep1({
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

  const studioData = await prisma.studio.findUnique({
    where: { id: tenant.studioId },
    select: { name: true, branding: { select: { welcomeMessage: true } } },
  })

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Tu estudio
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Empecemos con los datos básicos.
      </p>

      <form action={saveStudioInfoAction} className="space-y-4">
        <input type="hidden" name="studio" value={studio} />

        <div
          className="space-y-4 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre del estudio <span style={{ color: 'var(--terracotta)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={studioData?.name ?? ''}
              placeholder="Centro Pilates Buenos Aires"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Mensaje de bienvenida <span className="opacity-60">(opcional)</span>
            </label>
            <input
              type="text"
              name="welcome"
              maxLength={120}
              defaultValue={studioData?.branding?.welcomeMessage ?? ''}
              placeholder="¡Bienvenida a nuestro espacio!"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
              Aparece en el header de tu estudio
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          Siguiente →
        </button>
      </form>
    </div>
  )
}
