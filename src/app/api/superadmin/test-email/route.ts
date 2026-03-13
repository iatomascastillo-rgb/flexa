export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

// Solo disponible para SUPER_ADMIN — testea que Resend funciona en producción
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const to = req.nextUrl.searchParams.get('to') ?? session.user.email ?? ''
  if (!to) return NextResponse.json({ error: 'Falta parámetro ?to=' }, { status: 400 })

  const result = await sendEmail(to, 'test', {})

  return NextResponse.json({
    ...result,
    sentTo: to,
    from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
    env: {
      HAS_RESEND_KEY: !!process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    },
  })
}
