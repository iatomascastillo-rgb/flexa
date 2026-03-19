import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

// ── Server Actions ──────────────────────────────────────────────────────────────

async function addPackageAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const classCount = parseInt(formData.get('classCount') as string, 10)
  const priceARS = parseInt(formData.get('price') as string, 10)

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard
  if (!name || isNaN(classCount) || classCount < 1 || isNaN(priceARS) || priceARS < 0) return

  await prisma.package.create({
    data: {
      studioId,
      name,
      classCount,
      price: priceARS * 100, // centavos ARS
    },
  })

  revalidatePath(`/${studio}/admin/settings/paquetes`)
}

async function editPackageAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const packageId = formData.get('packageId') as string
  const name = (formData.get('name') as string)?.trim()
  const classCount = parseInt(formData.get('classCount') as string, 10)
  const priceARS = parseInt(formData.get('price') as string, 10)

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard
  if (!name || isNaN(classCount) || classCount < 1 || isNaN(priceARS) || priceARS < 0) return

  await prisma.package.update({
    where: { id: packageId, studioId },
    data: {
      name,
      classCount,
      price: priceARS * 100,
    },
  })

  revalidatePath(`/${studio}/admin/settings/paquetes`)
}

async function togglePackageAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const packageId = formData.get('packageId') as string
  const currentActive = formData.get('currentActive') === 'true'

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  await prisma.package.update({
    where: { id: packageId, studioId },
    data: { active: !currentActive },
  })

  revalidatePath(`/${studio}/admin/settings/paquetes`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtARS(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPaquetesSettingsPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  const packages = await prisma.package.findMany({
    where: { studioId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      classCount: true,
      price: true,
      active: true,
      _count: { select: { userPackages: { where: { paymentStatus: 'APPROVED' } } } },
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
        Paquetes
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Configurá los paquetes de clases disponibles para tus alumnas.
      </p>

      {/* Lista */}
      <div className="mb-6 space-y-3">
        {packages.length === 0 && (
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            No hay paquetes creados todavía.
          </p>
        )}

        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className="rounded-2xl p-4"
            style={{
              background: 'white',
              border: `1px solid ${pkg.active ? '#E8E0D6' : '#F0E8E0'}`,
              opacity: pkg.active ? 1 : 0.65,
            }}
          >
            {/* Info + toggle */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium" style={{ color: 'var(--ink)' }}>{pkg.name}</p>
                <div className="mt-0.5 flex gap-3">
                  <span
                    className="text-2xl font-light leading-none"
                    style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--sage)' }}
                  >
                    {fmtARS(pkg.price)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                  {pkg.classCount} clases · {pkg._count.userPackages} ventas totales
                </p>
              </div>

              <form action={togglePackageAction}>
                <input type="hidden" name="studio" value={studio} />
                <input type="hidden" name="packageId" value={pkg.id} />
                <input type="hidden" name="currentActive" value={String(pkg.active)} />
                <button
                  type="submit"
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                  style={pkg.active
                    ? { background: '#EDF4ED', color: 'var(--sage)' }
                    : { background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                >
                  {pkg.active ? 'Activo' : 'Inactivo'}
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
              <form action={editPackageAction} className="mt-3 space-y-3">
                <input type="hidden" name="studio" value={studio} />
                <input type="hidden" name="packageId" value={pkg.id} />

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Nombre *
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={pkg.name}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Cantidad de clases *
                    </label>
                    <input
                      type="number"
                      name="classCount"
                      defaultValue={pkg.classCount}
                      min={1}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                      Precio (ARS) *
                    </label>
                    <input
                      type="number"
                      name="price"
                      defaultValue={pkg.price / 100}
                      min={0}
                      required
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  Cambiar el precio no afecta paquetes ya vendidos.
                </p>

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
          Agregar paquete
        </p>

        <form action={addPackageAction} className="space-y-3">
          <input type="hidden" name="studio" value={studio} />

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre *
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="ej: Pack 8 clases"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Cantidad de clases *
              </label>
              <input
                type="number"
                name="classCount"
                required
                placeholder="8"
                min={1}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Precio (ARS) *
              </label>
              <input
                type="number"
                name="price"
                required
                placeholder="24000"
                min={0}
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
            Agregar paquete
          </button>
        </form>
      </div>
    </div>
  )
}
