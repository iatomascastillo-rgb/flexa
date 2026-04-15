'use client'

import { useState, useTransition } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClassType {
  id: string
  name: string
}

interface Room {
  id: string
  name: string
}

interface Slot {
  localId: string
  classTypeId: string
  time: string
  // advanced
  instructorName: string
  roomId: string
}

interface Props {
  studio: string
  classTypes: ClassType[]
  activeRooms: Room[]
  action: (formData: FormData) => Promise<void>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 'MONDAY',    short: 'Lun', label: 'Lunes' },
  { value: 'TUESDAY',   short: 'Mar', label: 'Martes' },
  { value: 'WEDNESDAY', short: 'Mié', label: 'Miércoles' },
  { value: 'THURSDAY',  short: 'Jue', label: 'Jueves' },
  { value: 'FRIDAY',    short: 'Vie', label: 'Viernes' },
  { value: 'SATURDAY',  short: 'Sáb', label: 'Sábado' },
  { value: 'SUNDAY',    short: 'Dom', label: 'Domingo' },
]

function makeSlot(classTypeId: string): Slot {
  return {
    localId: Math.random().toString(36).slice(2),
    classTypeId,
    time: '09:00',
    instructorName: '',
    roomId: '',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DayScheduleBuilder({ studio, classTypes, activeRooms, action }: Props) {
  const [selectedDay, setSelectedDay] = useState('MONDAY')
  const [slots, setSlots] = useState<Slot[]>(() => [makeSlot(classTypes[0]?.id ?? '')])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const dayLabel = DAYS.find((d) => d.value === selectedDay)?.label ?? selectedDay

  function addSlot() {
    setSlots((prev) => [...prev, makeSlot(classTypes[0]?.id ?? '')])
  }

  function removeSlot(localId: string) {
    setSlots((prev) => prev.length > 1 ? prev.filter((s) => s.localId !== localId) : prev)
  }

  function updateSlot(localId: string, field: keyof Omit<Slot, 'localId'>, value: string) {
    setSlots((prev) => prev.map((s) => s.localId === localId ? { ...s, [field]: value } : s))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(null)
    setSaveError(null)

    const validSlots = slots.filter((s) => s.classTypeId && s.time)
    if (validSlots.length === 0) {
      setSaveError('Agregá al menos un horario con tipo y hora.')
      return
    }

    const formData = new FormData()
    formData.set('studio', studio)
    formData.set('dayOfWeek', selectedDay)
    formData.set('slotsJson', JSON.stringify(validSlots.map((s) => ({
      classTypeId: s.classTypeId,
      time: s.time,
      instructorName: s.instructorName.trim() || null,
      roomId: s.roomId || null,
    }))))

    startTransition(async () => {
      try {
        await action(formData)
        setSaved(validSlots.length)
        // Reset slots after save
        setSlots([makeSlot(classTypes[0]?.id ?? '')])
        setTimeout(() => setSaved(null), 4000)
      } catch {
        setSaveError('Ocurrió un error al guardar. Intentá de nuevo.')
      }
    })
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
      <p className="mb-3 text-xs font-medium" style={{ color: 'var(--stone)' }}>
        Agregar horarios por día
      </p>

      {/* ── Selector de día ── */}
      <div className="mb-4 flex gap-1.5 flex-wrap">
        {DAYS.map((d) => {
          const active = d.value === selectedDay
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => setSelectedDay(d.value)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--sage)' : '#F5F0EB',
                color: active ? 'white' : 'var(--stone)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {d.short}
            </button>
          )
        })}
      </div>

      {/* ── Formulario de slots ── */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-2 mb-3">
          {slots.map((slot, idx) => (
            <div key={slot.localId}>
              {/* Fila principal: tipo + hora + eliminar */}
              <div className="flex items-center gap-2">
                {/* Número */}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                  style={{ background: '#EDF4ED', color: 'var(--sage)' }}
                >
                  {idx + 1}
                </span>

                {/* Tipo de clase */}
                <select
                  value={slot.classTypeId}
                  onChange={(e) => updateSlot(slot.localId, 'classTypeId', e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                >
                  {classTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>

                {/* Hora */}
                <input
                  type="time"
                  value={slot.time}
                  onChange={(e) => updateSlot(slot.localId, 'time', e.target.value)}
                  step={900}
                  required
                  className="w-28 shrink-0 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />

                {/* Eliminar */}
                <button
                  type="button"
                  onClick={() => removeSlot(slot.localId)}
                  disabled={slots.length === 1}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-25"
                  style={{ background: '#F5F0EB', color: 'var(--stone)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Campos avanzados: instructor + salón */}
              {showAdvanced && (
                <div className="mt-1.5 ml-8 flex gap-2">
                  <input
                    type="text"
                    value={slot.instructorName}
                    onChange={(e) => updateSlot(slot.localId, 'instructorName', e.target.value)}
                    placeholder="Instructor (opcional)"
                    className="min-w-0 flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none focus:border-[var(--sage)]"
                    style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                  />
                  {activeRooms.length > 0 && (
                    <select
                      value={slot.roomId}
                      onChange={(e) => updateSlot(slot.localId, 'roomId', e.target.value)}
                      className="w-36 shrink-0 rounded-xl border px-3 py-1.5 text-xs outline-none focus:border-[var(--sage)]"
                      style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                    >
                      <option value="">Sin salón</option>
                      {activeRooms.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Controles secundarios */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={addSlot}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sage)' }}
          >
            + Agregar horario
          </button>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-xs transition-opacity hover:opacity-70"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)' }}
          >
            {showAdvanced ? '▲ Ocultar opciones' : '▼ Instructor / Salón'}
          </button>
        </div>

        {/* Feedback */}
        {saveError && (
          <p className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            {saveError}
          </p>
        )}
        {saved !== null && (
          <p className="mb-3 rounded-xl px-3 py-2 text-xs" style={{ background: '#EDF4ED', color: 'var(--sage)' }}>
            ✓ {saved} horario{saved !== 1 ? 's' : ''} guardado{saved !== 1 ? 's' : ''} para {dayLabel}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {isPending ? 'Guardando…' : `Guardar ${dayLabel}`}
        </button>
      </form>
    </div>
  )
}
