import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) {
    return NextResponse.json({ error: 'Estudio no encontrado' }, { status: 404 })
  }

  const studioId = tenant.studioId

  // Soporta tanto JSON como FormData (para upload de logo)
  const contentType = request.headers.get('content-type') ?? ''
  let primaryColor: string | null = null
  let accentColor: string | null = null
  let welcomeMessage: string | null = null
  let logoUrl: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    primaryColor = (formData.get('primaryColor') as string) || null
    accentColor = (formData.get('accentColor') as string) || null
    welcomeMessage = (formData.get('welcomeMessage') as string) || null

    const logoFile = formData.get('logo') as File | null
    if (logoFile && logoFile.size > 0) {
      if (logoFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'El logo no puede superar 2 MB' }, { status: 422 })
      }
      const blob = await put(`logos/${studioId}/${logoFile.name}`, logoFile, {
        access: 'public',
        addRandomSuffix: true,
      })
      logoUrl = blob.url
    }
  } else {
    const body = await request.json()
    primaryColor = body.primaryColor ?? null
    accentColor = body.accentColor ?? null
    welcomeMessage = body.welcomeMessage ?? null
  }

  // Validar colores hex si se enviaron
  const hexRegex = /^#[0-9A-Fa-f]{6}$/
  if (primaryColor && !hexRegex.test(primaryColor)) {
    return NextResponse.json({ error: 'primaryColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }
  if (accentColor && !hexRegex.test(accentColor)) {
    return NextResponse.json({ error: 'accentColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }

  const updated = await prisma.studioBranding.upsert({
    where: { studioId },
    update: {
      ...(primaryColor !== null && { primaryColor }),
      ...(accentColor !== null && { accentColor }),
      ...(welcomeMessage !== null && { welcomeMessage }),
      ...(logoUrl !== undefined && { logoUrl }),
    },
    create: {
      studioId,
      primaryColor,
      accentColor,
      welcomeMessage,
      logoUrl,
    },
    select: {
      primaryColor: true,
      accentColor: true,
      logoUrl: true,
      welcomeMessage: true,
    },
  })

  return NextResponse.json(updated)
}
