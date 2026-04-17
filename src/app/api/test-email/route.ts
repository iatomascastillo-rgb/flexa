export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

// Solo disponible en desarrollo
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const to = req.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'Falta parámetro ?to=' }, { status: 400 })

  const result = await sendEmail(to, 'test', {})

  return NextResponse.json(result)
}
