'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FinancialDashboard } from '@/services/financial.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtARS(n: number): string {
  return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function trendIcon(t: 'up' | 'down' | 'stable') {
  if (t === 'up') return '↑'
  if (t === 'down') return '↓'
  return '→'
}

function trendColor(t: 'up' | 'down' | 'stable') {
  if (t === 'up') return 'var(--sage)'
  if (t === 'down') return '#d97706'
  return 'var(--stone)'
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl px-5 py-4 ${className ?? ''}`}
      style={{ background: 'white', border: '1px solid #E8E0D6' }}
    >
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
      {children}
    </p>
  )
}

function NoCostsAlert({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{ background: '#FEF9C3', border: '1px solid #FDE047' }}
    >
      <span className="mt-0.5 text-base">⚠️</span>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: '#713F12' }}>
          Costos del mes no cargados
        </p>
        <p className="text-xs" style={{ color: '#854D0E' }}>
          Para ver si ganaste o perdiste este mes y qué te deja cada tipo de clase, primero cargá tus costos fijos.
        </p>
      </div>
      <button
        onClick={onOpen}
        className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium"
        style={{ background: '#EAB308', color: 'white' }}
      >
        Cargar
      </button>
    </div>
  )
}

// ─── Tutorial ─────────────────────────────────────────────────────────────────

function TutorialSection() {
  const metrics = [
    {
      icon: '💰',
      title: 'Plata ya cobrada',
      body: 'Dinero que ya entraste por paquetes, pero las clases todavía no se dieron. Si una alumna tiene 5 clases sin usar, el valor de esas clases aparece acá.',
    },
    {
      icon: '⚠️',
      title: 'Plata que podés perder',
      body: 'Alumnas con paquetes que vencen pronto o que llevan semanas sin reservar. Si no las recuperás, ese dinero potencial se va. Sirve para saber a quién contactar hoy.',
    },
    {
      icon: '📊',
      title: '¿Ganaste o perdiste este mes?',
      body: 'Compara lo que entraste este mes vs. lo que gastaste (alquiler, instructores, otros). Para verlo, necesitás cargar tus costos fijos del mes.',
    },
    {
      icon: '📈',
      title: 'Valor promedio por alumna',
      body: 'Cuánto pagó en promedio cada alumna a lo largo de toda su historia en el estudio. Cuanto más alto, mejor. También muestra qué porcentaje de alumnas renovó paquete.',
    },
    {
      icon: '🔮',
      title: '¿Cuánto vas a cobrar?',
      body: 'Proyección de los próximos 3 meses basada en la tasa de renovación histórica de tu estudio. Es una estimación — no incluye alumnas nuevas ni promociones.',
    },
    {
      icon: '📋',
      title: 'Qué te deja cada tipo de clase',
      body: 'Cuánto ingresó por cada tipo de clase (Reformer, Mat, Duet, etc.) vs. lo que costó darla. Necesitás tener cargados los costos del mes para ver este dato.',
    },
  ]

  return (
    <details className="group mb-5">
      <summary
        className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium"
        style={{ background: '#F0F9F4', border: '1px solid #BBF7D0', color: 'var(--sage)' }}
      >
        <span className="flex items-center gap-2">
          <span>💡</span>
          <span>¿Qué significa cada número?</span>
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform group-open:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="mt-2 space-y-2">
        {metrics.map((item) => (
          <div
            key={item.title}
            className="rounded-xl px-4 py-3"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            <p className="mb-0.5 text-xs font-semibold" style={{ color: 'var(--ink)' }}>
              {item.icon} {item.title}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
              {item.body}
            </p>
          </div>
        ))}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: '#FEF9C3', border: '1px solid #FDE047' }}
        >
          <p className="mb-1 text-xs font-semibold" style={{ color: '#713F12' }}>
            📝 ¿Qué costos cargar?
          </p>
          <p className="text-xs leading-relaxed" style={{ color: '#854D0E' }}>
            <strong>Alquiler:</strong> Lo que pagás por el local cada mes.{' '}
            <strong>Instructores:</strong> El total pagado a todos tus instructores (incluí impuestos si los hay).{' '}
            <strong>Otros:</strong> Luz, internet, materiales, seguros, contador — todo lo fijo que pagás igual todos los meses, sin importar cuántas clases des.
          </p>
        </div>
      </div>
    </details>
  )
}

// ─── Modal de costos fijos ────────────────────────────────────────────────────

interface CostsModalProps {
  studio: string
  initialCosts: { rentCost: number; staffCost: number; otherCosts: number; notes: string } | null
  onClose: () => void
  onSaved: () => void
}

function CostsModal({ studio, initialCosts, onClose, onSaved }: CostsModalProps) {
  const now = new Date()
  const [rentCost,   setRentCost]   = useState(initialCosts?.rentCost   ?? 0)
  const [staffCost,  setStaffCost]  = useState(initialCosts?.staffCost  ?? 0)
  const [otherCosts, setOtherCosts] = useState(initialCosts?.otherCosts ?? 0)
  const [notes,      setNotes]      = useState(initialCosts?.notes      ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/${studio}/financial/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month:      now.getMonth() + 1,
          year:       now.getFullYear(),
          rentCost,
          staffCost,
          otherCosts,
          notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Error al guardar')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl px-6 pb-10 pt-6"
        style={{ background: 'var(--cream, #F7F3EE)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
              Costos fijos del mes
            </h2>
            <p className="text-xs capitalize" style={{ color: 'var(--stone)' }}>{monthName}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--stone)' }}>×</button>
        </div>

        <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
          Solo los costos fijos — los que pagás todos los meses independientemente de cuántas clases des.
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          {[
            {
              label: 'Alquiler del local',
              hint: 'Lo que pagás por el espacio cada mes',
              value: rentCost,
              setter: setRentCost,
            },
            {
              label: 'Instructores y personal',
              hint: 'Sueldo total + impuestos de todos',
              value: staffCost,
              setter: setStaffCost,
            },
            {
              label: 'Otros costos fijos',
              hint: 'Luz, internet, seguros, contador, materiales',
              value: otherCosts,
              setter: setOtherCosts,
            },
          ].map(({ label, hint, value, setter }) => (
            <div key={label}>
              <label className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--ink)' }}>
                {label}
              </label>
              <p className="mb-1 text-xs" style={{ color: 'var(--stone)' }}>{hint}</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--stone)' }}>$</span>
                <input
                  type="number"
                  min={0}
                  max={999999999}
                  value={value}
                  onChange={(e) => setter(Math.max(0, Number(e.target.value)))}
                  className="flex-1 rounded-xl border px-3 py-2.5 text-sm"
                  style={{ borderColor: '#E8E0D6', background: 'white' }}
                  placeholder="0"
                />
              </div>
            </div>
          ))}

          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--stone)' }}>
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: '#E8E0D6', background: 'white', resize: 'none' }}
              placeholder="Ej: mes con feriados, instructor nuevo..."
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: '#dc2626' }}>{error}</p>
          )}

          <div
            className="rounded-xl px-4 py-2.5 text-center"
            style={{ background: '#F0F9F4', border: '1px solid #BBF7D0' }}
          >
            <span className="text-xs" style={{ color: 'var(--stone)' }}>Total costos fijos del mes: </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {fmtARS(rentCost + staffCost + otherCosts)}
            </span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl py-3 text-sm font-medium"
            style={{ background: 'var(--sage)', color: 'white', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Guardando...' : 'Guardar costos'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface FinancialTabProps {
  studio: string
}

export function FinancialTab({ studio }: FinancialTabProps) {
  const [data, setData]         = useState<FinancialDashboard | null>(null)
  const [loading, setLoading]   = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [showCostsModal, setShowCostsModal]   = useState(false)
  const [costsData, setCostsData] = useState<{
    rentCost: number; staffCost: number; otherCosts: number; notes: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${studio}/financial`)
      if (res.status === 403) {
        const json = await res.json().catch(() => ({}))
        if ((json as { upgradeRequired?: boolean }).upgradeRequired) {
          setUpgradeRequired(true)
          return
        }
      }
      if (!res.ok) throw new Error()
      const json = await res.json()
      setData(json as FinancialDashboard)
    } catch {
      // loading=false sin data muestra error genérico
    } finally {
      setLoading(false)
    }
  }, [studio])

  const fetchCosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/${studio}/financial/costs`)
      if (!res.ok) return
      const { costs } = await res.json()
      if (costs) {
        setCostsData({
          rentCost:   costs.rentCost   / 100,
          staffCost:  costs.staffCost  / 100,
          otherCosts: costs.otherCosts / 100,
          notes:      costs.notes ?? '',
        })
      }
    } catch {
      // no-op
    }
  }, [studio])

  useEffect(() => {
    fetchData()
    fetchCosts()
  }, [fetchData, fetchCosts])

  // ── Upgrade CTA ─────────────────────────────────────────────────────────────
  if (upgradeRequired) {
    return (
      <div
        className="rounded-2xl px-6 py-10 text-center"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <div className="mb-4 text-4xl">💰</div>
        <p className="mb-1 text-lg font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
          Panel financiero
        </p>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--sage)' }}>
          Plan Pro
        </p>
        <p className="mb-2 text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>
          Sabé cuánto dinero ya tenés cobrado, cuánto estás en riesgo de perder y cuánto vas a cobrar el mes que viene.
        </p>
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {['Plata ya cobrada', 'Alumnas en riesgo', 'Resultado del mes', 'Proyección 90 días', 'Margen por clase'].map((f) => (
            <span
              key={f}
              className="rounded-full px-2.5 py-1 text-xs"
              style={{ background: '#F0F9F4', color: 'var(--sage)', border: '1px solid #BBF7D0' }}
            >
              {f}
            </span>
          ))}
        </div>
        <a
          href="mailto:hola@flexa.app?subject=Quiero el plan Pro"
          className="inline-block rounded-2xl px-6 py-3 text-sm font-medium"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          Actualizar al plan Pro
        </a>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[72, 72, 110, 72].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-2xl"
            style={{ background: '#F0EDE8', height: `${h}px` }}
          />
        ))}
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <Card>
        <p className="py-4 text-center text-sm" style={{ color: 'var(--stone)' }}>
          No se pudieron cargar los datos. Recargá la página.
        </p>
      </Card>
    )
  }

  const { breakEven, committedRevenue, revenueAtRisk, classMargin, ltv, cashFlow } = data
  const costsEntered = breakEven.costsEntered

  const maxCashFlow = Math.max(
    cashFlow.currentMonth.guaranteed,
    cashFlow.nextMonth.projected,
    cashFlow.twoMonths.projected,
    1,
  )

  return (
    <>
      {/* Modal de costos */}
      {showCostsModal && (
        <CostsModal
          studio={studio}
          initialCosts={costsData}
          onClose={() => setShowCostsModal(false)}
          onSaved={() => { fetchData(); fetchCosts() }}
        />
      )}

      {/* Tutorial — collapsible */}
      <TutorialSection />

      {/* Banner: costos no cargados */}
      {!costsEntered && <NoCostsAlert onOpen={() => setShowCostsModal(true)} />}

      {/* ── Fila 1: Plata ya cobrada + Podés perder ── */}
      <SectionLabel>Tu situación hoy</SectionLabel>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Card>
          <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>
            💰 Plata ya cobrada
          </p>
          <p className="mb-2 text-xs" style={{ color: 'var(--stone)', opacity: 0.65 }}>
            Clases pagas, aún no dadas
          </p>
          <p className="text-xl font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {fmtARS(committedRevenue.total)}
          </p>
          {committedRevenue.vsLastMonthPct !== null && (
            <p
              className="mt-1 text-xs"
              style={{ color: committedRevenue.vsLastMonthPct >= 0 ? 'var(--sage)' : '#d97706' }}
            >
              {committedRevenue.vsLastMonthPct >= 0 ? '+' : ''}{committedRevenue.vsLastMonthPct}% vs mes ant.
            </p>
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
            {committedRevenue.packagesCount} paquetes · {committedRevenue.avgCreditsRemaining} clases prom.
          </p>
        </Card>

        <Card>
          <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>
            ⚠️ Podés perder
          </p>
          <p className="mb-2 text-xs" style={{ color: 'var(--stone)', opacity: 0.65 }}>
            Alumnas que se están yendo
          </p>
          <p className="text-xl font-semibold leading-tight" style={{ color: revenueAtRisk.totalAtRisk > 0 ? '#d97706' : 'var(--ink)' }}>
            {fmtARS(revenueAtRisk.totalAtRisk)}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
            {revenueAtRisk.studentsAtRisk.length}{' '}
            {revenueAtRisk.studentsAtRisk.length === 1 ? 'alumna' : 'alumnas'}
          </p>
          {revenueAtRisk.studentsAtRisk.length > 0 && (
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--stone)' }}>
              {revenueAtRisk.studentsAtRisk.slice(0, 2).map(s => s.name.split(' ')[0]).join(', ')}
              {revenueAtRisk.studentsAtRisk.length > 2 ? ` +${revenueAtRisk.studentsAtRisk.length - 2}` : ''}
            </p>
          )}
        </Card>
      </div>

      {/* ── Alumnas en riesgo — lista expandible ── */}
      {revenueAtRisk.studentsAtRisk.length > 0 && (
        <div className="mb-3">
          <details className="group">
            <summary
              className="cursor-pointer list-none rounded-xl px-4 py-2 text-xs font-medium"
              style={{ background: '#FEF3C7', color: '#92400E' }}
            >
              Ver alumnas que se están alejando ({revenueAtRisk.studentsAtRisk.length})
            </summary>
            <div className="mt-2 space-y-2">
              {revenueAtRisk.studentsAtRisk.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{ background: 'white', border: '1px solid #E8E0D6' }}
                >
                  <div>
                    <p className="text-sm" style={{ color: 'var(--ink)' }}>{s.name}</p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>
                      {s.reason === 'expiring_package' ? 'Paquete vence pronto' : 'No reserva hace semanas'}
                    </p>
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {fmtARS(s.estimatedValue)}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── Alumnas que ya se fueron (informativo) ── */}
      {revenueAtRisk.studentsLost.length > 0 && (
        <div className="mb-5">
          <details className="group">
            <summary
              className="cursor-pointer list-none rounded-xl px-4 py-2 text-xs font-medium"
              style={{ background: '#F3F4F6', color: '#6B7280' }}
            >
              Alumnas que dejaron de venir ({revenueAtRisk.studentsLost.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              <p className="px-1 text-xs" style={{ color: 'var(--stone)' }}>
                Llevan entre 45 y 90 días sin reservar. Ya no aparecen en "podés perder" — se fueron antes.
              </p>
              {revenueAtRisk.studentsLost.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between rounded-xl px-4 py-2"
                  style={{ background: 'white', border: '1px solid #E8E0D6' }}
                >
                  <p className="text-sm" style={{ color: 'var(--stone)' }}>{s.name}</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    {s.daysSinceLastBooking} días sin reservar
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── Fila 2: Resultado del mes + Valor por alumna ── */}
      <SectionLabel>Rentabilidad</SectionLabel>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: 'var(--stone)' }}>📊 Resultado del mes</p>
            <button
              onClick={() => setShowCostsModal(true)}
              className="text-xs underline"
              style={{ color: 'var(--sage)' }}
            >
              {costsEntered ? 'Editar' : 'Cargar costos'}
            </button>
          </div>
          {costsEntered ? (
            <>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                Ingresaste: {fmtARS(breakEven.revenue)}
              </p>
              <p className="text-xs" style={{ color: 'var(--stone)' }}>
                Gastaste: {fmtARS(breakEven.totalCosts)}
              </p>
              <p
                className="mt-2 text-base font-semibold"
                style={{ color: breakEven.result >= 0 ? 'var(--sage)' : '#dc2626' }}
              >
                {breakEven.result >= 0 ? 'Ganaste ' : 'Perdiste '}{fmtARS(Math.abs(breakEven.result))}
              </p>
              {breakEven.breakEvenClasses !== null && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>
                  Necesitabas {breakEven.breakEvenClasses} clases para cubrir costos
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
              Cargá los costos del mes para ver si ganaste o perdiste.
            </p>
          )}
        </Card>

        <Card>
          <p className="mb-0.5 text-xs font-medium" style={{ color: 'var(--stone)' }}>📈 Valor por alumna</p>
          <p className="mb-2 text-xs" style={{ color: 'var(--stone)', opacity: 0.65 }}>
            Últimos 12 meses
          </p>
          <p className="text-xl font-semibold leading-tight" style={{ color: 'var(--ink)' }}>
            {fmtARS(ltv.ltv)}
          </p>
          <p className="mt-1 text-xs" style={{ color: trendColor(ltv.ltvTrend) }}>
            {trendIcon(ltv.ltvTrend)} tendencia
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--stone)' }}>
            Renuevan: {ltv.renewalRate}%{' '}
            <span style={{ color: trendColor(ltv.renewalTrend) }}>
              {trendIcon(ltv.renewalTrend)}
            </span>
            {ltv.sampleSize !== undefined && (
              <span style={{ opacity: 0.6 }}> · {ltv.sampleSize} alumnas</span>
            )}
          </p>
        </Card>
      </div>

      {/* ── Proyección ── */}
      <SectionLabel>¿Cuánto vas a cobrar?</SectionLabel>
      <Card className="mb-5">
        <div className="space-y-3">
          {[
            { label: monthLabel(cashFlow.currentMonth.month), amount: cashFlow.currentMonth.guaranteed, tag: 'ya cobrado' },
            { label: monthLabel(cashFlow.nextMonth.month),    amount: cashFlow.nextMonth.projected,    tag: 'proyectado' },
            { label: monthLabel(cashFlow.twoMonths.month),    amount: cashFlow.twoMonths.projected,    tag: 'proyectado' },
          ].map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs capitalize" style={{ color: 'var(--ink)' }}>{row.label}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-xs"
                    style={{
                      background: row.tag === 'ya cobrado' ? '#F0F9F4' : '#F7F3EE',
                      color: row.tag === 'ya cobrado' ? 'var(--sage)' : 'var(--stone)',
                    }}
                  >
                    {row.tag}
                  </span>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                  {fmtARS(row.amount)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ background: '#F0EDE8' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((row.amount / maxCashFlow) * 100)}%`,
                    background: row.tag === 'ya cobrado' ? 'var(--sage)' : '#D1C5B8',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs" style={{ color: 'var(--stone)' }}>
          Proyectado según el {ltv.renewalRate}% de renovación histórico del estudio. No incluye alumnas nuevas.
        </p>
      </Card>

      {/* ── Qué te deja cada clase ── */}
      <SectionLabel>Qué te deja cada tipo de clase</SectionLabel>
      {!classMargin.costsEntered ? (
        <Card className="mb-5">
          <p className="py-2 text-center text-sm" style={{ color: 'var(--stone)' }}>
            Cargá los costos del mes para ver el resultado por tipo de clase.
          </p>
        </Card>
      ) : (
        <div className="mb-5 space-y-2">
          {classMargin.byClassType.map((ct) => (
            <Card key={ct.classTypeId}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{ct.name}</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>
                    {ct.sessionCount} clases · {fmtARS(ct.revenuePerSession)} por clase
                  </p>
                </div>
                {ct.marginPerSession !== null && (
                  <div className="text-right">
                    <p
                      className="text-base font-semibold"
                      style={{ color: ct.marginPerSession >= 0 ? 'var(--sage)' : '#dc2626' }}
                    >
                      {ct.marginPerSession >= 0 ? '+' : ''}{fmtARS(ct.marginPerSession)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>por clase</p>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {classMargin.topSlots.length > 0 && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: '#F0F9F4', border: '1px solid #BBF7D0' }}
            >
              <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--sage)' }}>
                ✓ Horarios más rentables
              </p>
              {classMargin.topSlots.map((s) => (
                <p key={s.label} className="text-xs" style={{ color: 'var(--ink)' }}>
                  {s.label} — {fmtARS(s.margin)}/clase
                </p>
              ))}
            </div>
          )}

          {classMargin.bottomSlots.length > 0 && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: '#FEF9C3', border: '1px solid #FDE047' }}
            >
              <p className="mb-1.5 text-xs font-medium" style={{ color: '#854D0E' }}>
                ↓ Horarios menos rentables
              </p>
              {classMargin.bottomSlots.map((s) => (
                <p key={s.label} className="text-xs" style={{ color: 'var(--ink)' }}>
                  {s.label} — {fmtARS(s.margin)}/clase
                </p>
              ))}
            </div>
          )}

          <p className="px-1 text-xs" style={{ color: 'var(--stone)', opacity: 0.7 }}>
            El costo por clase se calcula dividiendo el total de instructores en partes iguales entre todas las sesiones del mes. Si tus instructores cobran diferente según el tipo de clase, este número es una aproximación.
          </p>
        </div>
      )}

      {/* Botón editar costos al pie */}
      <button
        onClick={() => setShowCostsModal(true)}
        className="w-full rounded-2xl border py-3 text-sm transition-colors hover:bg-white/50"
        style={{ borderColor: '#E8E0D6', color: 'var(--stone)' }}
      >
        {costsEntered ? '✎  Editar costos fijos del mes' : '+  Cargar costos fijos del mes'}
      </button>
    </>
  )
}
