import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function saveMpTokenAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const token = (formData.get('mpAccessToken') as string)?.trim()

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  // Validar que el token tenga el formato correcto de MP (APP_USR- o TEST-)
  if (token && !token.startsWith('APP_USR-') && !token.startsWith('TEST-')) {
    redirect(`/${studio}/admin/settings/mercadopago?error=formato`)
  }

  await prisma.studioSettings.upsert({
    where: { studioId: tenant.studioId },
    update: { mpAccessToken: token || null },
    create: {
      studioId: tenant.studioId,
      mpAccessToken: token || null,
    },
  })

  revalidatePath(`/${studio}/admin/settings/mercadopago`)
  redirect(`/${studio}/admin/settings/mercadopago?saved=1`)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function MercadoPagoSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const [{ studio }, sp] = await Promise.all([params, searchParams])

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}/admin/settings/mercadopago`)
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') redirect(`/${studio}`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const settings = await prisma.studioSettings.findUnique({
    where: { studioId: tenant.studioId },
    select: { mpAccessToken: true },
  })

  const currentToken = settings?.mpAccessToken ?? ''
  // Ocultar el token: mostrar solo los últimos 6 caracteres
  const maskedToken = currentToken
    ? currentToken.slice(0, 8) + '••••••••••••••••' + currentToken.slice(-6)
    : ''

  const saved = sp.saved === '1'
  const errorFormato = sp.error === 'formato'

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/perfil`}
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
            MercadoPago
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Configurá los pagos online de tus alumnas
          </p>
        </div>
      </div>

      {/* Feedback */}
      {saved && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}
        >
          Token guardado correctamente. Los pagos online ya están activos.
        </div>
      )}
      {errorFormato && (
        <div
          className="mb-4 rounded-2xl px-4 py-3 text-sm"
          style={{ background: '#FEF3EE', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}
        >
          El token no tiene el formato correcto. Debe comenzar con APP_USR- (producción) o TEST- (pruebas).
        </div>
      )}

      {/* Estado actual */}
      <div
        className="mb-5 rounded-2xl px-5 py-4"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Estado
        </p>
        {currentToken ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--sage)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Activo</span>
            <span className="ml-auto font-mono text-xs" style={{ color: 'var(--stone)' }}>{maskedToken}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--terracotta)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--terracotta)' }}>Sin configurar</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--stone)' }}>— los pagos online están desactivados</span>
          </div>
        )}
      </div>

      {/* Tutorial paso a paso */}
      <div
        className="mb-5 rounded-2xl px-5 py-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          Cómo obtener tu token de MercadoPago
        </p>

        <ol className="space-y-4">
          <li className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--sage)' }}
            >1</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Ingresá a MercadoPago
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                Entrá a <span className="font-medium">mercadopago.com.ar</span> con la cuenta del estudio (la que recibe los cobros).
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--sage)' }}
            >2</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Ir a Tus integraciones
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                En el menú de tu perfil (arriba a la derecha), hacé click en{' '}
                <span className="font-medium">"Tus integraciones"</span>{' '}o buscá{' '}
                <span className="font-mono text-xs" style={{ background: '#F7F3EE', padding: '1px 4px', borderRadius: 4 }}>
                  mercadopago.com.ar/developers/panel
                </span>
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--sage)' }}
            >3</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Crear una aplicación
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                Hacé click en <span className="font-medium">"Crear aplicación"</span>. Poné cualquier nombre (ej: "Flexa"). En tipo de integración elegí <span className="font-medium">"Pagos online"</span>. Aceptá y creá.
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--sage)' }}
            >4</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Copiar el Production Access Token
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                Dentro de tu app, ir a <span className="font-medium">"Credenciales de producción"</span>. Copiá el campo{' '}
                <span className="font-medium">"Access Token"</span>. Empieza con{' '}
                <span className="font-mono text-xs" style={{ background: '#F7F3EE', padding: '1px 4px', borderRadius: 4 }}>APP_USR-</span>
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--stone)', opacity: 0.7 }}>
                Para pruebas podés usar las credenciales de prueba (empieza con TEST-).
              </p>
            </div>
          </li>

          <li className="flex gap-3">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ background: 'var(--sage)' }}
            >5</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Pegarlo abajo y guardar
              </p>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                Pegá el token en el campo de abajo y hacé click en "Guardar token".
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* Formulario */}
      <div
        className="rounded-2xl px-5 py-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {currentToken ? 'Actualizar token' : 'Ingresar token'}
        </p>
        <form action={saveMpTokenAction} className="space-y-3">
          <input type="hidden" name="studio" value={studio} />
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Access Token de MercadoPago
            </label>
            <input
              type="password"
              name="mpAccessToken"
              placeholder="APP_USR-xxxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border px-4 py-2.5 font-mono text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
            />
            <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
              El token nunca se muestra completo por seguridad. Para actualizarlo ingresá el nuevo.
            </p>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: 'var(--sage)' }}
          >
            Guardar token
          </button>
        </form>

        {currentToken && (
          <form action={saveMpTokenAction} className="mt-3">
            <input type="hidden" name="studio" value={studio} />
            <input type="hidden" name="mpAccessToken" value="" />
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}
            >
              Desconectar MercadoPago
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
