'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

const safeSlug  = (s: string) => s.replace(/[^a-z0-9-]/g, '').slice(0, 40)
const safeEmail = (s: string) => s.slice(0, 254)

interface Props {
  studio:     string
  studioName: string
  logoUrl:    string | null
}

// ─── Guía iOS "Agregar a pantalla de inicio" ──────────────────────────────────

function IOSGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl px-6 pb-10 pt-6"
        style={{ background: 'var(--cream, #F7F3EE)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <p className="text-base font-medium" style={{ color: 'var(--ink)' }}>
            Guardar en pantalla de inicio
          </p>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--stone)' }}>×</button>
        </div>
        <div className="space-y-4">
          {[
            {
              step: '1',
              text: (
                <>
                  Tocá el botón{' '}
                  <strong>Compartir</strong>
                  {' '}en la barra de abajo de Safari
                </>
              ),
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              ),
            },
            {
              step: '2',
              text: (
                <>
                  Buscá <strong>"Agregar a pantalla de inicio"</strong> y tocalo
                </>
              ),
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
                </svg>
              ),
            },
            {
              step: '3',
              text: (
                <>
                  Confirmá tocando <strong>"Agregar"</strong> — listo, queda el ícono en tu pantalla
                </>
              ),
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="10" />
                </svg>
              ),
            },
          ].map(({ step, text, icon }) => (
            <div key={step} className="flex items-start gap-3">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                {step}
              </div>
              <div className="flex flex-1 items-start gap-2 pt-0.5">
                <span style={{ color: 'var(--stone)' }}>{icon}</span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs text-center" style={{ color: 'var(--stone)' }}>
          La próxima vez que abras el ícono, vas a entrar directo sin escribir tu contraseña.
        </p>
      </div>
    </div>
  )
}

// ─── Botón de instalación PWA ─────────────────────────────────────────────────

function PWAInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null)
  const [isIOS, setIsIOS]               = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [installed, setInstalled]       = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    setIsStandalone(standalone)

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream
    setIsIOS(!!ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // No mostrar si ya está instalada como PWA o si no hay nada que instalar
  if (isStandalone || installed) return null
  if (!installPrompt && !isIOS) return null

  async function handleInstall() {
    if (isIOS) {
      setShowIOSGuide(true)
      return
    }
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  return (
    <>
      {showIOSGuide && <IOSGuideModal onClose={() => setShowIOSGuide(false)} />}
      <button
        onClick={handleInstall}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm transition-colors hover:bg-white"
        style={{ borderColor: '#E8E0D6', color: 'var(--stone)', background: 'transparent' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        Guardar en pantalla de inicio
      </button>
    </>
  )
}

// ─── Formulario ───────────────────────────────────────────────────────────────

function Form({ studio, studioName, logoUrl }: Props) {
  const searchParams = useSearchParams()

  const rawCallback = searchParams.get('callbackUrl') ?? '/'
  const callbackUrl =
    rawCallback.startsWith('/') && !rawCallback.startsWith('//')
      ? rawCallback
      : '/'

  const redirectTarget = callbackUrl !== '/' ? callbackUrl : `/${studio}`

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const saved = safeEmail(localStorage.getItem('flexa_email') ?? '')
      if (saved) {
        setEmail(saved)
        // Si ya hay email guardado, enfocar directo la contraseña
        setTimeout(() => passwordRef.current?.focus(), 100)
      }
    } catch {}
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email:      email.trim().toLowerCase(),
      password,
      studioSlug: studio,
      redirect:   false,
    })

    if (result?.error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
    } else {
      try {
        localStorage.setItem('flexa_email', email.trim().toLowerCase())
        localStorage.setItem('flexa_last_studio', safeSlug(studio))
      } catch {}
      window.location.href = redirectTarget
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--cream)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / nombre del estudio */}
        <div className="mb-8 flex flex-col items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={studioName}
              className="max-h-20 max-w-[10rem] object-contain"
              style={{ borderRadius: 12, background: 'white', padding: 4, border: '1px solid #E8E0D6' }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-medium"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              {studioName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-center">
            <h1
              className="text-3xl font-light"
              style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
            >
              {studioName}
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--stone)' }}>
              Ingresá a tu cuenta
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              autoComplete="email"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Contraseña
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-85"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Botón de instalación PWA */}
        <PWAInstallButton />

        <p className="mt-5 text-center text-sm" style={{ color: 'var(--stone)' }}>
          ¿Sos nueva?{' '}
          <a href={`/${studio}/unirse`} className="font-medium" style={{ color: 'var(--sage)' }}>
            Registrate acá
          </a>
        </p>
      </div>
    </div>
  )
}

export default function StudioLoginForm(props: Props) {
  return (
    <Suspense>
      <Form {...props} />
    </Suspense>
  )
}
