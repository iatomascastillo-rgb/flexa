'use client'

import { useState } from 'react'

const STEPS = [
  {
    number: '01',
    title: 'Configurás tu estudio',
    body: 'Cargás tus tipos de clase, horarios, cupos, precios y políticas. Elegís los colores y el nombre que van a ver tus alumnas. En minutos, sin ayuda técnica.',
    visual: (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#F7F3EE', border: '1px solid #E8E0D6' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E8E0D6' }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#9E8E82' }}>Tipos de clase</p>
          {['Reformer · 8 cupos · $4.500', 'Pilates Mat · 12 cupos · $3.000', 'Duet · 2 cupos · $7.000'].map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 mb-2" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
              <p className="text-xs" style={{ color: '#2C2C2C' }}>{c}</p>
              <span className="text-xs" style={{ color: '#5C7A5E' }}>✓</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#9E8E82' }}>Política de gracia</p>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
            <div className="h-2 flex-1 rounded-full" style={{ background: '#E8E0D6' }}>
              <div className="h-full w-1/3 rounded-full" style={{ background: '#5C7A5E' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: '#2C2C2C' }}>5 días</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '02',
    title: 'Tus alumnas reservan solas',
    body: 'Desde el celular, a cualquier hora. Eligen la clase, confirman su lugar y pagan con MercadoPago. Vos ves todo en tiempo real, sin un solo mensaje de WhatsApp.',
    visual: (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#F7F3EE', border: '1px solid #E8E0D6' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #E8E0D6' }}>
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: '#9E8E82' }}>Clases disponibles · Martes</p>
          {[
            { name: 'Reformer', time: '09:00', spots: '2 lugares', status: 'libre' },
            { name: 'Pilates Mat', time: '10:30', spots: '5 lugares', status: 'libre' },
            { name: 'Reformer', time: '18:00', spots: 'Llena', status: 'espera' },
          ].map((c, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2.5 mb-2" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
              <div>
                <p className="text-xs font-medium" style={{ color: '#2C2C2C' }}>{c.name} · {c.time}</p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: c.status === 'espera' ? '#F5E8DE' : '#EDF4ED',
                  color: c.status === 'espera' ? '#C4774A' : '#5C7A5E',
                }}
              >
                {c.spots}
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3">
          <div className="rounded-xl px-4 py-3 text-center text-xs font-medium text-white" style={{ background: '#5C7A5E' }}>
            Reservar Reformer · 09:00 →
          </div>
        </div>
      </div>
    ),
  },
  {
    number: '03',
    title: 'Analizás y crecés',
    body: 'Cada mes recibís un análisis automático de tu estudio: quién está activa, qué alumnas se están alejando, cuánto facturaste y qué podés mejorar. En palabras simples, sin planillas.',
    visual: (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#2C2C2C', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>Marzo 2025</p>
            <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: 'rgba(155,109,255,0.2)', color: '#9B6DFF' }}>Análisis listo</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Ingresos</p>
              <p className="text-xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>$52.000</p>
            </div>
            <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Activas</p>
              <p className="text-xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>10</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(155,109,255,0.12)', border: '1px solid rgba(155,109,255,0.25)' }}>
            <p className="text-xs mb-1" style={{ color: '#9B6DFF' }}>✦ Recomendación</p>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              4 alumnas no reservaron en 2 semanas. Contactarlas esta semana puede reactivar al menos la mitad.
            </p>
          </div>
        </div>
      </div>
    ),
  },
]

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const step = STEPS[active]!

  return (
    <div className="flex flex-col gap-10 md:flex-row md:gap-16">
      {/* Left: step tabs */}
      <div className="md:w-5/12">
        {STEPS.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="w-full text-left mb-3 rounded-2xl px-6 py-5 transition-all"
            style={{
              background: active === i ? 'var(--sage)' : 'white',
              border: `1px solid ${active === i ? 'var(--sage)' : '#E8E0D6'}`,
            }}
          >
            <div className="flex items-center gap-4">
              <span
                className="text-2xl font-light shrink-0"
                style={{
                  fontFamily: 'var(--font-cormorant, serif)',
                  color: active === i ? 'rgba(255,255,255,0.5)' : 'var(--stone)',
                }}
              >
                {s.number}
              </span>
              <div>
                <p
                  className="text-sm font-medium leading-snug"
                  style={{ color: active === i ? 'white' : 'var(--ink)' }}
                >
                  {s.title}
                </p>
                {active === i && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {s.body}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Right: visual */}
      <div className="md:w-7/12">
        {step.visual}
      </div>
    </div>
  )
}
