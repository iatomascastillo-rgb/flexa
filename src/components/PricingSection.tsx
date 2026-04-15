'use client'

import Link from 'next/link'
import { useState } from 'react'

const BASIC_FEATURES = [
  'Reservas y cancelaciones online',
  'Panel de alumnos con créditos',
  'Pagos con MercadoPago',
  'Lista de espera automática',
  'Branding personalizado',
  'Días de acceso sin crédito (configurable)',
  'Notificaciones automáticas por email',
  'Resumen mensual automático',
  'Análisis IA (prueba de 30 días)',
  'Soporte de equipo todo el día',
]

const PRO_EXTRA_FEATURES = [
  'Análisis inteligente con IA de última generación',
  'Detección de alumnas que se alejan',
  'Optimización de agenda con IA',
  'Alertas en tiempo real: ausencias y paquetes vencidos',
  'Recurrencia semanal automática',
  'Soporte prioritario',
]

const fmt = (n: number) => n.toLocaleString('es-AR')

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true)

  return (
    <section id="precios" className="py-20" style={{ background: 'var(--cream)' }}>
      <div className="mx-auto max-w-5xl px-5">
        <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
          Precios
        </p>
        <h2
          className="mb-4 text-center text-3xl font-light leading-tight md:text-5xl"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)', textWrap: 'balance' } as React.CSSProperties}
        >
          Inversión inteligente para tu negocio
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-center text-sm leading-relaxed md:max-w-md md:text-base" style={{ color: 'var(--stone)' }}>
          Automatizá tus reservas hoy. 30 días gratis sin compromiso, con beneficios exclusivos de lanzamiento.
        </p>

        {/* Toggle mensual / anual */}
        <div className="mb-10 flex items-center justify-center gap-3">
          <span className="text-sm font-medium" style={{ color: isAnnual ? 'var(--stone)' : 'var(--ink)' }}>
            Mensual
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative h-7 w-12 rounded-full transition-colors"
            style={{ background: isAnnual ? 'var(--sage)' : '#D1C9C0' }}
            aria-label="Cambiar período de facturación"
          >
            <span
              className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: isAnnual ? 'translateX(20px)' : 'translateX(0)' }}
            />
          </button>
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: isAnnual ? 'var(--ink)' : 'var(--stone)' }}>
            Anual
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity"
              style={{
                background: '#DCFCE7',
                color: '#166534',
                opacity: isAnnual ? 1 : 0.5,
              }}
            >
              50% OFF
            </span>
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:max-w-2xl md:mx-auto">

          {/* ── Plan Básico ── */}
          <div className="rounded-2xl p-7" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
            <p className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Básico</p>

            {isAnnual ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
                    ${fmt(12000)}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#DCFCE7', color: '#166534' }}>
                    50% OFF
                  </span>
                </div>
                <p className="text-sm line-through" style={{ color: 'var(--stone)', opacity: 0.6 }}>
                  ${fmt(24000)}/mes
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>ARS / mes</p>
                <div
                  className="mt-3 mb-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: 'rgba(92,122,94,0.1)', color: 'var(--sage)', border: '1px solid rgba(92,122,94,0.2)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Pago único anual de <strong>${fmt(144000)}</strong>
                </div>
              </>
            ) : (
              <>
                <span className="text-5xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
                  ${fmt(24000)}
                </span>
                <p className="mb-6 mt-1 text-xs" style={{ color: 'var(--stone)' }}>ARS / mes</p>
              </>
            )}

            <ul className="mb-6 space-y-2">
              {BASIC_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--stone)' }}>
                  <span style={{ color: 'var(--sage)', flexShrink: 0, marginTop: '2px' }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              href="/registro"
              className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              Empezar gratis
            </Link>
          </div>

          {/* ── Plan Pro ── */}
          <div className="rounded-2xl p-7" style={{ background: 'var(--ink)', border: '1px solid var(--ink)' }}>
            <div className="mb-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-white/60">Pro</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: '#9B6DFF', color: 'white' }}>
                  Con análisis IA
                </span>
                {isAnnual && (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: '#F59E0B', color: '#1C1400' }}>
                    OFERTA DE LANZAMIENTO
                  </span>
                )}
              </div>
            </div>

            {isAnnual ? (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
                    ${fmt(22000)}
                  </span>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    50% OFF
                  </span>
                </div>
                <p className="text-sm line-through text-white/40">
                  ${fmt(44000)}/mes
                </p>
                <p className="mt-0.5 text-xs text-white/50">ARS / mes</p>
                <div
                  className="mt-3 mb-6 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{ background: 'rgba(155,109,255,0.15)', color: 'rgba(155,109,255,0.9)', border: '1px solid rgba(155,109,255,0.3)' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  Pago único anual de <strong>${fmt(264000)}</strong>
                </div>
              </>
            ) : (
              <>
                <span className="text-5xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
                  ${fmt(44000)}
                </span>
                <p className="mb-6 mt-1 text-xs text-white/50">ARS / mes</p>
              </>
            )}

            <ul className="mb-6 space-y-2">
              <li className="flex items-start gap-2 text-sm font-medium text-white/60">
                <span style={{ flexShrink: 0, marginTop: '2px' }}>+</span>Todo lo del plan Básico
              </li>
              {PRO_EXTRA_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                  <span style={{ color: 'var(--sage-light)', flexShrink: 0, marginTop: '2px' }}>✓</span>{f}
                </li>
              ))}
            </ul>

            {isAnnual && (
              <div
                className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: 'rgba(155,109,255,0.15)', border: '1px solid rgba(155,109,255,0.3)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9B6DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-xs" style={{ color: 'rgba(155,109,255,0.9)' }}>Precio congelado por 12 meses</span>
              </div>
            )}

            <Link
              href="/registro"
              className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              {isAnnual ? 'Asegurar mi lugar de fundador' : 'Empezar gratis'}
            </Link>
          </div>

        </div>
      </div>
    </section>
  )
}
