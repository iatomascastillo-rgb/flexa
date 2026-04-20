'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

const safeSlug  = (s: string) => s.replace(/[^a-z0-9-]/g, '').slice(0, 40)
const safeEmail = (s: string) => s.slice(0, 254)

// ── Formulario ────────────────────────────────────────────────────────────────

function LoginForm() {
  const searchParams = useSearchParams()

  // callbackUrl viene de NextAuth: "?callbackUrl=/centro-pilates"
  // Validar que sea una ruta relativa para evitar open redirect
  const rawCallback = searchParams.get('callbackUrl') ?? '/'
  const callbackUrl =
    rawCallback.startsWith('/') && !rawCallback.startsWith('//')
      ? rawCallback
      : '/'

  // Extraer slug solo si el primer segmento es un studio real, no una ruta reservada
  const RESERVED = new Set(['superadmin', 'api', 'auth', 'login', 'registro', 'auth-test'])
  const firstSegment = callbackUrl.replace(/^\//, '').split('/')[0] ?? ''
  // ?studio=xxx permite pre-llenar el campo cuando callbackUrl es una ruta reservada (ej: /superadmin)
  const studioParam = searchParams.get('studio') ?? ''
  const studioSlug = RESERVED.has(firstSegment) ? studioParam : firstSegment

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [slug, setSlug] = useState(studioSlug)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const lastStudio = safeSlug(localStorage.getItem('flexa_last_studio') ?? '')
      const lastEmail  = safeEmail(localStorage.getItem('flexa_email') ?? '')
      if (!slug && lastStudio) setSlug(lastStudio)
      if (!email && lastEmail) setEmail(lastEmail)
      // Auto-redirect: si tenemos estudio guardado y no hay contexto en la URL, ir directo a su login
      if (lastStudio && !studioSlug && !rawCallback.includes('/superadmin')) {
        window.location.replace(`/${lastStudio}/login`)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      studioSlug: slug.trim().toLowerCase(),
      redirect: false,
    })

    if (result?.error) {
      setError('Email, contraseña o estudio incorrectos.')
      setLoading(false)
    } else {
      try {
        localStorage.setItem('flexa_email', email.trim().toLowerCase())
        if (slug) localStorage.setItem('flexa_last_studio', safeSlug(slug.trim().toLowerCase()))
      } catch {}
      // Full page navigation so Vercel's serverless functions receive the new session cookie
      const dest = callbackUrl !== '/' ? callbackUrl : slug ? `/${slug}` : '/superadmin'
      window.location.href = dest
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--cream)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/flexa-logo.svg" alt="Flexa" className="h-16 w-16" />
          <div className="text-center">
            <h1
              className="text-3xl font-light"
              style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
            >
              Flexa
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--stone)' }}>
              Ingresá a tu estudio
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          {/* Studio slug */}
          <div>
            <label
              htmlFor="slug"
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--stone)' }}
            >
              Estudio
            </label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="centro-pilates"
              autoCapitalize="none"
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--stone)' }}
            >
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
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--stone)' }}
            >
              Contraseña
            </label>
            <input
              id="password"
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
            <p
              className="rounded-xl px-3 py-2 text-xs"
              style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
            >
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

        {slug && (
          <p className="mt-5 text-center text-sm" style={{ color: 'var(--stone)' }}>
            ¿Sos nueva?{' '}
            <a href={`/${slug}/unirse`} className="font-medium" style={{ color: 'var(--sage)' }}>
              Registrate acá
            </a>
          </p>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Suspense requerido por useSearchParams() en Next.js App Router

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
