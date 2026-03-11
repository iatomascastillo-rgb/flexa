import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function addClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const level = (formData.get('level') as string)?.trim()
  const defaultCapacity = parseInt(formData.get('defaultCapacity') as string, 10)

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!name || isNaN(defaultCapacity) || defaultCapacity < 1) return

  await prisma.classType.create({
    data: {
      studioId: tenant.studioId,
      name,
      description: description || null,
      level: level || null,
      defaultCapacity,
    },
  })

  revalidatePath(`/${studio}/onboarding/2`)
}

async function continueStep2Action(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  redirect(`/${studio}/onboarding/3`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

const LEVELS = ['Principiante', 'Intermedio', 'Avanzado', 'Todos los niveles']

export default async function OnboardingStep2({
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

  const classTypes = await prisma.classType.findMany({
    where: { studioId: tenant.studioId, active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, level: true, defaultCapacity: true },
  })

  const hasEnough = classTypes.length > 0

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Tipos de clase
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Agregá al menos una clase para continuar.
      </p>

      {/* Clases ya agregadas */}
      {classTypes.length > 0 && (
        <div className="mb-4 space-y-2">
          {classTypes.map((ct) => (
            <div
              key={ct.id}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{ct.name}</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {ct.level ? `${ct.level} · ` : ''}{ct.defaultCapacity} lugares
                </p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: '#EDF4ED', color: 'var(--sage)' }}
              >
                ✓
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Formulario agregar */}
      <form action={addClassTypeAction} className="mb-4">
        <input type="hidden" name="studio" value={studio} />
        <div
          className="space-y-3 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {classTypes.length === 0 ? 'Agregar primera clase' : 'Agregar otra'}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre <span style={{ color: 'var(--terracotta)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="Pilates Mat, Reformer, Yoga..."
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Nivel
              </label>
              <select
                name="level"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              >
                <option value="">Sin especificar</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Capacidad <span style={{ color: 'var(--terracotta)' }}>*</span>
              </label>
              <input
                type="number"
                name="defaultCapacity"
                min={1}
                max={50}
                defaultValue={8}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            + Agregar
          </button>
        </div>
      </form>

      {/* Continuar */}
      <form action={continueStep2Action}>
        <input type="hidden" name="studio" value={studio} />
        <button
          type="submit"
          disabled={!hasEnough}
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {hasEnough
            ? `Siguiente → (${classTypes.length} tipo${classTypes.length !== 1 ? 's' : ''})`
            : 'Agregá al menos un tipo de clase'}
        </button>
      </form>
    </div>
  )
}
