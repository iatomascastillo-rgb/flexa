import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 3 * 1024 * 1024 // 3 MB

// ── GET — Lista posts del estudio (sin archivados) ────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params
  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  const news = await prisma.studioNews.findMany({
    where: { studioId, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrl: true,
      publishedAt: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  })

  return NextResponse.json(news)
}

// ── POST — Crea un post ────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params
  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId, session } = guard

  const formData = await request.formData()

  const title = (formData.get('title') as string | null)?.trim()
  const content = (formData.get('content') as string | null)?.trim()
  const publishNow = formData.get('publish') === 'true'

  if (!title || title.length === 0) {
    return NextResponse.json({ error: 'El título es requerido' }, { status: 422 })
  }
  if (title.length > 120) {
    return NextResponse.json({ error: 'El título no puede superar 120 caracteres' }, { status: 422 })
  }
  if (!content || content.length === 0) {
    return NextResponse.json({ error: 'El contenido es requerido' }, { status: 422 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'El contenido no puede superar 1000 caracteres' }, { status: 422 })
  }

  let imageUrl: string | undefined

  const imageFile = formData.get('image') as File | null
  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: 'La imagen no puede superar 3 MB' }, { status: 422 })
    }
    if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
      return NextResponse.json({ error: 'Solo se permiten imágenes JPG, PNG o WebP' }, { status: 422 })
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'Upload de imágenes no configurado' }, { status: 503 })
    }
    try {
      const { put } = await import('@vercel/blob')
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
      const blob = await put(`news/${studioId}/${safeName}`, imageFile, {
        access: 'public',
        addRandomSuffix: true,
      })
      imageUrl = blob.url
    } catch {
      return NextResponse.json({ error: 'Error al subir la imagen. Intentá de nuevo.' }, { status: 500 })
    }
  }

  const news = await prisma.studioNews.create({
    data: {
      studioId,
      title,
      content,
      imageUrl,
      publishedAt: publishNow ? new Date() : null,
      createdBy: session.user.id,
    },
    select: { id: true, title: true, publishedAt: true },
  })

  return NextResponse.json(news, { status: 201 })
}
