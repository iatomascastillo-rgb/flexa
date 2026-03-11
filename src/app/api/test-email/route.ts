import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

// Solo disponible en desarrollo
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  const to = req.nextUrl.searchParams.get('to') ?? 'iatomascastillo@gmail.com'

  const result = await sendEmail(to, 'test', {})

  return NextResponse.json(result)
}
