import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminStudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { studio } = await params
  const { q } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const studioId = tenant.studioId
  const search = q?.trim() ?? ''

  // ── Fetch alumnos ──────────────────────────────────────────────────────────
  const students = await prisma.user.findMany({
    where: {
      studioId,
      role: 'STUDENT',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      active: true,
      userPackages: {
        where: { paymentStatus: 'APPROVED', classesRemaining: { gt: 0 } },
        select: { classesRemaining: true },
      },
    },
  })

  const studentsWithCredits = students.map((s) => ({
    ...s,
    totalCredits: s.userPackages.reduce((sum, p) => sum + p.classesRemaining, 0),
  }))

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-md px-4 pt-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/${studio}/perfil`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'white', color: 'var(--ink)' }}
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
            Alumnos
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            {studentsWithCredits.length} alumno{studentsWithCredits.length !== 1 ? 's' : ''}
            {search ? ` · búsqueda: "${search}"` : ''}
          </p>
        </div>
      </div>

      {/* Link de invitación */}
      <div
        className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3"
        style={{ background: '#EDF4ED', border: '1px solid #C8DEC8' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--sage)' }}>
            Link de registro para alumnas
          </p>
          <p className="text-xs" style={{ color: 'var(--stone)' }}>
            flexa.app/{studio}/unirse
          </p>
        </div>
        <Link
          href={`/${studio}/unirse`}
          target="_blank"
          className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          Ver
        </Link>
      </div>

      {/* Búsqueda */}
      <form method="GET" className="mb-5">
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Buscar por nombre o email..."
          className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--sage)]"
          style={{ borderColor: '#E8E0D6', background: 'white', color: 'var(--ink)' }}
        />
      </form>

      {/* Lista */}
      {studentsWithCredits.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          <p className="text-sm">
            {search ? `Sin resultados para "${search}".` : 'No hay alumnos registrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {studentsWithCredits.map((student) => (
            <Link
              key={student.id}
              href={`/${studio}/admin/students/${student.id}`}
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-opacity hover:opacity-80"
              style={{
                background: 'white',
                border: '1px solid #E8E0D6',
                opacity: student.active ? 1 : 0.55,
              }}
            >
              {/* Avatar inicial */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                style={{ background: '#EDF4ED', color: 'var(--sage)' }}
              >
                {initials(student.name)}
              </div>

              {/* Datos */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {student.name}
                  {!student.active && (
                    <span
                      className="ml-2 rounded-full px-1.5 py-0.5 text-xs font-normal"
                      style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                    >
                      Inactiva
                    </span>
                  )}
                </p>
                <p className="truncate text-xs" style={{ color: 'var(--stone)' }}>
                  {student.email}
                </p>
              </div>

              {/* Créditos */}
              <div className="shrink-0 text-right">
                <span
                  className="text-2xl font-light"
                  style={{ fontFamily: 'var(--font-cormorant, serif)', color: student.totalCredits > 0 ? 'var(--sage)' : 'var(--stone)' }}
                >
                  {student.totalCredits}
                </span>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  crédito{student.totalCredits !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Chevron */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: '#C4B8AC', flexShrink: 0 }}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
