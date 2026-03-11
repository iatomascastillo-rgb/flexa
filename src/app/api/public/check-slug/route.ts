import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SLUG_BLACKLIST = [
  'www', 'api', 'app', 'admin', 'login', 'logout',
  'registro', 'onboarding', 'soporte', 'support', 'superadmin',
]

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.toLowerCase().trim() ?? ''

  if (!slug) {
    return NextResponse.json({ available: false, reason: 'empty' })
  }
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }
  if (SLUG_BLACKLIST.includes(slug)) {
    return NextResponse.json({ available: false, reason: 'reserved' })
  }

  const existing = await prisma.studio.findUnique({
    where: { slug },
    select: { id: true },
  })

  return NextResponse.json({ available: !existing })
}
