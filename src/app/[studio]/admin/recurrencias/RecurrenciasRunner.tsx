'use client'

import { useState } from 'react'

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Summary {
  sessionsGenerated: number
  bookingsCredit: number
  bookingsGrace: number
  skippedAlreadyBooked: number
  skippedFull: number
  alertUserIds: string[]
}

interface Outcome {
  sessionId: string
  date: string
  outcome: 'credit' | 'grace' | 'full' | 'no_coverage' | 'already_booked'
}

interface Decision {
  scheduleId: string
  userId: string
  classTypeName: string
  dayOfWeek: string
  time: string
  outcomes: Outcome[]
}

interface RunResult {
  ok: boolean
  month: string
  fromDate?: string
  dryRun: boolean
  summary: Summary
  decisions: Decision[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  const now = new Date()
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function currentYearMonth() {
  const now = new Date()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() }
}

function nextYearMonth() {
  const now = new Date()
  return now.getUTCMonth() === 11
    ? { year: now.getUTCFullYear() + 1, month: 0 }
    : { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 15)).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
}

const OUTCOME_STYLE: Record<string, { label: string; color: string }> = {
  credit:         { label: 'Reservado con crédito', color: '#16A34A' },
  grace:          { label: 'Reservado en gracia',   color: '#D97706' },
  full:           { label: 'Sesión llena',           color: '#6B7280' },
  no_coverage:    { label: 'Sin cobertura',          color: '#DC2626' },
  already_booked: { label: 'Ya tenía reserva',       color: '#9CA3AF' },
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function RecurrenciasRunner({ studioId }: { studioId: string }) {
  const cur = currentYearMonth()
  const nxt = nextYearMonth()

  const [targetMonth, setTargetMonth] = useState<'current' | 'next'>('current')
  const [fromToday, setFromToday] = useState(true)
  const [dryRun, setDryRun] = useState(true)

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { year, month } = targetMonth === 'current' ? cur : nxt

  async function handleRun() {
    setRunning(true)
    setResult(null)
    setError(null)

    try {
      const body: Record<string, unknown> = { studioId, year, month, dryRun }
      if (targetMonth === 'current' && fromToday) {
        body.fromDate = todayISO()
      }

      const res = await fetch('/api/cron/test-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error interno')
        return
      }
      setResult(data as RunResult)
    } catch {
      setError('Error de conexión')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div>
      {/* Formulario */}
      <div
        className="mb-6 rounded-2xl p-6"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <p className="mb-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>Configuración</p>

        {/* Selector de mes */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--stone)' }}>
            Mes a procesar
          </p>
          <div className="flex gap-2">
            {(['current', 'next'] as const).map((m) => {
              const { year: y, month: mo } = m === 'current' ? cur : nxt
              const active = targetMonth === m
              return (
                <button
                  key={m}
                  onClick={() => setTargetMonth(m)}
                  className="flex-1 rounded-xl py-2 text-sm font-medium transition-all"
                  style={{
                    background: active ? 'var(--sage)' : '#F5F0EB',
                    color: active ? 'white' : 'var(--ink)',
                  }}
                >
                  {monthLabel(y, mo)}{m === 'current' ? ' (actual)' : ' (siguiente)'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Desde hoy — solo para mes actual */}
        {targetMonth === 'current' && (
          <div className="mb-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={fromToday}
                onChange={(e) => setFromToday(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded"
                style={{ accentColor: 'var(--sage)' }}
              />
              <div>
                <p className="text-sm" style={{ color: 'var(--ink)' }}>
                  Solo desde hoy ({todayISO()}) hasta fin de mes
                </p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  {fromToday
                    ? 'Omite sesiones ya pasadas. Ideal para ejecutar a mitad de mes.'
                    : 'Procesa el mes entero, incluyendo fechas ya pasadas.'}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Dry-run */}
        <div className="mb-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded"
              style={{ accentColor: 'var(--sage)' }}
            />
            <div>
              <p className="text-sm" style={{ color: 'var(--ink)' }}>
                Simulación — no guarda nada
              </p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                {dryRun
                  ? 'Muestra qué pasaría sin crear reservas reales. Recomendado para verificar primero.'
                  : '⚠️ Las reservas se crearán realmente en la base de datos.'}
              </p>
            </div>
          </label>
        </div>

        {/* Resumen de la acción */}
        <div
          className="mb-5 rounded-xl px-4 py-3 text-xs"
          style={{
            background: dryRun ? '#EDF4ED' : '#FEF3C7',
            color: dryRun ? '#15803D' : '#92400E',
          }}
        >
          {dryRun ? '🔍 Simulación: ' : '⚡ Ejecución real: '}
          Procesar <strong>{monthLabel(year, month)}</strong>
          {targetMonth === 'current' && fromToday ? ` desde el ${todayISO()}` : ' completo'}
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: dryRun ? 'var(--sage)' : '#DC2626', color: 'white' }}
        >
          {running ? 'Procesando...' : dryRun ? 'Simular' : 'Ejecutar ahora'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {/* Header de resultado */}
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: result.dryRun ? '#EDF4ED' : '#FEE2E2',
                color: result.dryRun ? '#15803D' : '#B91C1C',
              }}
            >
              {result.dryRun ? 'Simulación' : 'Ejecutado'}
            </span>
            <span className="text-xs" style={{ color: 'var(--stone)' }}>
              {result.month}{result.fromDate ? ` desde ${result.fromDate}` : ''}
            </span>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Con crédito',     value: result.summary.bookingsCredit,        color: '#16A34A' },
              { label: 'En gracia',       value: result.summary.bookingsGrace,          color: '#D97706' },
              { label: 'Sin cobertura',   value: result.summary.alertUserIds.length,   color: '#DC2626' },
              { label: 'Sesión llena',    value: result.summary.skippedFull,           color: '#6B7280' },
              { label: 'Ya reservadas',   value: result.summary.skippedAlreadyBooked,  color: '#9CA3AF' },
              { label: 'Sesiones nuevas', value: result.summary.sessionsGenerated,     color: 'var(--ink)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl p-3 text-center"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <p className="text-2xl font-light" style={{ color }}>{value}</p>
                <p className="mt-1 text-xs leading-tight" style={{ color: 'var(--stone)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Detalle por schedule */}
          {result.decisions.length > 0 ? (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'white', border: '1px solid #E8E0D6' }}
            >
              <p className="mb-4 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--stone)' }}>
                Detalle por alumno
              </p>
              <div className="divide-y" style={{ borderColor: '#F0E8DF' }}>
                {result.decisions.map((d) => (
                  <div key={d.scheduleId} className="py-3 first:pt-0 last:pb-0">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                          {d.classTypeName} · {DAY_LABELS[d.dayOfWeek] ?? d.dayOfWeek} {d.time}
                        </p>
                        <p className="text-xs font-mono" style={{ color: 'var(--stone)' }}>
                          {d.userId.slice(0, 12)}…
                        </p>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--stone)' }}>
                        {d.outcomes.length} sesión{d.outcomes.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {d.outcomes.map((o) => {
                        const s = OUTCOME_STYLE[o.outcome] ?? { label: o.outcome, color: '#000' }
                        return (
                          <div key={o.sessionId} className="flex items-center justify-between text-xs">
                            <span style={{ color: 'var(--stone)' }}>{o.date}</span>
                            <span style={{ color: s.color }}>{s.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: '#F9F6F2', border: '1px dashed #D4C9BB' }}
            >
              <p className="text-sm" style={{ color: 'var(--stone)' }}>
                No hay recurrencias activas para este estudio.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
