'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BrandingData {
  primaryColor: string
  accentColor: string
  logoUrl: string | null
  welcomeMessage: string
  fontDisplay: string
  fontBody: string
  backgroundColor: string
  coverUrl: string | null
  darkMode: boolean
  navColor: string
  instagramUrl: string
  whatsappUrl: string
  websiteUrl: string
}

interface Props {
  studio: string
  studioName: string
  initial: BrandingData
}

const FONTS_DISPLAY = [
  { value: 'cormorant', label: 'Cormorant', preview: 'serif' },
  { value: 'playfair', label: 'Playfair Display', preview: 'serif' },
  { value: 'lora', label: 'Lora', preview: 'serif' },
  { value: 'eb_garamond', label: 'EB Garamond', preview: 'serif' },
]

const FONTS_BODY = [
  { value: 'dm_sans', label: 'DM Sans', preview: 'sans-serif' },
  { value: 'inter', label: 'Inter', preview: 'sans-serif' },
  { value: 'nunito', label: 'Nunito', preview: 'sans-serif' },
  { value: 'lato', label: 'Lato', preview: 'sans-serif' },
]

const FONT_CSS_VAR: Record<string, string> = {
  cormorant: 'var(--font-cormorant, serif)',
  playfair: 'var(--font-playfair, serif)',
  lora: 'var(--font-lora, serif)',
  eb_garamond: 'var(--font-eb-garamond, serif)',
  dm_sans: 'var(--font-dm-sans, sans-serif)',
  inter: 'var(--font-inter, sans-serif)',
  nunito: 'var(--font-nunito, sans-serif)',
  lato: 'var(--font-lato, sans-serif)',
}

export function BrandingForm({ studio, studioName, initial }: Props) {
  const router = useRouter()
  const [primary, setPrimary] = useState(initial.primaryColor)
  const [accent, setAccent] = useState(initial.accentColor)
  const [welcome, setWelcome] = useState(initial.welcomeMessage)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial.logoUrl)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl)
  const [fontDisplay, setFontDisplay] = useState(initial.fontDisplay)
  const [fontBody, setFontBody] = useState(initial.fontBody)
  const [bgColor, setBgColor] = useState(initial.backgroundColor)
  const [coverUrl, setCoverUrl] = useState<string | null>(initial.coverUrl)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(initial.coverUrl)
  const [darkMode, setDarkMode] = useState(initial.darkMode)
  const [navColor, setNavColor] = useState(initial.navColor || initial.primaryColor)
  const [instagramUrl, setInstagramUrl] = useState(initial.instagramUrl)
  const [whatsappUrl, setWhatsappUrl] = useState(initial.whatsappUrl)
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('El logo no puede superar 2 MB')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setError(null)
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('La portada no puede superar 5 MB')
      return
    }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
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
      formData.append('fontDisplay', fontDisplay)
      formData.append('fontBody', fontBody)
      formData.append('backgroundColor', bgColor)
      formData.append('darkMode', String(darkMode))
      formData.append('navColor', navColor)
      formData.append('instagramUrl', instagramUrl)
      formData.append('whatsappUrl', whatsappUrl)
      formData.append('websiteUrl', websiteUrl)
      if (logoFile) formData.append('logo', logoFile)
      if (coverFile) formData.append('cover', coverFile)
      if (!coverPreview && !coverFile) formData.append('clearCover', 'true')

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
      if (updated.coverUrl) setCoverUrl(updated.coverUrl)
      setLogoFile(null)
      setCoverFile(null)
      setSaved(true)
      router.refresh()
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
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Preview
        </p>
        <div className="overflow-hidden rounded-2xl" style={{ background: bgColor, border: '1px solid #E8E0D6' }}>
          {/* Banner de portada */}
          {coverPreview && (
            <div className="h-24 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverPreview} alt="Portada" className="h-full w-full object-cover" />
            </div>
          )}
          {/* Header simulado */}
          <div className="flex items-center gap-3 px-5 py-4" style={{ background: primary }}>
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo" className="h-10 w-10 rounded-full object-cover" style={{ background: 'white' }} />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-base font-medium" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-light text-white" style={{ fontFamily: FONT_CSS_VAR[fontDisplay] }}>
                {studioName}
              </p>
              {welcome && <p className="text-xs text-white/75" style={{ fontFamily: FONT_CSS_VAR[fontBody] }}>{welcome}</p>}
            </div>
          </div>
          {/* Mini UI */}
          <div className="px-5 py-4">
            <p className="mb-2 text-sm" style={{ fontFamily: FONT_CSS_VAR[fontBody], color: darkMode ? '#F0EDE8' : '#2C2C2C' }}>
              Texto de ejemplo en tu fuente
            </p>
            <div className="mb-2 flex gap-2">
              <div className="h-7 rounded-full px-4 text-xs font-medium flex items-center text-white" style={{ background: primary }}>
                Reservar
              </div>
              <div className="h-7 rounded-full px-4 text-xs font-medium flex items-center text-white" style={{ background: accent }}>
                Alerta
              </div>
            </div>
            {/* Nav preview */}
            <div className="mt-3 flex rounded-xl overflow-hidden" style={{ background: navColor }}>
              {['Inicio', 'Clases', 'Perfil'].map((t) => (
                <div key={t} className="flex-1 py-2 text-center text-xs" style={{ color: primary }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="space-y-4">

        {/* ── Colores ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Colores</p>

        {/* Color primario */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color principal
          </label>
          <div className="flex items-center gap-4">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5" style={{ background: 'transparent' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{primary.toUpperCase()}</p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Botones, nav, créditos</p>
            </div>
          </div>
        </div>

        {/* Color de acento */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color de acento
          </label>
          <div className="flex items-center gap-4">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5" style={{ background: 'transparent' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{accent.toUpperCase()}</p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Alertas, avisos</p>
            </div>
          </div>
        </div>

        {/* Color de fondo */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color de fondo
          </label>
          <div className="flex items-center gap-4">
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5" style={{ background: 'transparent' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{bgColor.toUpperCase()}</p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Fondo general de pantallas</p>
            </div>
          </div>
        </div>

        {/* Color de nav */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Color del nav inferior
          </label>
          <div className="flex items-center gap-4">
            <input type="color" value={navColor} onChange={(e) => setNavColor(e.target.value)} className="h-12 w-12 cursor-pointer rounded-xl border-0 p-0.5" style={{ background: 'transparent' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{navColor.toUpperCase()}</p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Barra de navegación inferior</p>
            </div>
          </div>
        </div>

        {/* ── Tipografía ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Tipografía</p>

        {/* Fuente de títulos */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Fuente de títulos
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FONTS_DISPLAY.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFontDisplay(f.value)}
                className="rounded-xl px-3 py-2.5 text-left transition-all"
                style={{
                  border: `1.5px solid ${fontDisplay === f.value ? primary : '#E8E0D6'}`,
                  background: fontDisplay === f.value ? primary + '12' : 'white',
                }}
              >
                <p className="text-base" style={{ fontFamily: FONT_CSS_VAR[f.value], color: 'var(--ink)' }}>
                  {f.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>Aa Bb Cc</p>
              </button>
            ))}
          </div>
        </div>

        {/* Fuente de cuerpo */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label className="mb-3 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Fuente de texto
          </label>
          <div className="grid grid-cols-2 gap-2">
            {FONTS_BODY.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFontBody(f.value)}
                className="rounded-xl px-3 py-2.5 text-left transition-all"
                style={{
                  border: `1.5px solid ${fontBody === f.value ? primary : '#E8E0D6'}`,
                  background: fontBody === f.value ? primary + '12' : 'white',
                }}
              >
                <p className="text-base" style={{ fontFamily: FONT_CSS_VAR[f.value], color: 'var(--ink)' }}>
                  {f.label}
                </p>
                <p className="text-xs" style={{ fontFamily: FONT_CSS_VAR[f.value], color: 'var(--stone)' }}>
                  El estudio te espera
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Imágenes ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Imágenes</p>

        {/* Logo */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Logo</p>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo actual" className="h-14 w-14 rounded-full object-cover" style={{ border: '1px solid #E8E0D6' }} />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-medium" style={{ background: '#EDF4ED', color: 'var(--sage)' }}>
                {studioName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl px-4 py-2 text-xs font-medium transition-opacity hover:opacity-70" style={{ background: '#F0EDEB', color: 'var(--ink)' }}>
                {logoPreview ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {logoPreview && (
                <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); setLogoUrl(null); if (fileRef.current) fileRef.current.value = '' }} className="text-xs" style={{ color: 'var(--terracotta)' }}>
                  Quitar logo
                </button>
              )}
              <p className="text-xs" style={{ color: 'var(--stone)' }}>PNG o JPG, máx. 2 MB</p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoChange} />
        </div>

        {/* Foto de portada */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Foto de portada</p>
          {coverPreview ? (
            <div className="mb-3 overflow-hidden rounded-xl" style={{ aspectRatio: '16/5' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverPreview} alt="Portada" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="mb-3 flex items-center justify-center rounded-xl" style={{ aspectRatio: '16/5', background: '#F0EDEB', border: '1.5px dashed #E8E0D6' }}>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Banner del header del estudio</p>
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => coverRef.current?.click()} className="rounded-xl px-4 py-2 text-xs font-medium transition-opacity hover:opacity-70" style={{ background: '#F0EDEB', color: 'var(--ink)' }}>
              {coverPreview ? 'Cambiar portada' : 'Subir portada'}
            </button>
            {coverPreview && (
              <button type="button" onClick={() => { setCoverPreview(null); setCoverFile(null); setCoverUrl(null); if (coverRef.current) coverRef.current.value = '' }} className="text-xs" style={{ color: 'var(--terracotta)' }}>
                Quitar portada
              </button>
            )}
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--stone)' }}>PNG o JPG, máx. 5 MB · Recomendado 1200×375px</p>
          <input ref={coverRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleCoverChange} />
        </div>

        {/* ── Textos ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Textos</p>

        {/* Mensaje de bienvenida */}
        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <label htmlFor="welcome" className="mb-2 block text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
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
          <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>{welcome.length}/120 · Aparece debajo del logo</p>
        </div>

        {/* ── Redes sociales ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Redes sociales</p>

        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              Instagram
            </label>
            <input
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/tu.estudio"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/></svg>
              WhatsApp
            </label>
            <input
              type="text"
              value={whatsappUrl}
              onChange={(e) => setWhatsappUrl(e.target.value)}
              placeholder="https://wa.me/549XXXXXXXXXX"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Sitio web
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://tu-estudio.com"
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* ── Modo oscuro ── */}
        <p className="px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Tema</p>

        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Modo oscuro</p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>Fondo oscuro para toda la app del estudio</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              onClick={() => setDarkMode(!darkMode)}
              className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200"
              style={{ background: darkMode ? primary : '#E8E0D6' }}
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          {darkMode && (
            <p className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: '#F5E8DE', color: 'var(--terracotta)' }}>
              El modo oscuro cambia el fondo a #1C1A18. Asegurate de que tu color de nav y botones tengan buen contraste.
            </p>
          )}
        </div>

        {/* Error / éxito */}
        {error && (
          <p className="rounded-xl px-4 py-2.5 text-sm" style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}>
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-xl px-4 py-2.5 text-sm" style={{ background: '#EDF4ED', color: 'var(--sage)' }}>
            Cambios guardados. Se aplican en tiempo real.
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
