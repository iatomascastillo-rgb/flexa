import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminAPI } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const hexRegex = /^#[0-9A-Fa-f]{6}$/

const VALID_FONT_DISPLAY = ['cormorant', 'playfair', 'lora', 'eb_garamond']
const VALID_FONT_BODY = ['dm_sans', 'inter', 'nunito', 'lato']

function isValidUrl(val: string) {
  try {
    new URL(val)
    return true
  } catch {
    return false
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studio: string }> },
) {
  const { studio } = await params

  const guard = await requireStudioAdminAPI(studio)
  if (!guard.ok) return guard.response
  const { studioId } = guard

  const contentType = request.headers.get('content-type') ?? ''
  let primaryColor: string | null = null
  let accentColor: string | null = null
  let welcomeMessage: string | null = null
  let fontDisplay: string | null = null
  let fontBody: string | null = null
  let backgroundColor: string | null = null
  let darkMode: boolean | undefined
  let navColor: string | null = null
  let instagramUrl: string | null = null
  let whatsappUrl: string | null = null
  let websiteUrl: string | null = null
  let logoUrl: string | undefined
  let coverUrl: string | undefined
  let clearCover = false

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    primaryColor = (formData.get('primaryColor') as string) || null
    accentColor = (formData.get('accentColor') as string) || null
    welcomeMessage = (formData.get('welcomeMessage') as string) || null
    fontDisplay = (formData.get('fontDisplay') as string) || null
    fontBody = (formData.get('fontBody') as string) || null
    backgroundColor = (formData.get('backgroundColor') as string) || null
    navColor = (formData.get('navColor') as string) || null
    instagramUrl = (formData.get('instagramUrl') as string) || null
    whatsappUrl = (formData.get('whatsappUrl') as string) || null
    websiteUrl = (formData.get('websiteUrl') as string) || null
    clearCover = formData.get('clearCover') === 'true'

    if (formData.has('darkMode')) {
      darkMode = formData.get('darkMode') === 'true'
    }

    const logoFile = formData.get('logo') as File | null
    if (logoFile && logoFile.size > 0) {
      if (logoFile.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'El logo no puede superar 2 MB' }, { status: 422 })
      }
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'Upload no configurado' }, { status: 503 })
      }
      const { put } = await import('@vercel/blob')
      // Sanitizar nombre: solo caracteres seguros para evitar path traversal
      const safeLogoName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
      const blob = await put(`logos/${studioId}/${safeLogoName}`, logoFile, {
        access: 'public',
        addRandomSuffix: true,
      })
      logoUrl = blob.url
    }

    const coverFile = formData.get('cover') as File | null
    if (coverFile && coverFile.size > 0) {
      if (coverFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'La portada no puede superar 5 MB' }, { status: 422 })
      }
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json({ error: 'Upload no configurado' }, { status: 503 })
      }
      const { put } = await import('@vercel/blob')
      // Sanitizar nombre: solo caracteres seguros para evitar path traversal
      const safeCoverName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64)
      const blob = await put(`covers/${studioId}/${safeCoverName}`, coverFile, {
        access: 'public',
        addRandomSuffix: true,
      })
      coverUrl = blob.url
    }
  } else {
    const body = await request.json()
    primaryColor = body.primaryColor ?? null
    accentColor = body.accentColor ?? null
    welcomeMessage = body.welcomeMessage ?? null
    fontDisplay = body.fontDisplay ?? null
    fontBody = body.fontBody ?? null
    backgroundColor = body.backgroundColor ?? null
    navColor = body.navColor ?? null
    instagramUrl = body.instagramUrl ?? null
    whatsappUrl = body.whatsappUrl ?? null
    websiteUrl = body.websiteUrl ?? null
    if ('darkMode' in body) darkMode = Boolean(body.darkMode)
  }

  // Validaciones
  if (primaryColor && !hexRegex.test(primaryColor)) {
    return NextResponse.json({ error: 'primaryColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }
  if (accentColor && !hexRegex.test(accentColor)) {
    return NextResponse.json({ error: 'accentColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }
  if (backgroundColor && !hexRegex.test(backgroundColor)) {
    return NextResponse.json({ error: 'backgroundColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }
  if (navColor && !hexRegex.test(navColor)) {
    return NextResponse.json({ error: 'navColor debe ser un hex válido (#RRGGBB)' }, { status: 422 })
  }
  if (fontDisplay && !VALID_FONT_DISPLAY.includes(fontDisplay)) {
    return NextResponse.json({ error: 'fontDisplay inválido' }, { status: 422 })
  }
  if (fontBody && !VALID_FONT_BODY.includes(fontBody)) {
    return NextResponse.json({ error: 'fontBody inválido' }, { status: 422 })
  }
  if (instagramUrl && !isValidUrl(instagramUrl)) {
    return NextResponse.json({ error: 'instagramUrl debe ser una URL válida' }, { status: 422 })
  }
  if (websiteUrl && !isValidUrl(websiteUrl)) {
    return NextResponse.json({ error: 'websiteUrl debe ser una URL válida' }, { status: 422 })
  }

  const updated = await prisma.studioBranding.upsert({
    where: { studioId },
    update: {
      ...(primaryColor !== null && { primaryColor }),
      ...(accentColor !== null && { accentColor }),
      ...(welcomeMessage !== null && { welcomeMessage }),
      ...(fontDisplay !== null && { fontDisplay }),
      ...(fontBody !== null && { fontBody }),
      ...(backgroundColor !== null && { backgroundColor }),
      ...(navColor !== null && { navColor }),
      ...(instagramUrl !== null && { instagramUrl }),
      ...(whatsappUrl !== null && { whatsappUrl }),
      ...(websiteUrl !== null && { websiteUrl }),
      ...(darkMode !== undefined && { darkMode }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(clearCover && { coverUrl: null }),
    },
    create: {
      studioId,
      primaryColor,
      accentColor,
      welcomeMessage,
      fontDisplay,
      fontBody,
      backgroundColor,
      navColor,
      instagramUrl,
      whatsappUrl,
      websiteUrl,
      darkMode: darkMode ?? false,
      logoUrl,
      coverUrl,
    },
    select: {
      primaryColor: true,
      accentColor: true,
      logoUrl: true,
      welcomeMessage: true,
      fontDisplay: true,
      fontBody: true,
      backgroundColor: true,
      darkMode: true,
      navColor: true,
      coverUrl: true,
      instagramUrl: true,
      whatsappUrl: true,
      websiteUrl: true,
    },
  })

  return NextResponse.json(updated)
}
