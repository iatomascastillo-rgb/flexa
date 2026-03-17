import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { auth, signOut } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// logoutAction se define dentro del Page para capturar el studio slug

// ── Shared components ─────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#C4B8AC' }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function NavCard({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
      style={{ background: 'white', border: '1px solid #E8E0D6' }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--sage)' }}>{icon}</span>
        <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{label}</span>
      </div>
      <ChevronRight />
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const [{ studio }, sp] = await Promise.all([params, searchParams])

  async function logoutAction() {
    'use server'
    await signOut({ redirectTo: `/login?callbackUrl=/${studio}/perfil` })
  }

  async function updateProfileAction(formData: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user?.id) return
    const name = (formData.get('name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim() || null
    if (!name) redirect(`/${studio}/perfil?error=nombre`)
    const tenant = await getTenantBySlug(studio)
    if (!tenant || s.user.studioId !== tenant.studioId) return
    await prisma.user.update({
      where: { id: s.user.id, studioId: tenant.studioId },
      data: { name, phone },
    })
    revalidatePath(`/${studio}/perfil`)
    redirect(`/${studio}/perfil?saved=perfil`)
  }

  async function changePasswordAction(formData: FormData) {
    'use server'
    const s = await auth()
    if (!s?.user?.id) return
    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      redirect(`/${studio}/perfil?error=password-corta`)
    }
    if (newPassword !== confirmPassword) {
      redirect(`/${studio}/perfil?error=password-mismatch`)
    }
    const tenant = await getTenantBySlug(studio)
    if (!tenant || s.user.studioId !== tenant.studioId) return
    const user = await prisma.user.findUnique({
      where: { id: s.user.id, studioId: tenant.studioId },
      select: { passwordHash: true },
    })
    if (!user?.passwordHash) redirect(`/${studio}/perfil?error=password-actual`)
    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) redirect(`/${studio}/perfil?error=password-actual`)
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: s.user.id, studioId: tenant.studioId },
      data: { passwordHash },
    })
    revalidatePath(`/${studio}/perfil`)
    redirect(`/${studio}/perfil?saved=password`)
  }

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/${studio}/perfil`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  if (session.user.studioId !== tenant.studioId) redirect(`/login?callbackUrl=/${studio}/perfil`)

  // Leer datos frescos de DB (la sesión puede estar desactualizada)
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id, studioId: tenant.studioId },
    select: { name: true, email: true, phone: true, role: true },
  })

  const user = dbUser ?? session.user
  const isSuperAdmin = user.role === 'SUPER_ADMIN'
  const isStudioAdmin = user.role === 'STUDIO_ADMIN'
  const isInstructor = user.role === 'INSTRUCTOR'
  const initial = user.name?.charAt(0).toUpperCase() ?? '?'

  const roleLabel: Record<string, string> = {
    STUDENT: 'Alumna',
    STUDIO_ADMIN: 'Administradora',
    SUPER_ADMIN: 'Super Admin',
    INSTRUCTOR: 'Instructora',
  }

  const savedPerfil = sp.saved === 'perfil'
  const savedPassword = sp.saved === 'password'
  const errorMsg: Record<string, string> = {
    'nombre': 'El nombre no puede estar vacío.',
    'password-corta': 'La nueva contraseña debe tener al menos 8 caracteres.',
    'password-mismatch': 'Las contraseñas no coinciden.',
    'password-actual': 'La contraseña actual es incorrecta.',
  }
  const currentError = sp.error ? (errorMsg[sp.error] ?? 'Ocurrió un error.') : null

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      <h1
        className="mb-6 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Perfil
      </h1>

      {/* Avatar + datos */}
      <div className="mb-4 flex items-center gap-4 rounded-2xl p-5" style={{ background: 'white' }}>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-medium"
          style={{ background: '#EDF4ED', color: 'var(--sage)' }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-medium" style={{ color: 'var(--ink)' }}>{user.name}</p>
          <p className="truncate text-sm" style={{ color: 'var(--stone)' }}>{user.email}</p>
          <span
            className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          >
            {roleLabel[user.role ?? 'STUDENT'] ?? user.role}
          </span>
        </div>
      </div>

      {/* ── INSTRUCTOR: panel de clases ── */}
      {isInstructor && (
        <div className="mb-4 space-y-2">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Gestión
          </p>
          <NavCard
            href={`/${studio}/instructor`}
            label="Gestión de clases"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
              </svg>
            }
          />
        </div>
      )}

      {/* ── SUPER_ADMIN: acceso directo al panel ── */}
      {isSuperAdmin && (
        <div className="mb-4 space-y-2">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Plataforma
          </p>
          <NavCard
            href="/superadmin"
            label="Panel SuperAdmin"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            }
          />
          <NavCard
            href="/superadmin/estudios"
            label="Estudios"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
          />
        </div>
      )}

      {/* ── STUDIO_ADMIN: panel de gestión ── */}
      {isStudioAdmin && (
        <div className="mb-4 space-y-2">
          <p className="mb-1 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Administración
          </p>
          <NavCard
            href={`/${studio}/admin`}
            label="Panel admin"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/students`}
            label="Alumnos"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/sesiones`}
            label="Sesiones"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/settings/clases`}
            label="Tipos de clase"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/settings/paquetes`}
            label="Paquetes"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/settings/branding`}
            label="Apariencia"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="13.5" r="2.5" />
                <circle cx="17" cy="17" r="2.5" /><circle cx="3" cy="3" r="2" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/settings/mercadopago`}
            label="MercadoPago"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/settings/politicas`}
            label="Políticas"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
                <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
                <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
                <line x1="1" x2="7" y1="14" y2="14" /><line x1="9" x2="15" y1="8" y2="8" />
                <line x1="17" x2="23" y1="16" y2="16" />
              </svg>
            }
          />
          <NavCard
            href={`/${studio}/admin/ayuda`}
            label="Ayuda"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path d="M12 17h.01" />
              </svg>
            }
          />

          {/* Link de registro para compartir */}
          {(() => {
            const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')
            const registerUrl = appUrl ? `${appUrl}/${studio}/unirse` : `/${studio}/unirse`
            return (
              <div
                className="rounded-2xl px-4 py-4"
                style={{ background: '#F0F7F0', border: '1px solid var(--sage)' }}
              >
                <p className="mb-1 text-xs font-medium" style={{ color: 'var(--sage)' }}>
                  Link de registro para alumnas
                </p>
                <p className="mb-2 text-xs" style={{ color: 'var(--stone)' }}>
                  Compartí este link para que nuevas alumnas puedan registrarse:
                </p>
                <a
                  href={`/${studio}/unirse`}
                  className="block truncate rounded-xl border px-3 py-2 font-mono text-xs"
                  style={{ borderColor: '#C8DFC8', background: 'white', color: 'var(--sage)' }}
                >
                  {registerUrl}
                </a>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Editar datos personales ── */}
      <div className="mb-4">
        <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Mis datos
        </p>

        {/* Feedback */}
        {savedPerfil && (
          <div className="mb-3 rounded-2xl px-4 py-3 text-sm" style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}>
            Datos actualizados correctamente.
          </div>
        )}
        {savedPassword && (
          <div className="mb-3 rounded-2xl px-4 py-3 text-sm" style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}>
            Contraseña actualizada correctamente.
          </div>
        )}
        {currentError && (
          <div className="mb-3 rounded-2xl px-4 py-3 text-sm" style={{ background: '#FEF3EE', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}>
            {currentError}
          </div>
        )}

        {/* Formulario datos */}
        <div className="mb-3 rounded-2xl px-5 py-5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <form action={updateProfileAction} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Nombre completo
              </label>
              <input
                type="text"
                name="name"
                required
                defaultValue={user.name ?? ''}
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
                defaultValue={(user as { phone?: string | null }).phone ?? ''}
                placeholder="+54 9 11 1234-5678"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
              style={{ background: 'var(--sage)' }}
            >
              Guardar cambios
            </button>
          </form>
        </div>

        {/* Cambiar contraseña */}
        <div className="rounded-2xl px-5 py-5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-3 text-sm font-medium" style={{ color: 'var(--ink)' }}>Cambiar contraseña</p>
          <form action={changePasswordAction} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Contraseña actual
              </label>
              <input
                type="password"
                name="currentPassword"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Nueva contraseña (mín. 8)
              </label>
              <input
                type="password"
                name="newPassword"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                name="confirmPassword"
                required
                minLength={8}
                placeholder="••••••••"
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', background: '#FAFAF9', color: 'var(--ink)' }}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#EDF4ED', color: 'var(--sage)', border: '1px solid var(--sage)' }}
            >
              Cambiar contraseña
            </button>
          </form>
        </div>
      </div>

      {/* Cerrar sesión */}
      <div className="space-y-2">
        <p className="mb-1 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Sesión
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-2xl px-4 py-3.5 text-left text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'white', border: '1px solid #E8E0D6', color: 'var(--terracotta)' }}
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
