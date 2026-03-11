'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BrandingData {
  primaryColor: string
  accentColor: string
  logoUrl: string | null
  welcomeMessage: string
}

interface Props {
  studio: string
  studioName: string
  initial: BrandingData
}

export function BrandingForm({ studio, studioName, initial }: Props) {
  const router = useRouter()
  const [primary, setPrimary] = useState(initial.primaryColor)
  const [accent, setAccent] = useState(initial.accentColor)
  const [welcome, setWelcome] = useState(initial.welcomeMessage)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('El logo no puede superar 2 MB')
      return
    }
    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
    setError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const formData = new FormData()
      formData.append('primaryColor', primary)
      formData.append('accentColor', accent)
      formData.append('welcomeMessage', welcome)
      if (logoFile) formData.append('logo', logoFile)

      const res = await fetch(`/api/${studio}/admin/branding`, {
        method: 'PATCH',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        return
      }

      const updated = await res.json()
      if (updated.logoUrl) setLogoUrl(updated.logoUrl)
      setLogoFile(null)
      setSaved(true)
      router.refresh() // actualiza el layout con los nuevos colores
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/perfil`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', color: 'var(--ink)' }}
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
            Apariencia
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            Personalización del estudio
          </p>
        </div>
      </div>

      {/* ── Preview en tiempo real ── */}
      <section className="mb-5">
        <p
          className="mb-2 px-1 text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--stone)' }}
        >
          Preview
        </p>
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          {/* Header simulado del estudio */}
          <div
            className="flex items-center gap-3 px-5 py-4"
            style={{ background: primary }}
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo"
                className="h-10 w-10 rounded-full object-cover"
                style={{ background: 'white' }}
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-base font-medium"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p
                className="text-lg font-light text-white"
                style={{ fontFamily: 'var(--font-cormorant, serif)' }}
              >
                {studioName}
              </p>
              {welcome && (
                <p className="text-xs text-white/75">{welcome}</p>
              )}
            </div>
          </div>

          {/* Mini UI con colores */}
          <div className="px-5 py-4">
            <div className="mb-2 flex gap-2">
              <div
                className="h-7 rounded-full px-4 text-xs font-medium flex items-center text-white"
                style={{ background: primary }}
              >
                Reservar
              </div>
              <div
                className="h-7 rounded-full px-4 text-xs font-medium flex items-center text-white"
                style={{ background: accent }}
              >
                Alerta
              </div>
            </div>
            <div
              className="h-2 rounded-full"
              style={{ background: '#E8E0D6' }}
            >
              <div
                className="h-full w-2/3 rounded-full"
                style={{ background: primary }}
              />
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Color primario */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color principal
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5"
              style={{ background: 'transparent' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {primary.toUpperCase()}
              </p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                Botones, nav, créditos
              </p>
            </div>
          </div>
        </div>

        {/* Color de acento */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color de acento
          </label>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5"
              style={{ background: 'transparent' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                {accent.toUpperCase()}
              </p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                Alertas, terracotta
              </p>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Logo
          </p>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo actual"
                className="h-14 w-14 rounded-full object-cover"
                style={{ border: '1px solid #E8E0D6' }}
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium"
                style={{ background: '#EDF4ED', color: 'var(--sage)' }}
              >
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-xl px-4 py-2 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ background: '#F0EDEB', color: 'var(--ink)' }}
              >
                {logoPreview ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null)
                    setLogoFile(null)
                    setLogoUrl(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                  className="text-xs"
                  style={{ color: 'var(--terracotta)' }}
                >
                  Quitar logo
                </button>
              )}
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                PNG o JPG, máx. 2 MB
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        {/* Mensaje de bienvenida */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <label
            htmlFor="welcome"
            className="mb-2 block text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--stone)' }}
          >
            Mensaje de bienvenida
          </label>
          <input
            id="welcome"
            type="text"
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            maxLength={120}
            placeholder="¡Bienvenida a tu estudio!"
            className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
            style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
          />
          <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
            {welcome.length}/120 · Aparece debajo del logo en el header
          </p>
        </div>

        {/* Error / éxito */}
        {error && (
          <p
            className="rounded-xl px-4 py-2.5 text-sm"
            style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
          >
            {error}
          </p>
        )}
        {saved && (
          <p
            className="rounded-xl px-4 py-2.5 text-sm"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            Cambios guardados. Los colores se aplican en tiempo real.
          </p>
        )}

        {/* Guardar */}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-2xl py-3.5 text-sm font-medium transition-opacity disabled:opacity-60 hover:opacity-85"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
