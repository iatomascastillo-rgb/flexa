import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// ── PATCH — Cambia estado del post (publish / unpublish / archive) ─────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studio: string; newsId: string }> },
) {
  const { studio, newsId } = await params
  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  const body = await request.json() as { action?: string }
  const action = body.action

  if (!action || !['publish', 'unpublish', 'archive'].includes(action)) {
    return NextResponse.json({ error: 'action debe ser publish, unpublish o archive' }, { status: 422 })
  }

  // Verificar que el post pertenece al estudio (seguridad tenant)
  const existing = await prisma.studioNews.findFirst({
    where: { id: newsId, studioId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 })
  }

  const updated = await prisma.studioNews.update({
    where: { id: newsId },
    data: {
      ...(action === 'publish' && { publishedAt: new Date(), archivedAt: null }),
      ...(action === 'unpublish' && { publishedAt: null }),
      ...(action === 'archive' && { archivedAt: new Date() }),
    },
    select: { id: true, publishedAt: true, archivedAt: true },
  })

  return NextResponse.json(updated)
}
