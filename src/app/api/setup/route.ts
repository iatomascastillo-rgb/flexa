import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const setupKey = process.env.SETUP_SECRET
  if (!setupKey) {
    return NextResponse.json({ error: 'Setup no habilitado' }, { status: 403 })
  }

  let body: { key?: unknown; email?: unknown; password?: unknown; name?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (body.key !== setupKey) {
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 403 })
  }

  const { email, password, name } = body

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 })
  }

  // Solo funciona si no existe ningún SUPER_ADMIN
  const existing = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un super admin' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email: email.trim().toLowerCase(),
      password: hashed,
      name: typeof name === 'string' ? name.trim() : 'Super Admin',
      role: 'SUPER_ADMIN',
    },
    select: { id: true, email: true, name: true, role: true },
  })

  return NextResponse.json({ ok: true, user }, { status: 201 })
}
