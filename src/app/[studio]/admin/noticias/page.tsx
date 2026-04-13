'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import NewsForm from './_NewsForm'

interface NewsPost {
  id: string
  title: string
  content: string
  imageUrl: string | null
  publishedAt: string | null
  createdAt: string
  author: { name: string | null }
}

export default function NoticiasAdminPage() {
  const params = useParams<{ studio: string }>()
  const studio = params.studio
  const router = useRouter()

  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${studio}/admin/noticias`)
      if (res.ok) setPosts(await res.json())
    } finally {
      setLoading(false)
    }
  }, [studio])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function handleAction(id: string, action: 'publish' | 'unpublish' | 'archive') {
    setActionLoading(id + action)
    setError(null)
    try {
      const res = await fetch(`/api/${studio}/admin/noticias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al actualizar')
        return
      }
      await fetchPosts()
    } catch {
      setError('Error inesperado')
    } finally {
      setActionLoading(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div className="min-h-screen px-4 pb-24 pt-6" style={{ background: 'var(--cream, #F7F3EE)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/${studio}/admin`}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-70"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--stone)' }}>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
            Noticias
          </h1>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nueva noticia
          </button>
        )}
      </div>

      {/* Formulario de creación */}
      {showForm && (
        <NewsForm
          studio={studio}
          onCancel={() => { setShowForm(false); fetchPosts() }}
        />
      )}

      {error && (
        <p className="text-xs mb-4 px-3 py-2 rounded-xl" style={{ background: '#FEE2E2', color: '#DC2626' }}>{error}</p>
      )}

      {/* Lista de posts */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--stone)' }}>Cargando...</p>
        </div>
      ) : posts.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>Sin noticias todavía</p>
          <p className="text-xs" style={{ color: 'var(--stone)' }}>
            Publicá una noticia para que tus alumnas la vean en su inicio.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const isPublished = post.publishedAt !== null
            return (
              <div
                key={post.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                {post.imageUrl && (
                  <img src={post.imageUrl} alt={post.title} className="w-full object-cover" style={{ maxHeight: 140 }} />
                )}
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{post.title}</p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: isPublished ? '#EDF4ED' : '#F3F4F6',
                        color: isPublished ? 'var(--sage)' : 'var(--stone)',
                      }}
                    >
                      {isPublished ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--stone)' }}>
                    {post.content}
                  </p>
                  <p className="text-xs mb-3" style={{ color: '#C0B8AE' }}>
                    {isPublished
                      ? `Publicado el ${formatDate(post.publishedAt!)}`
                      : `Creado el ${formatDate(post.createdAt)}`}
                    {post.author.name ? ` · ${post.author.name}` : ''}
                  </p>
                  {/* Acciones */}
                  <div className="flex gap-2">
                    {isPublished ? (
                      <button
                        onClick={() => handleAction(post.id, 'unpublish')}
                        disabled={actionLoading !== null}
                        className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                        style={{ background: '#FEF3C7', color: '#92400E' }}
                      >
                        Despublicar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(post.id, 'publish')}
                        disabled={actionLoading !== null}
                        className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                        style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                      >
                        Publicar
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(post.id, 'archive')}
                      disabled={actionLoading !== null}
                      className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                      style={{ background: '#F3F4F6', color: 'var(--stone)' }}
                    >
                      Archivar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
