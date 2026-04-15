import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'
import { BuyButton } from './BuyButton'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaquetesPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ payment?: string }>
}) {
  const { studio } = await params
  const { payment } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect(`/${studio}/login?callbackUrl=/${studio}/paquetes`)

  // Admins van a la gestión de paquetes; instructores vuelven al inicio
  if (session.user.role === 'STUDIO_ADMIN') redirect(`/${studio}/admin/settings/paquetes`)
  if (session.user.role === 'INSTRUCTOR') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect(`/${studio}/login?callbackUrl=/${studio}/paquetes`)

  const studioId = tenant.studioId
  const userId = session.user.id

  const [packages, pendingPackage, creditPackages] = await Promise.all([
    // Paquetes activos del estudio para comprar
    prisma.package.findMany({
      where: { studioId, active: true },
      orderBy: { price: 'asc' },
      select: { id: true, name: true, classCount: true, price: true },
    }),

    // Paquete pendiente de pago del alumno (más reciente)
    prisma.userPackage.findFirst({
      where: { userId, studioId, paymentStatus: 'PENDING', paymentMethod: 'MERCADOPAGO' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        classesTotal: true,
        package: { select: { name: true, price: true } },
      },
    }),

    // Créditos actuales del alumno
    prisma.userPackage.findMany({
      where: { userId, studioId, paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
      orderBy: { expiresAt: 'asc' },
      select: { classesRemaining: true },
    }),
  ])

  const totalCredits = creditPackages.reduce((s, p) => s + p.classesRemaining, 0)
  const hasMpConfigured = Boolean(process.env.MP_ACCESS_TOKEN)

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1
            className="text-3xl font-light leading-none"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Paquetes
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            {totalCredits > 0
              ? `Tenés ${totalCredits} crédito${totalCredits !== 1 ? 's' : ''} disponibles`
              : 'Sin créditos disponibles'}
          </p>
        </div>
      </div>

      {/* Feedback de pago */}
      {payment === 'success' && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: '#EDF4ED', border: '1px solid var(--sage)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--sage)' }}>
            ¡Pago recibido!
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Tus créditos se acreditarán en los próximos segundos. Si no los ves, refrescá la página.
          </p>
        </div>
      )}

      {payment === 'failure' && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: '#FFF0ED', border: '1px solid var(--terracotta)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--terracotta)' }}>
            El pago no se completó
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Podés intentarlo nuevamente o contactar al estudio.
          </p>
        </div>
      )}

      {payment === 'pending' && (
        <div
          className="mb-5 rounded-2xl p-4"
          style={{ background: '#FFF8F0', border: '1px solid #D4A04A' }}
        >
          <p className="text-sm font-medium" style={{ color: '#D4A04A' }}>
            Pago en proceso
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Tu pago está siendo procesado. Te avisaremos cuando se confirme.
          </p>
        </div>
      )}

      {/* Paquete pendiente de pago */}
      {pendingPackage && payment !== 'success' && (
        <div
          className="mb-5 flex items-center justify-between rounded-2xl p-4"
          style={{ background: '#FFF8F0', border: '1px solid var(--terracotta)' }}
        >
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Pago pendiente
            </p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>
              {pendingPackage.package?.name ?? `${pendingPackage.classesTotal} clases`}
              {pendingPackage.package?.price
                ? ` · ${fmtPrice(pendingPackage.package.price)}`
                : ''}
            </p>
          </div>
          <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}>
            PENDIENTE
          </span>
        </div>
      )}

      {/* Sin paquetes */}
      {packages.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            El estudio no tiene paquetes disponibles por el momento.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-2xl p-5"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              {/* Info del paquete */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--ink)' }}>
                    {pkg.name}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                    {pkg.classCount} clase{pkg.classCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span
                  className="text-2xl font-light"
                  style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
                >
                  {fmtPrice(pkg.price)}
                </span>
              </div>

              {/* Precio por clase */}
              <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
                {fmtPrice(Math.round(pkg.price / pkg.classCount))} por clase
              </p>

              {hasMpConfigured ? (
                <BuyButton studio={studio} packageId={pkg.id} />
              ) : (
                <p className="text-center text-xs" style={{ color: 'var(--stone)' }}>
                  Pagos online no disponibles. Contactá al estudio.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nota al pie */}
      <p className="mt-6 text-center text-xs" style={{ color: 'var(--stone)' }}>
        Los paquetes vencen el último día del mes en que se activan.
        Pagos procesados por MercadoPago — tu información está protegida.
      </p>
    </div>
  )
}
