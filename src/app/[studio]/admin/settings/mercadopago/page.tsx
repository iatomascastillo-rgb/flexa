import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function disconnectMpAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const guard  = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  await prisma.studioSettings.upsert({
    where:  { studioId },
    update: { mpAccessToken: null, mpRefreshToken: null, mpTokenExpiresAt: null },
    create: { studioId },
  })

  revalidatePath(`/${studio}/admin/settings/mercadopago`)
  redirect(`/${studio}/admin/settings/mercadopago`)
}

// Fallback: guardar token manualmente (para estudios que no usan OAuth)
async function saveManualTokenAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const token  = (formData.get('mpAccessToken') as string)?.trim()
  const guard  = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  if (token && !token.startsWith('APP_USR-') && !token.startsWith('TEST-')) {
    redirect(`/${studio}/admin/settings/mercadopago?error=formato`)
  }

  await prisma.studioSettings.upsert({
    where:  { studioId },
    update: { mpAccessToken: token || null, mpRefreshToken: null, mpTokenExpiresAt: null },
    create: { studioId, mpAccessToken: token || null },
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
  const { studioId }     = await requireStudioAdminPage(studio)

  const settings     = await prisma.studioSettings.findUnique({
    where:  { studioId },
    select: { mpAccessToken: true, mpTokenExpiresAt: true },
  })

  const isConnected  = Boolean(settings?.mpAccessToken)
  const oauthEnabled = Boolean(process.env.MP_CLIENT_ID)

  // Token enmascarado para mostrar en UI
  const token        = settings?.mpAccessToken ?? ''
  const maskedToken  = token
    ? token.slice(0, 8) + '••••••••••••••••' + token.slice(-6)
    : ''

  // Alerta de token próximo a vencer (< 7 días)
  const expiresAt   = settings?.mpTokenExpiresAt
  const daysToExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const nearExpiry  = daysToExpiry !== null && daysToExpiry <= 7 && daysToExpiry > 0
  const expired     = daysToExpiry !== null && daysToExpiry <= 0

  const saved        = sp.saved === '1'
  const errorFormato = sp.error === 'formato'
  const errorState   = sp.error === 'state'
  const errorToken   = sp.error === 'token'
  const errorDb      = sp.error === 'db'

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/admin`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-light leading-none" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
            MercadoPago
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Configurá los pagos online de tus alumnas
          </p>
        </div>
      </div>

      {/* Feedback */}
      {saved && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}>
          MercadoPago conectado correctamente. Los pagos online ya están activos.
        </div>
      )}
      {(errorFormato || errorState || errorToken || errorDb) && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEF3EE', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}>
          {errorFormato && 'El token no tiene el formato correcto. Debe comenzar con APP_USR-.'}
          {errorState   && 'El link de autorización venció o es inválido. Intentá conectar de nuevo.'}
          {errorToken   && 'MercadoPago rechazó la autorización. Intentá de nuevo.'}
          {errorDb      && 'Error al guardar la conexión. Intentá de nuevo.'}
        </div>
      )}
      {nearExpiry && !expired && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
          Tu conexión con MercadoPago vence en {daysToExpiry} día{daysToExpiry !== 1 ? 's' : ''}. Reconectá para no interrumpir los pagos.
        </div>
      )}
      {expired && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}>
          Tu conexión con MercadoPago venció. Los nuevos pagos online no funcionarán hasta que reconectes.
        </div>
      )}

      {/* Estado actual */}
      <div className="mb-5 rounded-2xl px-5 py-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Estado</p>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: expired ? '#EF4444' : nearExpiry ? '#F59E0B' : 'var(--sage)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              {expired ? 'Vencido' : nearExpiry ? 'Por vencer' : 'Conectado'}
            </span>
            <span className="ml-auto font-mono text-xs" style={{ color: 'var(--stone)' }}>{maskedToken}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--terracotta)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--terracotta)' }}>Sin conectar</span>
            <span className="ml-2 text-xs" style={{ color: 'var(--stone)' }}>— los pagos online están desactivados</span>
          </div>
        )}
      </div>

      {/* Botón OAuth principal */}
      {oauthEnabled && (
        <div className="mb-5 rounded-2xl px-5 py-5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {isConnected ? 'Reconectar cuenta' : 'Conectar con MercadoPago'}
          </p>
          <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
            {isConnected
              ? 'Hacé click para autorizar nuevamente con tu cuenta de MercadoPago.'
              : 'Hacé click, iniciá sesión en MercadoPago y autorizá a Flexa. No necesitás copiar ningún token.'}
          </p>
          <a
            href={`/api/${studio}/mp-oauth/connect`}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: '#009EE3' }}
          >
            {/* Logo MP simplificado */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.25" />
              <path d="M7 12h10M12 7l5 5-5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isConnected ? 'Reconectar con MercadoPago' : 'Conectar con MercadoPago'}
          </a>
        </div>
      )}

      {/* Desconectar */}
      {isConnected && (
        <div className="mb-5 rounded-2xl px-5 py-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>Desconectar</p>
          <p className="mb-3 text-xs" style={{ color: 'var(--stone)' }}>
            Al desconectar, las alumnas no podrán pagar online hasta que vuelvas a conectar.
          </p>
          <form action={disconnectMpAction}>
            <input type="hidden" name="studio" value={studio} />
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}
            >
              Desconectar MercadoPago
            </button>
          </form>
        </div>
      )}

      {/* Configuración manual — fallback si no hay OAuth o para usuarios avanzados */}
      <details className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E0D6' }}>
        <summary
          className="cursor-pointer px-5 py-4 text-sm font-medium select-none"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          Configuración manual (avanzado)
        </summary>
        <div className="px-5 pb-5 pt-3" style={{ background: 'white' }}>
          <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
            Si preferís ingresar el Access Token directamente desde el panel de MercadoPago,
            podés hacerlo acá. El token debe comenzar con <span className="font-mono" style={{ background: '#F7F3EE', padding: '1px 4px', borderRadius: 4 }}>APP_USR-</span>.
          </p>
          <form action={saveManualTokenAction} className="space-y-3">
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
                El token no se muestra completo por seguridad.
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
        </div>
      </details>
    </div>
  )
}
