'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

const safeSlug  = (s: string) => s.replace(/[^a-z0-9-]/g, '').slice(0, 40)
const safeEmail = (s: string) => s.slice(0, 254)

interface Props {
  studio:     string
  studioName: string
  logoUrl:    string | null
}

function Form({ studio, studioName, logoUrl }: Props) {
  const searchParams = useSearchParams()

  const rawCallback = searchParams.get('callbackUrl') ?? '/'
  const callbackUrl =
    rawCallback.startsWith('/') && !rawCallback.startsWith('//')
      ? rawCallback
      : '/'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    try {
      const saved = safeEmail(localStorage.getItem('flexa_email') ?? '')
      if (saved) setEmail(saved)
    } catch {}
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password,
      studioSlug: studio,
      redirect: false,
    })

    if (result?.error) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
    } else {
      try {
        localStorage.setItem('flexa_email', email.trim().toLowerCase())
        localStorage.setItem('flexa_last_studio', safeSlug(studio))
      } catch {}
      window.location.href = callbackUrl !== '/' ? callbackUrl : `/${studio}`
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
              Ingresá a tu estudio
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
