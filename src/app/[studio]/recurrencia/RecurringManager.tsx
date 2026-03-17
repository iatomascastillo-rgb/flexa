'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { DayOfWeek } from '@prisma/client'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface ClassType {
  id: string
  name: string
}

interface AvailableSlot {
  classTypeId: string
  time: string
}

interface RecurringSchedule {
  id: string
  classTypeId: string
  dayOfWeek: DayOfWeek
  time: string
  active: boolean
  classType: { name: string }
}

interface Props {
  studio: string
  schedules: RecurringSchedule[]
  classTypes: ClassType[]
  availableSlots: AvailableSlot[]
}

// ── Constantes ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
}

const ALL_DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

// ── Componente ────────────────────────────────────────────────────────────────

export default function RecurringManager({ studio, schedules: initial, classTypes, availableSlots }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [schedules, setSchedules] = useState<RecurringSchedule[]>(initial)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedClassType, setSelectedClassType] = useState(classTypes[0]?.id ?? '')
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('MONDAY')
  const [selectedTime, setSelectedTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Times filtered by selected class type
  const availableTimes = [
    ...new Set(
      availableSlots
        .filter((s) => s.classTypeId === selectedClassType)
        .map((s) => s.time)
        .sort(),
    ),
  ]

  // Handlers
  async function handleAdd() {
    if (!selectedClassType || !selectedDay || !selectedTime) {
      setError('Completá todos los campos')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/${studio}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classTypeId: selectedClassType, dayOfWeek: selectedDay, time: selectedTime }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        return
      }

      const created: RecurringSchedule = await res.json()
      setSchedules((prev) => [...prev, created])
      setIsAdding(false)
      setSelectedTime('')
      // Sincronizar el server component para que el initial prop quede actualizado
      startTransition(() => router.refresh())
    } catch {
      setError('Error de conexión')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleToggle(schedule: RecurringSchedule) {
    // Optimistic update
    setSchedules((prev) =>
      prev.map((s) => (s.id === schedule.id ? { ...s, active: !s.active } : s)),
    )

    const res = await fetch(`/api/${studio}/recurring/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !schedule.active }),
    })

    if (!res.ok) {
      // Revertir si falló
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, active: schedule.active } : s)),
      )
      setError('No se pudo actualizar')
    } else {
      startTransition(() => router.refresh())
    }
  }

  async function handleDelete(scheduleId: string) {
    // Optimistic remove from list
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId))

    const res = await fetch(`/api/${studio}/recurring/${scheduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })

    if (!res.ok) {
      setError('No se pudo eliminar')
    }
    // Sincronizar siempre: tanto en éxito como en error para que el server tenga el estado real
    startTransition(() => router.refresh())
  }

  return (
    <div>
      {/* Lista de schedules activos */}
      {schedules.filter((s) => s.active).length > 0 ? (
        <div className="mb-6">
          <p
            className="mb-3 px-1 text-xs font-medium uppercase tracking-widest"
            style={{ color: 'var(--stone)' }}
          >
            Tus clases recurrentes
          </p>
          <div className="space-y-2">
            {schedules
              .filter((s) => s.active)
              .map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between rounded-2xl px-4 py-3"
                  style={{ background: 'white', border: '1px solid #E8E0D6' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {schedule.classType.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>
                      {DAY_LABELS[schedule.dayOfWeek]} · {schedule.time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-70"
                      style={{ background: '#FEE2E2', color: '#B91C1C' }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        !isAdding && (
          <div
            className="mb-6 rounded-2xl p-6 text-center"
            style={{ background: '#F9F6F2', border: '1px dashed #D4C9BB' }}
          >
            <p className="text-sm" style={{ color: 'var(--stone)' }}>
              No tenés clases recurrentes configuradas.
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--stone)', opacity: 0.7 }}>
              Agregá una y el sistema te reservará automáticamente cada semana.
            </p>
          </div>
        )
      )}

      {/* Banner informativo */}
      {schedules.filter((s) => s.active).length > 0 && (
        <div
          className="mb-6 rounded-2xl px-4 py-3"
          style={{ background: '#FFFBEB', border: '1px solid #FDE68A' }}
        >
          <p className="text-xs" style={{ color: '#92400E' }}>
            Los cambios aplican desde el próximo mes. Las reservas ya generadas no se modifican.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: '#FEE2E2', color: '#B91C1C' }}
        >
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Cerrar
          </button>
        </div>
      )}

      {/* Formulario para agregar */}
      {isAdding ? (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
            Nueva recurrencia
          </p>

          <div className="space-y-3">
            {/* Tipo de clase */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Tipo de clase
              </label>
              <select
                value={selectedClassType}
                onChange={(e) => {
                  setSelectedClassType(e.target.value)
                  setSelectedTime('')
                }}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              >
                {classTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Día */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Día
              </label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              >
                {ALL_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </div>

            {/* Horario */}
            <div>
              <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
                Horario
              </label>
              {availableTimes.length > 0 ? (
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                >
                  <option value="">Elegí un horario</option>
                  {availableTimes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  No hay horarios disponibles para este tipo de clase.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSubmitting || !selectedTime}
              className="flex-1 rounded-xl py-2 text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setError(null)
              }}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-sm transition-opacity hover:opacity-70"
              style={{ color: 'var(--stone)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full rounded-2xl py-3 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          + Agregar recurrencia
        </button>
      )}

      {isPending && (
        <p className="mt-3 text-center text-xs" style={{ color: 'var(--stone)' }}>
          Actualizando...
        </p>
      )}
    </div>
  )
}
