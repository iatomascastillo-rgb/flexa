import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Actions ──────────────────────────────────────────────────────────────

async function addClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const level = (formData.get('level') as string)?.trim()
  const defaultCapacity = parseInt(formData.get('defaultCapacity') as string, 10)

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

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

  revalidatePath(`/${studio}/admin/settings/clases`)
}

async function editClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const level = (formData.get('level') as string)?.trim()
  const defaultCapacity = parseInt(formData.get('defaultCapacity') as string, 10)

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!name || isNaN(defaultCapacity) || defaultCapacity < 1) return

  await prisma.classType.update({
    where: { id: classTypeId, studioId: tenant.studioId },
    data: {
      name,
      description: description || null,
      level: level || null,
      defaultCapacity,
    },
  })

  revalidatePath(`/${studio}/admin/settings/clases`)
}

async function toggleClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const currentActive = formData.get('currentActive') === 'true'

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  await prisma.classType.update({
    where: { id: classTypeId, studioId: tenant.studioId },
    data: { active: !currentActive },
  })

  revalidatePath(`/${studio}/admin/settings/clases`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminClasesSettingsPage({
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

  const classTypes = await prisma.classType.findMany({
    where: { studioId: tenant.studioId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      level: true,
      defaultCapacity: true,
      active: true,
      _count: { select: { classSessions: { where: { cancelledAt: null } } } },
    },
  })

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
      {/* Header */}
      <Link
        href={`/${studio}/perfil`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--stone)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Perfil
      </Link>

      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Tipos de clase
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Gestioná los tipos de clase disponibles en tu estudio.
      </p>

      {/* Lista */}
      <div className="mb-6 space-y-3">
        {classTypes.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            No hay tipos de clase creados todavía.
          </p>
        )}

        {classTypes.map((ct) => (
          <div
            key={ct.id}
            className="rounded-2xl p-4"
            style={{
              background: 'white',
              border: `1px solid ${ct.active ? '#E8E0D6' : '#F0E8E0'}`,
              opacity: ct.active ? 1 : 0.65,
            }}
          >
            {/* Info + toggle */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium" style={{ color: 'var(--ink)' }}>{ct.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-2">
                  {ct.level && (
                    <span className="text-xs" style={{ color: 'var(--stone)' }}>
                      {ct.level}
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--stone)' }}>
                    · {ct.defaultCapacity} lugares
                  </span>
                  <span className="text-xs" style={{ color: 'var(--stone)' }}>
                    · {ct._count.classSessions} sesiones activas
                  </span>
                </div>
                {ct.description && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>{ct.description}</p>
                )}
              </div>

              <form action={toggleClassTypeAction}>
                <input type="hidden" name="studio" value={studio} />
                <input type="hidden" name="classTypeId" value={ct.id} />
                <input type="hidden" name="currentActive" value={String(ct.active)} />
                <button
                  type="submit"
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={ct.active
                    ? { background: '#EDF4ED', color: 'var(--sage)' }
                    : { background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                >
                  {ct.active ? 'Activo' : 'Inactivo'}
                </button>
              </form>
            </div>

            {/* Editar */}
            <details>
              <summary
                className="cursor-pointer text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--stone)', userSelect: 'none' }}
              >
                Editar
              </summary>
              <form action={editClassTypeAction} className="mt-3 space-y-3">
                <input type="hidden" name="studio" value={studio} />
                <input type="hidden" name="classTypeId" value={ct.id} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={ct.name}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Nivel
                    </label>
                    <input
                      type="text"
                      name="level"
                      defaultValue={ct.level ?? ''}
                      placeholder="ej: Principiante"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Capacidad *
                    </label>
                    <input
                      type="number"
                      name="defaultCapacity"
                      defaultValue={ct.defaultCapacity}
                      min={1}
                      max={100}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Descripción
                    </label>
                    <input
                      type="text"
                      name="description"
                      defaultValue={ct.description ?? ''}
                      placeholder="Descripción breve (opcional)"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'var(--sage)', color: 'white' }}
                >
                  Guardar cambios
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>

      {/* Agregar nuevo */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p
          className="mb-4 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--stone)' }}
        >
          Agregar tipo de clase
        </p>

        <form action={addClassTypeAction} className="space-y-3">
          <input type="hidden" name="studio" value={studio} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="ej: Pilates Reformer"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Nivel
              </label>
              <input
                type="text"
                name="level"
                placeholder="ej: Avanzado"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Capacidad *
              </label>
              <input
                type="number"
                name="defaultCapacity"
                required
                placeholder="8"
                min={1}
                max={100}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Descripción
              </label>
              <input
                type="text"
                name="description"
                placeholder="Descripción breve (opcional)"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            Agregar tipo de clase
          </button>
        </form>
      </div>
    </div>
  )
}
