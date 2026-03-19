import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import type { HolidayPolicy } from '@prisma/client'
import { fmtDateFullUTC } from '@/lib/formatters'

// ── Server Actions ─────────────────────────────────────────────────────────────

async function addHolidayAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const dateStr = formData.get('date') as string
  const name = (formData.get('name') as string)?.trim() || null
  const policy = (formData.get('policy') as string) === 'CLASSES_NORMAL' ? 'CLASSES_NORMAL' : 'NO_CLASSES'

  if (!dateStr) return

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))

  await prisma.studioHoliday.upsert({
    where: { studioId_date: { studioId, date } },
    create: { studioId, date, name, policy: policy as HolidayPolicy },
    update: { name, policy: policy as HolidayPolicy },
  })

  revalidatePath(`/${studio}/admin/settings/feriados`)
}

async function deleteHolidayAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const holidayId = formData.get('holidayId') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  // deleteMany con studioId en el where — atómico, evita TOCTOU y verifica pertenencia
  await prisma.studioHoliday.deleteMany({
    where: { id: holidayId, studioId },
  })

  revalidatePath(`/${studio}/admin/settings/feriados`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FeriadosPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  const holidays = await prisma.studioHoliday.findMany({
    where: { studioId },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, name: true, policy: true },
  })

  const upcoming = holidays.filter((h) => h.date >= todayUTC)
  const past = holidays.filter((h) => h.date < todayUTC)

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
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
            Feriados y cierres
          </h1>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
            El cron no generará sesiones en días sin clases
          </p>
        </div>
      </div>

      {/* ── Agregar feriado ── */}
      <section
        className="mb-6 rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <h2
          className="mb-4 text-xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Agregar fecha
        </h2>

        <form action={addHolidayAction} className="space-y-3">
          <input type="hidden" name="studio" value={studio} />

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Fecha
            </label>
            <input
              type="date"
              name="date"
              required
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)', background: 'white' }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Nombre <span className="opacity-60">(opcional)</span>
            </label>
            <input
              type="text"
              name="name"
              placeholder="ej: Navidad, Cierre de verano..."
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              ¿Qué hace tu estudio ese día?
            </label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="policy"
                  value="NO_CLASSES"
                  defaultChecked
                  className="mt-0.5 accent-[var(--sage)]"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>No hay clases</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    El cron no genera sesiones para esta fecha
                  </p>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="policy"
                  value="CLASSES_NORMAL"
                  className="mt-0.5 accent-[var(--sage)]"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Clase igual</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    Se generan las sesiones normalmente (solo es un recordatorio)
                  </p>
                </div>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--ink)', color: 'white' }}
          >
            Guardar fecha
          </button>
        </form>
      </section>

      {/* ── Próximos feriados ── */}
      {upcoming.length > 0 && (
        <section className="mb-5">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Próximas fechas ({upcoming.length})
          </p>
          <div className="space-y-2">
            {upcoming.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div>
                  <p className="text-sm font-medium capitalize" style={{ color: 'var(--ink)' }}>
                    {h.name ?? fmtDateFullUTC(h.date)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    {h.name ? fmtDateFullUTC(h.date) + ' · ' : ''}
                    {h.policy === 'NO_CLASSES' ? 'Sin clases' : 'Clase igual'}
                  </p>
                </div>
                <form action={deleteHolidayAction}>
                  <input type="hidden" name="studio" value={studio} />
                  <input type="hidden" name="holidayId" value={h.id} />
                  <button
                    type="submit"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs transition-opacity hover:opacity-70"
                    style={{ background: '#FEF0EC', color: 'var(--terracotta)' }}
                    title="Eliminar"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length === 0 && (
        <div
          className="mb-5 rounded-2xl p-6 text-center"
          style={{ background: 'white', color: 'var(--stone)' }}
        >
          <p className="text-sm">No hay feriados configurados próximamente.</p>
        </div>
      )}

      {/* ── Pasados ── */}
      {past.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Historial
          </p>
          <div className="space-y-2">
            {past.slice(-5).reverse().map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-2xl px-4 py-3 opacity-50"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div>
                  <p className="text-sm font-medium capitalize" style={{ color: 'var(--ink)' }}>
                    {h.name ?? fmtDateFullUTC(h.date)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    {h.name ? fmtDateFullUTC(h.date) + ' · ' : ''}
                    {h.policy === 'NO_CLASSES' ? 'Sin clases' : 'Clase igual'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
