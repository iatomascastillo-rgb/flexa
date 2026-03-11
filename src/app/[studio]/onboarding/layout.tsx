'use client'

import Link from 'next/link'
import { usePathname, useParams } from 'next/navigation'

const STEPS = ['Tu estudio', 'Tipos de clase', 'Horarios', 'Paquetes', 'Pagos', 'Alumnos']

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams<{ studio: string }>()
  const studio = params.studio

  const match = pathname.match(/\/onboarding\/(\d+)/)
  const currentStep = match ? parseInt(match[1]) : 0

  return (
    <div className="min-h-screen pb-16" style={{ background: 'var(--cream)' }}>
      {/* Header con progreso */}
      <div className="mx-auto max-w-md px-4 pt-6 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                Paso {currentStep} de {STEPS.length} · {STEPS[currentStep - 1]}
              </p>
            )}
          </div>
          <Link href={`/${studio}`} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
            Completar después
          </Link>
        </div>

        {/* Barra de progreso */}
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i < currentStep ? 'var(--sage)' : '#E8E0D6' }}
            />
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}
