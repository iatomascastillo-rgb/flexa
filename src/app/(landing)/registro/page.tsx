'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2

interface FormData {
  name: string
  email: string
  password: string
  phone: string
  studioName: string
  slug: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    phone: '',
    studioName: '',
    slug: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ── Auto-generar slug desde studioName ────────────────────────────────────
  useEffect(() => {
    if (form.studioName) {
      const generated = slugify(form.studioName)
      if (generated.length >= 3) {
        setForm((f) => ({ ...f, slug: generated }))
      }
    }
  }, [form.studioName])

  // ── Validar slug en tiempo real ────────────────────────────────────────────
  const checkSlug = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugStatus('invalid')
      return
    }
    setSlugStatus('checking')
    try {
      const res = await fetch(`/api/public/check-slug?slug=${encodeURIComponent(slug)}`)
      const data = await res.json()
      setSlugStatus(data.available ? 'available' : data.reason === 'invalid' ? 'invalid' : 'taken')
    } catch {
      setSlugStatus('idle')
    }
  }, [])

  useEffect(() => {
    if (!form.slug) return
    const timeout = setTimeout(() => checkSlug(form.slug), 400)
    return () => clearTimeout(timeout)
  }, [form.slug, checkSlug])

  // ── Validación paso 1 ──────────────────────────────────────────────────────
  function validateStep1(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.name.trim()) errs.name = 'Tu nombre es requerido'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email inválido'
    if (form.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    if (!form.phone.trim()) errs.phone = 'El teléfono es requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Validación paso 2 ──────────────────────────────────────────────────────
  function validateStep2(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.studioName.trim()) errs.studioName = 'El nombre del estudio es requerido'
    if (!form.slug || form.slug.length < 3) errs.slug = 'El slug debe tener al menos 3 caracteres'
    if (slugStatus === 'taken') errs.slug = 'Este slug ya está en uso'
    if (slugStatus === 'invalid') errs.slug = 'Slug inválido: solo minúsculas, números y guiones'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Cambio de campo ────────────────────────────────────────────────────────
  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  // ── Submit final ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep2()) return
    if (slugStatus === 'checking') return
    setSubmitting(true)
    setGlobalError(null)

    try {
      const res = await fetch('/api/public/studios/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          studioName: form.studioName,
          slug: form.slug,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.field) {
          setErrors({ [data.field]: data.error })
          if (['name', 'email', 'password', 'phone'].includes(data.field)) setStep(1)
        } else {
          setGlobalError(data.error ?? 'Error al registrar')
        }
        return
      }

      // Auto-login tras registro exitoso
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        studioSlug: form.slug,
        redirect: false,
      })

      if (result?.ok) {
        router.push(`/${form.slug}/onboarding`)
      } else {
        // Si el auto-login falla, ir al login manual
        router.push(`/login?callbackUrl=/${form.slug}`)
      }
    } catch {
      setGlobalError('Error de conexión. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const slugIndicator = {
    idle: null,
    checking: <span style={{ color: 'var(--stone)' }}>Verificando...</span>,
    available: <span style={{ color: 'var(--sage)' }}>✓ Disponible</span>,
    taken: <span style={{ color: 'var(--terracotta)' }}>✕ En uso</span>,
    invalid: <span style={{ color: 'var(--terracotta)' }}>✕ Formato inválido</span>,
  }[slugStatus]

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: 'var(--cream)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/">
            <h1
              className="text-4xl font-light"
              style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
            >
              Flexa
            </h1>
          </Link>
          <p className="mt-1 text-sm" style={{ color: 'var(--stone)' }}>
            Creá tu estudio gratis
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-6 flex gap-1.5">
          {([1, 2] as Step[]).map((s) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full transition-all"
              style={{ background: s <= step ? 'var(--sage)' : '#E8E0D6' }}
            />
          ))}
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        >
          {/* ── Paso 1: Datos personales ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                  Paso 1 de 2 · Tu cuenta
                </p>
              </div>

              <Field label="Tu nombre" error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ana García"
                  autoComplete="name"
                  className={inputClass(!!errors.name)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="ana@mipilates.com"
                  autoComplete="email"
                  className={inputClass(!!errors.email)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Contraseña" error={errors.password}>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className={inputClass(!!errors.password)}
                  style={inputStyle}
                />
              </Field>

              <Field label="Teléfono" error={errors.phone}>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="+54 11 1234-5678"
                  autoComplete="tel"
                  className={inputClass(!!errors.phone)}
                  style={inputStyle}
                />
              </Field>

              <button
                type="button"
                onClick={() => { if (validateStep1()) setStep(2) }}
                className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                Siguiente →
              </button>

              <p className="text-center text-xs" style={{ color: 'var(--stone)' }}>
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="font-medium" style={{ color: 'var(--sage)' }}>
                  Iniciá sesión
                </Link>
              </p>
            </div>
          )}

          {/* ── Paso 2: Datos del estudio ── */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                  Paso 2 de 2 · Tu estudio
                </p>
              </div>

              <Field label="Nombre del estudio" error={errors.studioName}>
                <input
                  type="text"
                  value={form.studioName}
                  onChange={(e) => set('studioName', e.target.value)}
                  placeholder="Centro Pilates Buenos Aires"
                  autoFocus
                  className={inputClass(!!errors.studioName)}
                  style={inputStyle}
                />
              </Field>

              <Field
                label="Dirección web (slug)"
                error={errors.slug}
                hint={
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: 'var(--stone)' }}>
                      flexa.app/<strong>{form.slug || 'mi-estudio'}</strong>
                    </span>
                    <span className="text-xs">{slugIndicator}</span>
                  </div>
                }
              >
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40))}
                  placeholder="centro-pilates-ba"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={inputClass(!!errors.slug || slugStatus === 'taken' || slugStatus === 'invalid')}
                  style={inputStyle}
                />
              </Field>

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
                disabled={submitting || slugStatus === 'checking' || slugStatus === 'taken' || slugStatus === 'invalid'}
                className="w-full rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-85"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                {submitting ? 'Creando tu estudio...' : 'Crear estudio gratis'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-center text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--stone)' }}
              >
                ← Volver
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--stone)' }}>
          14 días de prueba gratis · Sin tarjeta de crédito
        </p>
      </div>
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = { borderColor: '#E8E0D6', color: 'var(--ink)' }

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors ${
    hasError ? 'border-[var(--terracotta)]' : 'focus:border-[var(--sage)]'
  }`
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
        {label}
      </label>
      {children}
      {hint}
      {error && (
        <p className="mt-1 text-xs" style={{ color: 'var(--terracotta)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
