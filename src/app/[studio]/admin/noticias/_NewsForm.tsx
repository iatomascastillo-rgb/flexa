'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  studio: string
  onCancel: () => void
}

export default function NewsForm({ studio, onCancel }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [publishNow, setPublishNow] = useState(true)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen no puede superar 3 MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten imágenes JPG, PNG o WebP')
      return
    }
    setError(null)
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('El título es requerido'); return }
    if (!content.trim()) { setError('El contenido es requerido'); return }

    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('content', content.trim())
      fd.append('publish', String(publishNow))
      if (imageFile) fd.append('image', imageFile)

      const res = await fetch(`/api/${studio}/admin/noticias`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }

      router.refresh()
      onCancel()
    } catch {
      setError('Error inesperado. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 mb-6" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
      <p className="text-sm font-medium mb-4" style={{ color: 'var(--ink)' }}>Nueva noticia</p>

      {/* Título */}
      <div className="mb-3">
        <label className="block text-xs mb-1" style={{ color: 'var(--stone)' }}>
          Título <span style={{ color: 'var(--terracotta)' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Ej: Nuevo horario los miércoles"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ border: '1px solid #E8E0D6', color: 'var(--ink)', background: '#FAFAF8' }}
        />
        <p className="text-right text-xs mt-0.5" style={{ color: '#C0B8AE' }}>{title.length}/120</p>
      </div>

      {/* Contenido */}
      <div className="mb-3">
        <label className="block text-xs mb-1" style={{ color: 'var(--stone)' }}>
          Contenido <span style={{ color: 'var(--terracotta)' }}>*</span>
        </label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Escribí el mensaje para tus alumnas..."
          className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
          style={{ border: '1px solid #E8E0D6', color: 'var(--ink)', background: '#FAFAF8' }}
        />
        <p className="text-right text-xs mt-0.5" style={{ color: '#C0B8AE' }}>{content.length}/1000</p>
      </div>

      {/* Imagen */}
      <div className="mb-4">
        <label className="block text-xs mb-1" style={{ color: 'var(--stone)' }}>Imagen (opcional)</label>
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden mb-2" style={{ maxHeight: 160 }}>
            <img src={imagePreview} alt="Preview" className="w-full object-cover" style={{ maxHeight: 160 }} />
            <button
              type="button"
              onClick={() => { setImagePreview(null); setImageFile(null); if (fileRef.current) fileRef.current.value = '' }}
              className="absolute top-2 right-2 rounded-full w-6 h-6 flex items-center justify-center text-xs"
              style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl px-3 py-3 text-xs text-center"
            style={{ border: '1px dashed #C0B8AE', color: 'var(--stone)', background: '#FAFAF8' }}
          >
            Agregar imagen (JPG, PNG, WebP · max 3 MB)
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
          className="hidden"
        />
      </div>

      {/* Publicar ahora */}
      <label className="flex items-center gap-2 mb-4 cursor-pointer">
        <input
          type="checkbox"
          checked={publishNow}
          onChange={e => setPublishNow(e.target.checked)}
          className="rounded"
        />
        <span className="text-sm" style={{ color: 'var(--ink)' }}>Publicar ahora</span>
        {!publishNow && <span className="text-xs" style={{ color: 'var(--stone)' }}>(se guardará como borrador)</span>}
      </label>

      {error && (
        <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity"
          style={{ background: 'var(--sage)', color: 'white', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Guardando...' : publishNow ? 'Publicar' : 'Guardar borrador'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl px-4 py-2.5 text-sm"
          style={{ background: '#F3F4F6', color: 'var(--stone)' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
