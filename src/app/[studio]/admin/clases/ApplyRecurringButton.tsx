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

export function ApplyRecurringButton({ studioId }: { studioId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; month: string; summary: Summary } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleApply() {
    setLoading(true)
    setResult(null)
    setError(null)

    // Mes actual en AR (UTC-3)
    const now = new Date()
    const arNow = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const year = arNow.getUTCFullYear()
    const month = arNow.getUTCMonth() // 0-indexed
    const fromDate = arNow.toISOString().slice(0, 10)

    try {
      const res = await fetch('/api/cron/test-recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, year, month, fromDate, dryRun: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error desconocido')
      } else {
        setResult(data)
      }
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8">
      <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
        Reservas recurrentes
      </p>
      <div className="rounded-2xl p-4" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
        <p className="mb-1 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          Aplicar reservas del mes actual
        </p>
        <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
          Asigna automáticamente las recurrencias de los alumnos a las sesiones de este mes desde hoy en adelante.
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

        {result && (
          <div className="mt-3 rounded-xl px-3 py-3 text-xs space-y-1" style={{ background: '#F0FDF4', color: 'var(--ink)' }}>
            <p className="font-medium" style={{ color: 'var(--sage)' }}>Completado — {result.month}</p>
            <p>Sesiones generadas: <strong>{result.summary.sessionsGenerated}</strong></p>
            <p>Reservas con crédito: <strong>{result.summary.bookingsCredit}</strong></p>
            <p>Reservas en gracia: <strong>{result.summary.bookingsGrace}</strong></p>
            <p>Ya reservadas (omitidas): <strong>{result.summary.skippedAlreadyBooked}</strong></p>
            <p>Clase llena (omitidas): <strong>{result.summary.skippedFull}</strong></p>
            {result.summary.alertUserIds.length > 0 && (
              <p style={{ color: '#B91C1C' }}>
                Sin cobertura: {result.summary.alertUserIds.length} alumno/s
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
