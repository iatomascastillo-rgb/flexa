import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function addPackageAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const classCount = parseInt(formData.get('classCount') as string, 10)
  const priceARS = parseInt(formData.get('price') as string, 10) // ingresado en ARS entero

  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return
  if (!name || isNaN(classCount) || classCount < 1 || isNaN(priceARS) || priceARS < 0) return

  await prisma.package.create({
    data: {
      studioId: tenant.studioId,
      name,
      classCount,
      price: priceARS * 100, // centavos ARS
    },
  })

  revalidatePath(`/${studio}/onboarding/4`)
}

async function continueStep4Action(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  redirect(`/${studio}/onboarding/5`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingStep4({
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

  const packages = await prisma.package.findMany({
    where: { studioId: tenant.studioId, active: true },
    orderBy: { classCount: 'asc' },
    select: { id: true, name: true, classCount: true, price: true },
  })

  const hasEnough = packages.length > 0

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Paquetes y precios
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Definí qué paquetes de clases podés vender. Precio en pesos argentinos.
      </p>

      {/* Paquetes ya creados */}
      {packages.length > 0 && (
        <div className="mb-4 space-y-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{pkg.name}</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {pkg.classCount} clase{pkg.classCount !== 1 ? 's' : ''}
                </p>
              </div>
              <span
                className="text-lg font-light"
                style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--sage)' }}
              >
                {fmtPrice(pkg.price)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Agregar paquete */}
      <form action={addPackageAction} className="mb-4">
        <input type="hidden" name="studio" value={studio} />
        <div
          className="space-y-3 rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {packages.length === 0 ? 'Crear primer paquete' : 'Agregar otro'}
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre <span style={{ color: 'var(--terracotta)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="Pack 4 clases, Pack mensual..."
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Cantidad de clases <span style={{ color: 'var(--terracotta)' }}>*</span>
              </label>
              <input
                type="number"
                name="classCount"
                min={1}
                max={100}
                defaultValue={4}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Precio (ARS) <span style={{ color: 'var(--terracotta)' }}>*</span>
              </label>
              <input
                type="number"
                name="price"
                min={0}
                step={100}
                defaultValue={24000}
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
            + Agregar paquete
          </button>
        </div>
      </form>

      {/* Continuar */}
      <form action={continueStep4Action}>
        <input type="hidden" name="studio" value={studio} />
        <button
          type="submit"
          disabled={!hasEnough}
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85 disabled:opacity-40"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {hasEnough
            ? `Siguiente → (${packages.length} paquete${packages.length !== 1 ? 's' : ''})`
            : 'Agregá al menos un paquete'}
        </button>
      </form>
    </div>
  )
}
