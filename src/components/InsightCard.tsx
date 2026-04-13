'use client'

import { useState } from 'react'
import type { InsightType } from '@/services/insights.service'

interface InsightCardProps {
  studio: string
  type: InsightType
  title: string
  description: string
}

interface InsightData {
  content: string
  cachedAt: string
  fromCache: boolean
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 2) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH === 1) return 'hace 1 hora'
  return `hace ${diffH} horas`
}

export function InsightCard({ studio, type, title, description }: InsightCardProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<InsightData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [insufficientData, setInsufficientData] = useState(false)

  async function generate() {
    setLoading(true)
    setError(null)
    setUpgradeRequired(false)
    setInsufficientData(false)
    try {
      const res = await fetch(`/api/${studio}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string; upgradeRequired?: boolean }
        if (body.upgradeRequired) {
          setUpgradeRequired(true)
          return
        }
        const msg = body.error ?? 'Error al generar el análisis.'
        if (msg.includes('Necesitás al menos')) {
          setError(msg)
          setInsufficientData(true)
          return
        }
        setError(msg)
        return
      }
      const result = (await res.json()) as InsightData
      setData(result)
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'white', border: '1px solid #E8E0D6' }}
    >
      {/* Header */}
      <div className="mb-3">
        <h3
          className="text-lg font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          {title}
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>
          {description}
        </p>
      </div>

      {/* Estado: upgrade requerido */}
      {upgradeRequired && (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: '#FFF8F0', border: '1px solid var(--terracotta)' }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
            Función del plan Pro
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--stone)' }}>
            Los análisis de IA están disponibles en el plan Pro o durante el período de prueba.
            Contactá a Flexa para activar tu prueba gratuita de 30 días.
          </p>
          <button
            onClick={generate}
            className="text-xs underline"
            style={{ color: 'var(--stone)' }}
          >
            Verificar nuevamente
          </button>
        </div>
      )}

      {/* Estado: datos insuficientes */}
      {insufficientData && !loading && (
        <div
          className="rounded-xl p-4"
          style={{ background: '#FFF8F0', border: '1px solid #E8E0D6' }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--ink)' }}>
            Datos insuficientes
          </p>
          <p className="text-xs" style={{ color: 'var(--stone)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Estado: sin datos */}
      {!data && !loading && !error && !upgradeRequired && (
        <button
          onClick={generate}
          className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85"
          style={{ background: 'var(--sage)' }}
        >
          Generar análisis
        </button>
      )}

      {/* Estado: cargando */}
      {loading && (
        <div className="text-center py-4">
          <p className="text-sm font-medium" style={{ color: 'var(--sage)' }}>
            Generando...
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--stone)' }}>
            Esto puede tardar unos segundos.
          </p>
        </div>
      )}

      {/* Estado: error */}
      {error && !loading && !insufficientData && (
        <div className="space-y-3">
          <p className="text-xs text-center" style={{ color: 'var(--terracotta)' }}>
            {error}
          </p>
          <button
            onClick={generate}
            className="w-full rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)', border: '1px solid var(--terracotta)' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Estado: con datos */}
      {data && !loading && (
        <div>
          {/* Metadata */}
          <p className="mb-3 text-xs" style={{ color: 'var(--stone)' }}>
            Actualizado {timeAgo(data.cachedAt)}
            {data.fromCache ? ' · desde caché' : ' · nuevo análisis'}
          </p>

          {/* Contenido de Claude — texto plano, sin dangerouslySetInnerHTML */}
          <p
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{ color: 'var(--ink)' }}
          >
            {data.content}
          </p>

          {/* Botón actualizar */}
          <button
            onClick={generate}
            className="mt-4 w-full rounded-xl py-2 text-xs font-medium transition-opacity hover:opacity-85"
            style={{ background: '#F0EDEB', color: 'var(--stone)' }}
          >
            Actualizar análisis
          </button>
        </div>
      )}
    </div>
  )
}
