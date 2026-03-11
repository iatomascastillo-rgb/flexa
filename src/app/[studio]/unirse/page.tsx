'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

interface FormData {
  name: string
  email: string
  password: string
  phone: string
}

const inputStyle: React.CSSProperties = { borderColor: '#E8E0D6', color: 'var(--ink)' }

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
    hasError ? 'border-[var(--terracotta)]' : 'focus:border-[var(--sage)]'
  }`
}

export default function UnirsePage() {
  const router = useRouter()
  const params = useParams<{ studio: string }>()
  const studio = params.studio

  const [form, setForm] = useState<FormData>({ name: '', email: '', password: '', phone: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Tu nombre es requerido'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setGlobalError(null)

    try {
      const res = await fetch(`/api/public/studios/${studio}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.field) {
          setErrors({ [data.field]: data.error })
        } else {
          setGlobalError(data.error ?? 'Error al registrarse')
        }
        return
      }

      // Auto-login
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        studioSlug: studio,
        redirect: false,
      })

      if (result?.ok) {
        router.push(`/${studio}`)
      } else {
        router.push(`/login?callbackUrl=/${studio}`)
      }
    } catch {
      setGlobalError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: 'var(--cream)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo / estudio */}
        <div className="mb-8 text-center">
          <h1
            className="text-4xl font-light"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Unirse al estudio
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--stone)' }}>
            Creá tu cuenta para reservar clases
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Tu nombre
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ana García"
                autoComplete="name"
                className={inputClass(!!errors.name)}
                style={inputStyle}
              />
              {errors.name && (
                <p className="mt-1 text-xs" style={{ color: 'var(--terracotta)' }}>{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="ana@ejemplo.com"
                autoComplete="email"
                className={inputClass(!!errors.email)}
                style={inputStyle}
              />
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: 'var(--terracotta)' }}>{errors.email}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className={inputClass(!!errors.password)}
                style={inputStyle}
              />
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: 'var(--terracotta)' }}>{errors.password}</p>
              )}
            </div>

            {/* Teléfono */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Teléfono <span className="opacity-60">(opcional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+54 11 1234-5678"
                autoComplete="tel"
                className={inputClass(false)}
                style={inputStyle}
              />
            </div>

            {globalError && (
              <p
                className="rounded-xl px-3 py-2 text-xs"
                style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
              >
                {globalError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-85"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>

            <p className="text-center text-xs" style={{ color: 'var(--stone)' }}>
              ¿Ya tenés cuenta?{' '}
              <Link href="/login" className="font-medium" style={{ color: 'var(--sage)' }}>
                Iniciá sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
