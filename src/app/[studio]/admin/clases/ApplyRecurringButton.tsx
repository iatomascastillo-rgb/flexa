'use client'

import { useState } from 'react'

interface Summary {
  sessionsGenerated: number
  bookingsCredit: number
  bookingsGrace: number
  skippedAlreadyBooked: number
  skippedFull: number
  alertUserIds: string[]
}

interface MonthResult {
  label: string
  summary: Summary
}

async function runMonth(
  studioId: string,
  year: number,
  month: number,
  fromDate?: string,
  skipGrace?: boolean,
): Promise<{ ok: boolean; summary: Summary; error?: string }> {
  const body: Record<string, unknown> = { studioId, year, month, dryRun: false }
  if (fromDate) body.fromDate = fromDate
  if (skipGrace) body.skipGrace = true

  const res = await fetch('/api/cron/test-recurring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return { ok: false, summary: emptySummary(), error: data.error ?? 'Error desconocido' }
  return { ok: true, summary: data.summary }
}

function emptySummary(): Summary {
  return { sessionsGenerated: 0, bookingsCredit: 0, bookingsGrace: 0, skippedAlreadyBooked: 0, skippedFull: 0, alertUserIds: [] }
}

function mergeSummaries(a: Summary, b: Summary): Summary {
  return {
    sessionsGenerated: a.sessionsGenerated + b.sessionsGenerated,
    bookingsCredit: a.bookingsCredit + b.bookingsCredit,
    bookingsGrace: a.bookingsGrace + b.bookingsGrace,
    skippedAlreadyBooked: a.skippedAlreadyBooked + b.skippedAlreadyBooked,
    skippedFull: a.skippedFull + b.skippedFull,
    alertUserIds: [...new Set([...a.alertUserIds, ...b.alertUserIds])],
  }
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export function ApplyRecurringButton({ studioId }: { studioId: string }) {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<MonthResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    setLoading(true)
    setResults(null)
    setError(null)

    // Mes actual en AR (UTC-3)
    const now = new Date()
    const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const currYear = arNow.getUTCFullYear()
    const currMonth = arNow.getUTCMonth() // 0-indexed
    const fromDate = arNow.toISOString().slice(0, 10)

    // Mes siguiente
    const nextMonth = (currMonth + 1) % 12
    const nextYear = currMonth === 11 ? currYear + 1 : currYear

    try {
      // 1. Mes actual desde hoy (no recrear reservas pasadas)
      const curr = await runMonth(studioId, currYear, currMonth, fromDate)
      if (!curr.ok) { setError(curr.error ?? 'Error en mes actual'); return }

      // 2. Mes siguiente completo — skipGrace=true: el mes aún no empezó,
      //    la gracia no aplica hasta que comience el período de renovación real
      const next = await runMonth(studioId, nextYear, nextMonth, undefined, true)
      if (!next.ok) { setError(next.error ?? 'Error en mes siguiente'); return }

      setResults([
        { label: `${MONTHS_ES[currMonth]} ${currYear}`, summary: curr.summary },
        { label: `${MONTHS_ES[nextMonth]} ${nextYear}`, summary: next.summary },
      ])
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }

  const combined = results ? mergeSummaries(results[0].summary, results[1].summary) : null

  return (
    <section className="mt-8">
      <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
        Reservas recurrentes
      </p>
      <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
        <p className="mb-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          Aplicar reservas recurrentes
        </p>
        <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
          Asigna las recurrencias de los alumnos a las sesiones del mes actual y el siguiente.
          Seguro de re-ejecutar — omite reservas ya existentes.
        </p>

        <button
          onClick={handleApply}
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          {loading ? 'Procesando…' : 'Aplicar reservas recurrentes'}
        </button>

        {error && (
          <p className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
            Error: {error}
          </p>
        )}

        {combined && results && (
          <div className="mt-3 space-y-3">
            {/* Totales combinados */}
            <div className="rounded-xl px-3 py-3 text-xs space-y-1" style={{ background: '#F0FDF4', color: 'var(--ink)' }}>
              <p className="font-medium" style={{ color: 'var(--sage)' }}>
                Completado — {results[0].label} + {results[1].label}
              </p>
              <p>Sesiones generadas: <strong>{combined.sessionsGenerated}</strong></p>
              <p>Reservas con crédito: <strong>{combined.bookingsCredit}</strong></p>
              <p>Reservas en gracia: <strong>{combined.bookingsGrace}</strong></p>
              <p>Ya reservadas (omitidas): <strong>{combined.skippedAlreadyBooked}</strong></p>
              <p>Clase llena (omitidas): <strong>{combined.skippedFull}</strong></p>
              {combined.alertUserIds.length > 0 && (
                <p style={{ color: '#B91C1C' }}>
                  Sin cobertura: {combined.alertUserIds.length} alumno/s
                </p>
              )}
            </div>

            {/* Detalle por mes */}
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => (
                <div key={r.label} className="rounded-xl px-3 py-2 text-xs" style={{ background: '#F7F3EE' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--ink)' }}>{r.label}</p>
                  <p style={{ color: 'var(--stone)' }}>Crédito: <strong>{r.summary.bookingsCredit}</strong></p>
                  <p style={{ color: 'var(--stone)' }}>Gracia: <strong>{r.summary.bookingsGrace}</strong></p>
                  <p style={{ color: 'var(--stone)' }}>Omitidas: <strong>{r.summary.skippedAlreadyBooked}</strong></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
