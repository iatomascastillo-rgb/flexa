import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { initials } from '@/lib/formatters'

// ── Server actions ─────────────────────────────────────────────────────────────

async function createInstructorAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const phone = (formData.get('phone') as string)?.trim() || null
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('passwordConfirm') as string

  if (!name || !email || !password) redirect(`/${studio}/admin/instructores?error=campos`)
  if (password.length < 8 || password.length > 72) redirect(`/${studio}/admin/instructores?error=password-corta`)
  if (password !== passwordConfirm) redirect(`/${studio}/admin/instructores?error=password-mismatch`)

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  // Verificar email único en el estudio
  const existing = await prisma.user.findFirst({
    where: { email, studioId },
    select: { id: true },
  })
  if (existing) redirect(`/${studio}/admin/instructores?error=email-existe`)

  const passwordHash = await bcrypt.hash(password, 8)

  await prisma.user.create({
    data: {
      studioId,
      email,
      passwordHash,
      name,
      phone,
      role: 'INSTRUCTOR',
      active: true,
    },
  })

  revalidatePath(`/${studio}/admin/instructores`)
  redirect(`/${studio}/admin/instructores?created=1`)
}

async function toggleInstructorAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const userId = formData.get('userId') as string
  const currentActive = formData.get('currentActive') === 'true'

  if (!userId) return

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId, session } = guard

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId, studioId },
      data: { active: !currentActive },
    }),
    prisma.auditLog.create({
      data: {
        studioId,
        userId: session.user.id,
        action: currentActive ? 'INSTRUCTOR_DEACTIVATED' : 'INSTRUCTOR_ACTIVATED',
        entityType: 'User',
        entityId: userId,
      },
    }),
  ])

  revalidatePath(`/${studio}/admin/instructores`)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function AdminInstructoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ error?: string; created?: string }>
}) {
  const [{ studio }, sp] = await Promise.all([params, searchParams])

  const { studioId } = await requireStudioAdminPage(studio)

  const instructors = await prisma.user.findMany({
    where: { studioId, role: 'INSTRUCTOR' },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, phone: true, active: true },
  })

  const errorMsg: Record<string, string> = {
    'campos': 'Nombre, email y contraseña son obligatorios.',
    'password-corta': 'La contraseña debe tener entre 8 y 72 caracteres.',
    'password-mismatch': 'Las contraseñas no coinciden.',
    'email-existe': 'Ya existe un usuario con ese email en el estudio.',
  }
  const currentError = sp.error ? (errorMsg[sp.error] ?? 'Ocurrió un error.') : null
  const created = sp.created === '1'

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/admin`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--ink)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div>
          <h1
            className="text-3xl font-light leading-none"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Instructores
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            {instructors.length} instructor{instructors.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Feedback */}
      {created && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}>
          Instructor creado correctamente.
        </div>
      )}
      {currentError && (
        <div className="mb-4 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEF3EE', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}>
          {currentError}
        </div>
      )}

      {/* Lista */}
      {instructors.length === 0 ? (
        <div
          className="mb-5 rounded-2xl p-8 text-center"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm" style={{ color: 'var(--stone)' }}>
            Todavía no hay instructores. Agregá el primero abajo.
          </p>
        </div>
      ) : (
        <div className="mb-5 space-y-2">
          {instructors.map((inst) => (
            <div
              key={inst.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{
                background: 'white',
                border: '1px solid #E8E0D6',
                opacity: inst.active ? 1 : 0.55,
              }}
            >
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: '#EDF4ED', color: 'var(--sage)' }}
              >
                {initials(inst.name)}
              </div>

              {/* Datos */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {inst.name}
                  {!inst.active && (
                    <span
                      className="ml-2 rounded-full px-1.5 py-0.5 text-xs font-normal"
                      style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                    >
                      Inactivo
                    </span>
                  )}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--stone)' }}>
                  {inst.email}
                  {inst.phone ? ` · ${inst.phone}` : ''}
                </p>
              </div>

              {/* Toggle */}
              <form action={toggleInstructorAction}>
                <input type="hidden" name="studio" value={studio} />
                <input type="hidden" name="userId" value={inst.id} />
                <input type="hidden" name="currentActive" value={String(inst.active)} />
                <button
                  type="submit"
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                  style={
                    inst.active
                      ? { background: 'var(--terracotta-light)', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }
                      : { background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }
                  }
                >
                  {inst.active ? 'Desactivar' : 'Activar'}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Formulario: Agregar instructor */}
      <div
        className="rounded-2xl px-5 py-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          Agregar instructor
        </p>
        <form action={createInstructorAction} className="space-y-3">
          <input type="hidden" name="studio" value={studio} />

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre completo *
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Ana García"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Email *
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="ana@estudio.com"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Teléfono (opcional)
            </label>
            <input
              type="tel"
              name="phone"
              placeholder="+54 9 11 1234-5678"
              className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Contraseña * (mín. 6)
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                placeholder="••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Confirmar *
              </label>
              <input
                type="password"
                name="passwordConfirm"
                required
                minLength={6}
                placeholder="••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: 'var(--sage)' }}
          >
            Crear instructor
          </button>
        </form>
      </div>
    </div>
  )
}
