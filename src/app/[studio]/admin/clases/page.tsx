import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { requireStudioAdminPage, checkStudioAdmin } from '@/lib/auth-guards'
import { prisma } from '@/lib/prisma'
import { ApplyRecurringButton } from './ApplyRecurringButton'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS_ES: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
}
const DAY_ORDER: Record<string, number> = {
  MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
  FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
}

const DAYS_ARRAY = [
  { value: 'MONDAY', label: 'Lunes' },
  { value: 'TUESDAY', label: 'Martes' },
  { value: 'WEDNESDAY', label: 'Miércoles' },
  { value: 'THURSDAY', label: 'Jueves' },
  { value: 'FRIDAY', label: 'Viernes' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
]

const DOW_TO_UTC: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
}

/**
 * Genera todas las fechas que coinciden con `dayOfWeek` desde mañana
 * hasta el último día del mes siguiente (en AR timezone).
 *
 * Esto garantiza que cuando el cron corra el día 25, ya existan las
 * sesiones del mes en curso y del siguiente, sin importar qué día
 * del mes se registró el estudio.
 *
 * Ejemplo registrando el 26/3 (cron ya corrió):
 *   → genera resto de abril + mayo hasta el cron del 25/4
 */
function getDatesUntilEndOfNextMonth(dayOfWeek: string): Date[] {
  const targetDow = DOW_TO_UTC[dayOfWeek] ?? 1
  const now = new Date()
  // Fecha actual en Argentina (UTC-3)
  const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const arY = arNow.getUTCFullYear()
  const arM = arNow.getUTCMonth() // 0-indexed

  // Último día del mes siguiente en AR (mediodía UTC para evitar ambigüedades)
  const nextMonth = (arM + 1) % 12
  const nextMonthYear = arM === 11 ? arY + 1 : arY
  const daysInNextMonth = new Date(nextMonthYear, nextMonth + 1, 0).getDate()
  const cutoff = Date.UTC(nextMonthYear, nextMonth, daysInNextMonth, 12, 0, 0)

  // Primera ocurrencia del día objetivo desde mañana
  const todayNoon = Date.UTC(arY, arM, arNow.getUTCDate(), 12, 0, 0)
  const todayDow = arNow.getUTCDay()
  let daysAhead = (targetDow - todayDow + 7) % 7
  if (daysAhead === 0) daysAhead = 7

  const dates: Date[] = []
  let cursor = todayNoon + daysAhead * 86_400_000
  while (cursor <= cutoff) {
    dates.push(new Date(cursor))
    cursor += 7 * 86_400_000
  }
  return dates
}

// ── Server Actions ─────────────────────────────────────────────────────────────

async function addRoomAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard
  if (!name) return

  await prisma.room.create({
    data: { studioId, name },
  })

  revalidatePath(`/${studio}/admin/clases`)
}

async function toggleRoomAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const roomId = formData.get('roomId') as string
  const currentActive = formData.get('currentActive') === 'true'

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  await prisma.room.update({
    where: { id: roomId, studioId },
    data: { active: !currentActive },
  })

  revalidatePath(`/${studio}/admin/clases`)
}

async function addClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const name = (formData.get('name') as string)?.trim()
  const level = (formData.get('level') as string)?.trim()
  const description = (formData.get('description') as string)?.trim()
  const defaultCapacity = parseInt(formData.get('defaultCapacity') as string, 10)

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard
  if (!name || isNaN(defaultCapacity) || defaultCapacity < 1) return

  await prisma.classType.create({
    data: { studioId, name, level: level || null, description: description || null, defaultCapacity },
  })

  revalidatePath(`/${studio}/admin/clases`)
}

async function toggleClassTypeAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const currentActive = formData.get('currentActive') === 'true'

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  await prisma.classType.update({
    where: { id: classTypeId, studioId },
    data: { active: !currentActive },
  })

  revalidatePath(`/${studio}/admin/clases`)
}

async function addScheduleTemplateAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const classTypeId = formData.get('classTypeId') as string
  const dayOfWeek = formData.get('dayOfWeek') as string
  const time = formData.get('time') as string
  const instructorName = (formData.get('instructorName') as string)?.trim() || null
  const roomId = (formData.get('roomId') as string) || null

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard
  if (!classTypeId || !dayOfWeek || !time) return

  // Upsert del template permanente (findFirst + create/update para soportar roomId nullable)
  const existingTemplate = await prisma.classScheduleTemplate.findFirst({
    where: { studioId, classTypeId, dayOfWeek: dayOfWeek as never, time, roomId },
    select: { id: true },
  })
  if (existingTemplate) {
    await prisma.classScheduleTemplate.update({
      where: { id: existingTemplate.id },
      data: { active: true, instructorName, roomId },
    })
  } else {
    await prisma.classScheduleTemplate.create({
      data: { studioId, classTypeId, dayOfWeek: dayOfWeek as never, time, instructorName, roomId },
    })
  }

  // Generar sesiones hasta fin del mes siguiente (cubre todos los casos de onboarding).
  // skipDuplicates → idempotente, re-ejecutar es seguro.
  const dates = getDatesUntilEndOfNextMonth(dayOfWeek)
  await prisma.classSession.createMany({
    data: dates.map((date) => ({ studioId, classTypeId, date, time, instructorName, roomId })),
    skipDuplicates: true,
  })

  revalidatePath(`/${studio}/admin/clases`)
}

async function removeScheduleTemplateAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string
  const templateId = formData.get('templateId') as string

  const guard = await checkStudioAdmin(studio)
  if (!guard) return
  const { studioId } = guard

  // Desactivar (soft-delete): el cron no la generará más, las sesiones existentes quedan
  await prisma.classScheduleTemplate.update({
    where: { id: templateId, studioId },
    data: { active: false },
  })

  revalidatePath(`/${studio}/admin/clases`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminGestionarClasesPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  const [classTypes, templates, rooms] = await Promise.all([
    prisma.classType.findMany({
      where: { studioId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, level: true, description: true, defaultCapacity: true, active: true,
        _count: { select: { classSessions: { where: { cancelledAt: null } } } },
      },
    }),
    prisma.classScheduleTemplate.findMany({
      where: { studioId, active: true },
      orderBy: [{ dayOfWeek: 'asc' }, { time: 'asc' }],
      select: {
        id: true, dayOfWeek: true, time: true, instructorName: true,
        classType: { select: { id: true, name: true } },
        room: { select: { name: true } },
      },
    }),
    prisma.room.findMany({
      where: { studioId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, active: true },
    }),
  ])

  const activeClassTypes = classTypes.filter((ct) => ct.active)
  const activeRooms = rooms.filter((r) => r.active)

  // Ordenar templates por día de semana (Lunes primero)
  const sortedTemplates = [...templates].sort(
    (a, b) => (DAY_ORDER[a.dayOfWeek] ?? 9) - (DAY_ORDER[b.dayOfWeek] ?? 9) || a.time.localeCompare(b.time)
  )

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
      {/* Header */}
      <Link
        href={`/${studio}/admin`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--stone)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Admin
      </Link>

      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Gestionar clases
      </h1>
      <p className="mb-7 text-sm" style={{ color: 'var(--stone)' }}>
        Tipos de clase y horarios fijos. El cron genera las sesiones de cada mes automáticamente.
      </p>

      {/* ══════════════════════════════════════════════════════════════════
          SECCIÓN 0: SALONES
      ══════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Salones
        </p>

        {rooms.length > 0 && (
          <div className="mb-3 space-y-2">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background: 'white',
                  border: '1px solid #E8E0D6',
                  opacity: room.active ? 1 : 0.55,
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{room.name}</p>
                <form action={toggleRoomAction}>
                  <input type="hidden" name="studio" value={studio} />
                  <input type="hidden" name="roomId" value={room.id} />
                  <input type="hidden" name="currentActive" value={String(room.active)} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={room.active
                      ? { background: '#EDF4ED', color: 'var(--sage)' }
                      : { background: '#F5F0EB', color: 'var(--stone)' }}
                  >
                    {room.active ? 'Activo' : 'Inactivo'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-3 text-xs font-medium" style={{ color: 'var(--stone)' }}>
            {rooms.length === 0 ? 'Agregar salón (opcional)' : 'Agregar salón'}
          </p>
          <form action={addRoomAction} className="flex gap-2">
            <input type="hidden" name="studio" value={studio} />
            <input
              type="text" name="name" required placeholder="ej: Sala A, Sala Reformer"
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
              style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: '#EDF4ED', color: 'var(--sage)' }}
            >
              + Agregar
            </button>
          </form>
          {rooms.length === 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--stone)' }}>
              Si tu estudio tiene un solo espacio no necesitás configurar salones.
            </p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECCIÓN 1: TIPOS DE CLASE
      ══════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
          Tipos de clase
        </p>

        {classTypes.length > 0 && (
          <div className="mb-3 space-y-2">
            {classTypes.map((ct) => (
              <div
                key={ct.id}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background: 'white',
                  border: '1px solid #E8E0D6',
                  opacity: ct.active ? 1 : 0.55,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{ct.name}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                    {ct.level ? `${ct.level} · ` : ''}{ct.defaultCapacity} lugares · {ct._count.classSessions} sesiones activas
                  </p>
                  {ct.description && (
                    <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--stone)', opacity: 0.7 }}>
                      {ct.description}
                    </p>
                  )}
                </div>
                <form action={toggleClassTypeAction}>
                  <input type="hidden" name="studio" value={studio} />
                  <input type="hidden" name="classTypeId" value={ct.id} />
                  <input type="hidden" name="currentActive" value={String(ct.active)} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={ct.active
                      ? { background: '#EDF4ED', color: 'var(--sage)' }
                      : { background: '#F5F0EB', color: 'var(--stone)' }}
                  >
                    {ct.active ? 'Activo' : 'Inactivo'}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
          <p className="mb-3 text-xs font-medium" style={{ color: 'var(--stone)' }}>
            {classTypes.length === 0 ? 'Crear primer tipo de clase' : 'Agregar tipo de clase'}
          </p>
          <form action={addClassTypeAction} className="space-y-3">
            <input type="hidden" name="studio" value={studio} />
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Nombre *</label>
                <input
                  type="text" name="name" required placeholder="ej: Pilates Reformer"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Descripción</label>
                <textarea
                  name="description" rows={2} placeholder="ej: Clase con máquinas Reformer, nivel mixto"
                  className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Nivel</label>
                <input
                  type="text" name="level" placeholder="ej: Avanzado"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Capacidad *</label>
                <input
                  type="number" name="defaultCapacity" required placeholder="8" min={1} max={100}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              Crear tipo de clase
            </button>
          </form>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          SECCIÓN 2: HORARIO SEMANAL (TEMPLATES)
      ══════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Horario semanal fijo
          </p>
          {sortedTemplates.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--stone)' }}>
              Se genera automáticamente cada mes
            </span>
          )}
        </div>

        {activeClassTypes.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-6 text-center"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            <p className="text-sm" style={{ color: 'var(--stone)' }}>
              Primero creá al menos un tipo de clase activo.
            </p>
          </div>
        ) : (
          <>
            {/* Lista de templates activos */}
            {sortedTemplates.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {sortedTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl px-4 py-2.5"
                    style={{ background: 'white', border: '1px solid #E8E0D6' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                        {t.classType.name}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                        {DAYS_ES[t.dayOfWeek]} · {t.time}
                        {t.instructorName ? ` · ${t.instructorName}` : ''}
                        {t.room ? ` · ${t.room.name}` : ''}
                      </p>
                    </div>
                    <form action={removeScheduleTemplateAction}>
                      <input type="hidden" name="studio" value={studio} />
                      <input type="hidden" name="templateId" value={t.id} />
                      <button
                        type="submit"
                        className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                        style={{ background: '#F5F0EB', color: 'var(--stone)' }}
                        title="Quitar horario"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            {/* Agregar template */}
            <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
              <p className="mb-3 text-xs font-medium" style={{ color: 'var(--stone)' }}>
                {sortedTemplates.length === 0 ? 'Agregar primer horario' : 'Agregar horario'}
              </p>
              <form action={addScheduleTemplateAction} className="space-y-3">
                <input type="hidden" name="studio" value={studio} />

                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Tipo de clase</label>
                  <select
                    name="classTypeId" required
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                    style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                  >
                    {activeClassTypes.map((ct) => (
                      <option key={ct.id} value={ct.id}>{ct.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Día de la semana</label>
                    <select
                      name="dayOfWeek"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    >
                      {DAYS_ARRAY.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Horario</label>
                    <input
                      type="time" name="time" defaultValue="10:00" required
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Instructor (opcional)</label>
                  <input
                    type="text" name="instructorName" placeholder="ej: María García"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                    style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                  />
                </div>

                {activeRooms.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>Salón</label>
                    <select
                      name="roomId"
                      className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    >
                      <option value="">Sin salón asignado</option>
                      {activeRooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                >
                  + Agregar a horario fijo
                </button>
              </form>

              {sortedTemplates.length > 0 && (
                <p className="mt-3 text-center text-xs" style={{ color: 'var(--stone)' }}>
                  El cron genera las sesiones del próximo mes automáticamente el día 25.
                </p>
              )}
            </div>
          </>
        )}
      </section>

      <ApplyRecurringButton studioId={studioId} />
    </div>
  )
}
