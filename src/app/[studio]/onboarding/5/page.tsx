import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'

// ── Server Action ──────────────────────────────────────────────────────────────

async function continueStep5Action(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'STUDIO_ADMIN') return
  redirect(`/${studio}/onboarding/6`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingStep5({
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

  const steps = [
    {
      n: '1',
      title: 'Creá una cuenta en MercadoPago',
      body: 'Si no tenés una, registrate en mercadopago.com.ar con el email de tu estudio.',
    },
    {
      n: '2',
      title: 'Obtené tus credenciales',
      body: 'En tu cuenta MP → Tu negocio → Credenciales → Credenciales de producción. Copiá el Access Token y la Public Key.',
    },
    {
      n: '3',
      title: 'Configurá las variables de entorno',
      body: 'En Vercel, agregá: MP_ACCESS_TOKEN y NEXT_PUBLIC_MP_PUBLIC_KEY con los valores del paso anterior.',
    },
    {
      n: '4',
      title: 'Probá con el modo sandbox',
      body: 'Usá las credenciales de prueba de MP para testear pagos sin dinero real antes de salir a producción.',
    },
  ]

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Pagos con MercadoPago
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Para recibir pagos online de tus alumnas necesitás configurar MercadoPago.
        Podés hacerlo ahora o después — tus alumnas siempre pueden pagar en efectivo.
      </p>

      <div className="mb-6 space-y-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex gap-4 rounded-2xl px-4 py-4"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium"
              style={{ background: '#EDF4ED', color: 'var(--sage)' }}
            >
              {s.n}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{s.title}</p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Nota sobre pagos en efectivo */}
      <div
        className="mb-6 rounded-2xl px-4 py-3"
        style={{ background: '#FFF8F0', border: '1px solid #F0DEC8' }}
      >
        <p className="text-xs" style={{ color: '#C4774A' }}>
          <strong>Sin MP:</strong> las alumnas igual pueden reservar. El admin marca el pago como "efectivo" o "transferencia" desde el panel de cada alumna.
        </p>
      </div>

      <form action={continueStep5Action} className="space-y-3">
        <input type="hidden" name="studio" value={studio} />
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
