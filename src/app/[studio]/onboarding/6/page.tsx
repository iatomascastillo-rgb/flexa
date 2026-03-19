import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function inviteStudentAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const email = (formData.get('email') as string)?.toLowerCase().trim()
  const name = (formData.get('name') as string)?.trim()

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!email || !name) return

  // Verificar que no exista
  const existing = await prisma.user.findFirst({
    where: { studioId: tenant.studioId, email },
    select: { id: true },
  })
  if (existing) return

  // Crear con contraseña temporal (alumna deberá cambiarla — futuro flujo)
  // Usar randomBytes en lugar de Math.random() para mayor entropía
  const tempPassword = randomBytes(12).toString('base64url').slice(0, 12) + 'A1!'
  const passwordHash = await bcrypt.hash(tempPassword, 8)

  await prisma.user.create({
    data: {
      studioId: tenant.studioId,
      email,
      passwordHash,
      name,
      role: 'STUDENT',
      active: true,
    },
  })

  revalidatePath(`/${studio}/onboarding/6`)
}

async function finishOnboardingAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  redirect(`/${studio}`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingStep6({
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

  const students = await prisma.user.findMany({
    where: { studioId: tenant.studioId, role: 'STUDENT' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true },
  })

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Tus primeras alumnas
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Opcional. Podés agregar alumnas ahora o compartir el link de registro.
      </p>

      {/* Link de registro */}
      <div
        className="mb-5 rounded-2xl px-4 py-4"
        style={{ background: '#EDF4ED', border: '1px solid #C8DEC8' }}
      >
        <p className="mb-1 text-xs font-medium" style={{ color: 'var(--sage)' }}>
          Link de registro para alumnas
        </p>
        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {process.env.NEXT_PUBLIC_APP_URL ?? 'https://flexa.app'}/{studio}/unirse
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
          Compartí este link para que tus alumnas se registren solas.
        </p>
      </div>

      {/* Alumnas ya agregadas */}
      {students.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Alumnas registradas ({students.length})
          </p>
          <div className="space-y-1.5">
            {students.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl px-4 py-2.5"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                >
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.name}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--stone)' }}>{s.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agregar alumna manualmente */}
      <form action={inviteStudentAction} className="mb-4">
        <input type="hidden" name="studio" value={studio} />
        <div
          className="space-y-3 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Agregar alumna manualmente
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre
            </label>
            <input
              type="text"
              name="name"
              placeholder="Ana García"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              placeholder="ana@ejemplo.com"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <p className="text-xs" style={{ color: 'var(--stone)' }}>
            Se crea la cuenta con una contraseña temporal. La alumna puede cambiarla desde su perfil.
          </p>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            + Agregar alumna
          </button>
        </div>
      </form>

      {/* Finalizar */}
      <form action={finishOnboardingAction}>
        <input type="hidden" name="studio" value={studio} />
        <button
          type="submit"
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          ¡Listo! Ver mi estudio →
        </button>
      </form>
    </div>
  )
}
