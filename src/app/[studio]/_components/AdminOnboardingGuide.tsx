'use client'

import { useState, useEffect } from 'react'

interface Step {
  title: string
  description: string
  icon: React.ReactNode
  tip?: string
}

const STEPS: Step[] = [
  {
    title: 'Bienvenida al panel',
    description: 'En unos pasos te mostramos cómo configurar tu estudio y empezar a gestionar tus clases y alumnas.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    title: 'Tipos de clase',
    description: 'Empezá creando las modalidades que ofrecés: Reformer, Mat, Duet, etc. Cada tipo tiene nombre, nivel y capacidad máxima por sesión.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    tip: 'Podés crear todos los tipos que necesites. Después cada tipo tendrá su propio horario semanal.',
  },
  {
    title: 'Horarios',
    description: 'Asigná un horario semanal a cada tipo de clase. El sistema genera automáticamente las sesiones del mes — no necesitás crearlas a mano.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: 'Paquetes',
    description: 'Creá los paquetes que venderás a tus alumnas: cantidad de clases y precio en pesos. Podés tener varios paquetes activos al mismo tiempo.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" x2="12" y1="22.08" y2="12" />
      </svg>
    ),
    tip: 'Si querés cambiar el precio, creá un paquete nuevo. Los existentes no se modifican para no afectar compras previas.',
  },
  {
    title: 'MercadoPago',
    description: 'Configurá tu Access Token de MercadoPago para que tus alumnas puedan comprar paquetes online. Sin esto, los pagos solo se pueden registrar en efectivo o transferencia.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </svg>
    ),
    tip: 'Vas a necesitar el Access Token de tu cuenta de MercadoPago. Está en mercadopago.com.ar → Tu perfil → Tus integraciones → Credenciales de producción.',
  },
  {
    title: 'Invitar alumnas',
    description: 'Compartí el link de registro para que tus alumnas se anoten solas, o agregálas manualmente desde el panel de Alumnos.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </svg>
    ),
  },
]

export default function AdminOnboardingGuide({ studio }: { studio: string }) {
  const storageKey = `flexa:${studio}:admin-guide-v1`
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        setVisible(true)
      }
    } catch { /* localStorage not available */ }
  }, [storageKey])

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1')
    } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const total = STEPS.length

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } } @keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

      <div
        style={{
          background: 'white',
          borderRadius: '1.5rem',
          width: '100%',
          maxWidth: '22rem',
          padding: '1.5rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'slideUp 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === step ? '1.5rem' : '0.5rem',
                  height: '0.5rem',
                  borderRadius: '99px',
                  background: i === step ? 'var(--sage, #6B8F6B)' : '#E8E0D6',
                  transition: 'all 0.2s ease',
                  display: 'block',
                }}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            style={{ fontSize: '0.75rem', color: 'var(--stone, #8A7F78)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }}
          >
            Omitir
          </button>
        </div>

        {/* Icon */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '5rem', height: '5rem', borderRadius: '50%',
            background: '#EDF4ED', color: 'var(--sage, #6B8F6B)',
            margin: '0 auto 1.25rem',
          }}
        >
          {current.icon}
        </div>

        {/* Text */}
        <h2
          style={{
            fontFamily: 'var(--font-cormorant, var(--font-display, serif))',
            fontSize: '1.6rem', fontWeight: 300,
            color: 'var(--ink, #2C2825)',
            textAlign: 'center', marginBottom: '0.625rem', lineHeight: 1.2,
          }}
        >
          {current.title}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--stone, #8A7F78)', textAlign: 'center', lineHeight: 1.5, marginBottom: current.tip ? '0.875rem' : '1.5rem' }}>
          {current.description}
        </p>

        {/* Tip */}
        {current.tip && (
          <div style={{ background: '#F0F7F0', border: '1px solid #C8DFC8', borderRadius: '0.75rem', padding: '0.625rem 0.875rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--sage, #6B8F6B)', lineHeight: 1.5 }}>
              {current.tip}
            </p>
          </div>
        )}

        {/* Counter */}
        <p style={{ fontSize: '0.7rem', color: '#C4B8AC', textAlign: 'center', marginBottom: '0.875rem' }}>
          {step + 1} / {total}
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid #E8E0D6', background: 'white', fontSize: '0.875rem', color: 'var(--stone, #8A7F78)', cursor: 'pointer', fontWeight: 500 }}
            >
              Anterior
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(step + 1)}
            style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--sage, #6B8F6B)', fontSize: '0.875rem', color: 'white', cursor: 'pointer', fontWeight: 500 }}
          >
            {isLast ? '¡Listo!' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  )
}
