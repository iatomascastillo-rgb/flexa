import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Section {
  title: string
  icon: React.ReactNode
  content: string[]
  steps?: { n: string; title: string; body: string }[]
  tip?: string
}

// ── Content ───────────────────────────────────────────────────────────────────

const STUDENT_SECTIONS: Section[] = [
  {
    title: 'Cómo reservar una clase',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
    content: ['Tocá la pestaña Clases en la barra inferior para ver todos los horarios disponibles.'],
    steps: [
      { n: '1', title: 'Explorá los horarios', body: 'Ves la semana completa con los días y horarios. Deslizá hacia los costados para ver días futuros.' },
      { n: '2', title: 'Elegí tu clase', body: 'Tocá la clase que te interesa para ver los detalles: tipo, horario, lugares disponibles e instructora.' },
      { n: '3', title: 'Confirmá la reserva', body: 'Presioná Reservar. Recibirás la confirmación y la clase aparecerá en tu pantalla de inicio.' },
    ],
    tip: 'Si ya tenés una reserva en ese horario o no tenés créditos disponibles, el botón de reserva no estará activo.',
  },
  {
    title: 'Tus créditos y paquetes',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" x2="12" y1="22.08" y2="12" />
      </svg>
    ),
    content: [
      'Cada vez que reservás una clase se descuenta un crédito de tu saldo. Para tener créditos, comprás un paquete.',
      'Los créditos que vencen antes se consumen primero (sistema FIFO). Tu saldo actual siempre se muestra en la pantalla de inicio.',
    ],
    steps: [
      { n: '1', title: 'Comprá un paquete', body: 'Tocá la pestaña Paquetes, elegí el que más te convenga y completá el pago.' },
      { n: '2', title: 'Usá tus créditos', body: 'Con cada reserva, se descuenta automáticamente un crédito del paquete activo.' },
      { n: '3', title: 'Recargá cuando necesites', body: 'Cuando tus créditos bajen, comprá un nuevo paquete. Podés tener varios paquetes activos al mismo tiempo.' },
    ],
    tip: 'Te avisamos cuando tus créditos están por vencer o cuando tu saldo está bajo.',
  },
  {
    title: 'Recurrencia',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 2.1l4 4-4 4" />
        <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
        <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
      </svg>
    ),
    content: [
      'La recurrencia te permite reservar automáticamente cada semana en el mismo horario. Así siempre tenés tu lugar asegurado sin tener que reservar manualmente.',
    ],
    steps: [
      { n: '1', title: 'Configurá tu horario fijo', body: 'Tocá la pestaña Recurrencia y elegí el día y horario en que querés asistir siempre.' },
      { n: '2', title: 'El sistema reserva por vos', body: 'Cada semana se crea automáticamente la reserva para esa clase, mientras tengas créditos disponibles.' },
      { n: '3', title: 'Pausar o eliminar', body: 'Podés pausar o eliminar tu recurrencia cuando quieras desde la misma pestaña.' },
    ],
  },
  {
    title: 'Cancelaciones',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" x2="9" y1="9" y2="15" />
        <line x1="9" x2="15" y1="9" y2="15" />
      </svg>
    ),
    content: [
      'Si no podés asistir a una clase, podés cancelar tu reserva y recuperar el crédito, siempre que lo hagas dentro del plazo establecido por el estudio.',
    ],
    steps: [
      { n: '1', title: 'Entrá a tu reserva', body: 'Desde la pantalla de inicio o desde la pestaña Clases, encontrá la clase reservada.' },
      { n: '2', title: 'Cancelá la reserva', body: 'Tocá la clase y seleccioná Cancelar reserva.' },
      { n: '3', title: 'Recuperás tu crédito', body: 'Si cancelás dentro del plazo, el crédito vuelve a tu saldo automáticamente.' },
    ],
    tip: 'Si cancelás tarde o no asistís sin avisar (no-show), es posible que el crédito no se devuelva según la política del estudio.',
  },
  {
    title: 'Tu perfil',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      </svg>
    ),
    content: [
      'Desde la pestaña Perfil podés editar tu nombre y teléfono, cambiar tu contraseña y acceder a esta guía de ayuda cuando quieras.',
    ],
  },
]

const INSTRUCTOR_SECTIONS: Section[] = [
  {
    title: 'Tus clases del día',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
    content: [
      'Al abrir la app ves todas las clases de hoy en orden cronológico. Cada tarjeta muestra el nombre, el horario y cuántas alumnas están inscriptas.',
    ],
    steps: [
      { n: 'AHORA', title: 'Clase en curso', body: 'Borde verde sólido. Es la clase que debería estar ocurriendo en este momento (iniciada en los últimos 90 minutos).' },
      { n: 'PRÓX', title: 'Siguiente clase', body: 'Borde verde punteado. Es la siguiente clase que todavía no comenzó.' },
      { n: '—', title: 'Pasadas', body: 'Se muestran con menor opacidad. También ves las clases de ayer para registrar asistencia si se te pasó.' },
    ],
  },
  {
    title: 'Registrar asistencia',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="m9 14 2 2 4-4" />
      </svg>
    ),
    content: ['Tocá cualquier clase para abrir la lista de alumnas inscriptas y registrar quién estuvo presente.'],
    steps: [
      { n: '1', title: 'Abrí la clase', body: 'Tocá la tarjeta de la clase para ver la lista de alumnas con reserva confirmada.' },
      { n: '2', title: 'Marcá presencia', body: 'Para cada alumna, elegí Presente o Ausente. Podés cambiar el estado mientras la sesión esté abierta.' },
      { n: '3', title: 'Listo', body: 'El registro queda guardado automáticamente. No hace falta confirmar.' },
    ],
    tip: 'Si hay alumnas sin registrar en clases pasadas, verás una alerta naranja en el tope del panel principal.',
  },
  {
    title: 'Reservar como alumna',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    content: [
      'Como instructora también podés inscribirte a clases. Usá la pestaña Reservar en la barra inferior para explorar los horarios disponibles y hacer tu reserva.',
      'Necesitás tener créditos activos igual que cualquier alumna.',
    ],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AyudaPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect(`/${studio}/login?callbackUrl=/${studio}/ayuda`)

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()

  if (session.user.studioId !== tenant.studioId) redirect(`/${studio}/login?callbackUrl=/${studio}/ayuda`)

  const role = session.user.role
  const isInstructor = role === 'INSTRUCTOR'
  const sections = isInstructor ? INSTRUCTOR_SECTIONS : STUDENT_SECTIONS

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
      {/* Back */}
      <Link
        href={`/${studio}/perfil`}
        className="mb-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
        style={{ color: 'var(--stone)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Perfil
      </Link>

      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Ayuda
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        {isInstructor
          ? 'Todo lo que necesitás saber para gestionar tus clases.'
          : 'Todo lo que necesitás saber para sacarle el máximo a tu espacio.'}
      </p>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            {/* Title */}
            <div className="mb-3 flex items-center gap-2.5">
              <span style={{ color: 'var(--sage)' }}>{s.icon}</span>
              <h2 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
                {s.title}
              </h2>
            </div>

            {/* Content paragraphs */}
            <div className="space-y-1.5 mb-3">
              {s.content.map((p, j) => (
                <p key={j} className="text-sm" style={{ color: 'var(--stone)' }}>
                  {p}
                </p>
              ))}
            </div>

            {/* Steps */}
            {s.steps && (
              <div className="mb-3 space-y-2">
                {s.steps.map((step) => (
                  <div key={step.n} className="flex gap-3">
                    <div
                      className="flex shrink-0 items-center justify-center rounded-full text-xs font-medium"
                      style={{
                        background: '#EDF4ED',
                        color: 'var(--sage)',
                        minWidth: '1.5rem',
                        height: '1.5rem',
                        paddingLeft: '0.25rem',
                        paddingRight: '0.25rem',
                      }}
                    >
                      {step.n}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{step.title}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tip */}
            {s.tip && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: '#FFF8F0', border: '1px solid #F0DEC8' }}
              >
                <p className="text-xs" style={{ color: 'var(--terracotta)' }}>
                  <strong>Tené en cuenta:</strong> {s.tip}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
