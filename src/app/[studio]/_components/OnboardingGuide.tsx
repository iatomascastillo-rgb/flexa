'use client'

import { useState, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Step {
  title: string
  description: string
  icon: React.ReactNode
  tip?: string
}

interface Props {
  studio: string
  role: 'STUDENT' | 'INSTRUCTOR'
}

// ── Step content ─────────────────────────────────────────────────────────────

const STUDENT_STEPS: Step[] = [
  {
    title: 'Bienvenida',
    description: 'En unos pasos rápidos te mostramos cómo sacarle el máximo provecho a tu espacio.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    title: 'Reservá tu clase',
    description: 'Tocá el ícono de Clases en la barra de abajo. Encontrá el horario que más te guste y presioná Reservar.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
    tip: 'Podés cancelar tu reserva hasta el tiempo que fije el estudio antes del inicio de la clase.',
  },
  {
    title: 'Créditos y paquetes',
    description: 'Cada clase que reservás descuenta un crédito. Comprá un paquete desde la pestaña Paquetes cuando necesites recargar.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" x2="12" y1="22.08" y2="12" />
      </svg>
    ),
    tip: 'Los créditos que vencen antes se consumen primero. Revisá tu saldo en la pantalla de inicio.',
  },
  {
    title: 'Recurrencia',
    description: 'Configurá una reserva automática cada semana en el mismo horario. Así nunca te quedás sin lugar.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2.1l4 4-4 4" />
        <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
        <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
      </svg>
    ),
    tip: 'Podés pausar o eliminar tu recurrencia cuando quieras desde la pestaña Recurrencia.',
  },
  {
    title: 'Tu perfil y ayuda',
    description: 'Desde Perfil editás tus datos y contraseña. Si en algún momento no recordás cómo hacer algo, tocá "Ayuda".',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
  },
]

const INSTRUCTOR_STEPS: Step[] = [
  {
    title: 'Bienvenida, instructora',
    description: 'Esta app te permite ver tus clases del día y registrar la asistencia de tus alumnas fácilmente.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: 'Tus clases del día',
    description: 'En la pantalla principal ves todas las clases de hoy. La marcada como AHORA está en curso; PRÓXIMA es la siguiente.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <circle cx="12" cy="16" r="2" fill="currentColor" />
      </svg>
    ),
    tip: 'También ves las clases de ayer para que puedas registrar asistencia si se te pasó.',
  },
  {
    title: 'Registrar asistencia',
    description: 'Tocá una clase para abrir la lista de alumnas inscriptas. Marcá quién estuvo presente o ausente.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
    tip: 'Si hay alumnas sin registrar, verás una alerta naranja en la parte superior del panel.',
  },
  {
    title: 'Reservar como alumna',
    description: 'También podés tomar clases vos misma. Usá la pestaña Reservar en la barra inferior para inscribirte.',
    icon: (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingGuide({ studio, role }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  const steps = role === 'INSTRUCTOR' ? INSTRUCTOR_STEPS : STUDENT_STEPS
  const storageKey = role === 'INSTRUCTOR'
    ? `flexa:${studio}:instructor-guide-v1`
    : `flexa:${studio}:student-guide-v1`

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        setVisible(true)
      }
    } catch {
      // localStorage not available (SSR or private mode)
    }
  }, [storageKey])

  function dismiss() {
    try {
      localStorage.setItem(storageKey, '1')
    } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  const current = steps[step]
  const isLast = step === steps.length - 1
  const total = steps.length

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
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

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
        <style>{`@keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {steps.map((_, i) => (
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
          {/* Omitir */}
          <button
            onClick={dismiss}
            style={{
              fontSize: '0.75rem',
              color: 'var(--stone, #8A7F78)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
            }}
          >
            Omitir
          </button>
        </div>

        {/* Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '5rem',
            height: '5rem',
            borderRadius: '50%',
            background: '#EDF4ED',
            color: 'var(--sage, #6B8F6B)',
            margin: '0 auto 1.25rem',
          }}
        >
          {current.icon}
        </div>

        {/* Text */}
        <h2
          style={{
            fontFamily: 'var(--font-cormorant, var(--font-display, serif))',
            fontSize: '1.6rem',
            fontWeight: 300,
            color: 'var(--ink, #2C2825)',
            textAlign: 'center',
            marginBottom: '0.625rem',
            lineHeight: 1.2,
          }}
        >
          {current.title}
        </h2>
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--stone, #8A7F78)',
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: current.tip ? '0.875rem' : '1.5rem',
          }}
        >
          {current.description}
        </p>

        {/* Tip */}
        {current.tip && (
          <div
            style={{
              background: '#F0F7F0',
              border: '1px solid #C8DFC8',
              borderRadius: '0.75rem',
              padding: '0.625rem 0.875rem',
              marginBottom: '1.5rem',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--sage, #6B8F6B)', lineHeight: 1.5 }}>
              {current.tip}
            </p>
          </div>
        )}

        {/* Step counter */}
        <p style={{ fontSize: '0.7rem', color: '#C4B8AC', textAlign: 'center', marginBottom: '0.875rem' }}>
          {step + 1} / {total}
        </p>

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                flex: 1,
                padding: '0.625rem',
                borderRadius: '0.75rem',
                border: '1px solid #E8E0D6',
                background: 'white',
                fontSize: '0.875rem',
                color: 'var(--stone, #8A7F78)',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Anterior
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(step + 1)}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: 'var(--sage, #6B8F6B)',
              fontSize: '0.875rem',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {isLast ? '¡Listo!' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  )
}
