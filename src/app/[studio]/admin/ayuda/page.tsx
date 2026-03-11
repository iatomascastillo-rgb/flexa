import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'

export default async function AyudaPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const sections = [
    {
      title: 'Tipos de clase',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      content: [
        'Los tipos de clase son las modalidades que ofrecés en tu estudio (ej: "Reformer", "Mat", "Duet").',
        'Cada tipo tiene un nombre, un nivel (TODOS, PRINCIPIANTE, INTERMEDIO, AVANZADO) y una capacidad máxima por sesión.',
        'Las sesiones semanales se crean a partir de los tipos de clase — primero creás el tipo, después le asignás un horario.',
      ],
      link: `/${studio}/onboarding/2`,
      linkLabel: 'Configurar tipos de clase →',
    },
    {
      title: 'Horarios y sesiones',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
      content: [
        'Los horarios definen en qué días y a qué hora se repite cada tipo de clase.',
        'Al configurar un horario, se generan automáticamente las próximas 4 sesiones semanales.',
        'El cron mensual genera las sesiones del mes siguiente automáticamente — no necesitás crear cada clase a mano.',
        'Tus alumnas ven solo las sesiones futuras y pueden reservar su lugar.',
      ],
      link: `/${studio}/onboarding/3`,
      linkLabel: 'Configurar horarios →',
    },
    {
      title: 'Paquetes y precios',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
      content: [
        'Los paquetes son la unidad de venta: cantidad de clases + precio en ARS.',
        'Cada alumna compra un paquete y obtiene créditos que se descuentan al reservar una clase.',
        'El sistema usa FIFO: consume primero los créditos que vencen antes.',
        'El precio se ingresa en pesos ARS. Si querés cambiar el precio, creá un paquete nuevo — los existentes no se modifican.',
        'Podés tener múltiples paquetes: por ejemplo "4 clases $12.000", "8 clases $22.000".',
      ],
      link: `/${studio}/onboarding/4`,
      linkLabel: 'Configurar paquetes →',
    },
    {
      title: 'Pagos con MercadoPago',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      content: [
        'Para recibir pagos online necesitás configurar MercadoPago. Es opcional — las alumnas también pueden pagar en efectivo o transferencia.',
      ],
      steps: [
        { n: '1', title: 'Creá una cuenta en MercadoPago', body: 'Si no tenés una, registrate en mercadopago.com.ar con el email de tu estudio.' },
        { n: '2', title: 'Obtené tus credenciales', body: 'En tu cuenta MP → Tu negocio → Credenciales → Credenciales de producción. Copiá el Access Token y la Public Key.' },
        { n: '3', title: 'Configurá las variables de entorno', body: 'En Vercel, agregá: MP_ACCESS_TOKEN y NEXT_PUBLIC_MP_PUBLIC_KEY con los valores del paso anterior.' },
        { n: '4', title: 'Probá con el modo sandbox', body: 'Usá las credenciales de prueba de MP para testear pagos sin dinero real antes de salir a producción.' },
      ],
      note: 'Sin MP configurado, las alumnas igual pueden reservar. Vos marcás el pago como "efectivo" o "transferencia" desde el panel de cada alumna.',
    },
    {
      title: 'Invitar alumnas',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" x2="19" y1="8" y2="14" />
          <line x1="22" x2="16" y1="11" y2="11" />
        </svg>
      ),
      content: [
        'Tenés dos formas de sumar alumnas a tu estudio:',
      ],
      options: [
        {
          label: 'Link de registro',
          body: `Compartí el link y tus alumnas se registran solas: ${process.env.NEXT_PUBLIC_APP_URL ?? 'https://flexa.app'}/${studio}/unirse`,
        },
        {
          label: 'Agregar manualmente',
          body: 'Ingresás el nombre y email de la alumna. Se crea una cuenta con contraseña temporal que ella puede cambiar desde su perfil.',
        },
      ],
      link: `/${studio}/onboarding/6`,
      linkLabel: 'Agregar alumnas →',
    },
  ]

  return (
    <div className="mx-auto max-w-md px-4 py-6 pb-24">
      {/* Header */}
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
        Guías básicas para configurar y gestionar tu estudio.
      </p>

      {/* Secciones */}
      <div className="space-y-3">
        {sections.map((s, i) => (
          <div
            key={i}
            className="rounded-2xl p-5"
            style={{ background: 'white', border: '1px solid #E8E0D6' }}
          >
            {/* Título sección */}
            <div className="mb-3 flex items-center gap-2.5">
              <span style={{ color: 'var(--sage)' }}>{s.icon}</span>
              <h2 className="text-base font-medium" style={{ color: 'var(--ink)' }}>
                {s.title}
              </h2>
            </div>

            {/* Párrafos */}
            <div className="space-y-1.5 mb-3">
              {s.content.map((p, j) => (
                <p key={j} className="text-sm" style={{ color: 'var(--stone)' }}>
                  {p}
                </p>
              ))}
            </div>

            {/* Pasos (MP) */}
            {'steps' in s && s.steps && (
              <div className="mb-3 space-y-2">
                {s.steps.map((step) => (
                  <div key={step.n} className="flex gap-3">
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium"
                      style={{ background: '#EDF4ED', color: 'var(--sage)' }}
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

            {/* Nota (MP) */}
            {'note' in s && s.note && (
              <div
                className="mb-3 rounded-xl px-3 py-2.5"
                style={{ background: '#FFF8F0', border: '1px solid #F0DEC8' }}
              >
                <p className="text-xs" style={{ color: 'var(--terracotta)' }}>
                  <strong>Sin MP:</strong> {s.note}
                </p>
              </div>
            )}

            {/* Opciones (invitar) */}
            {'options' in s && s.options && (
              <div className="mb-3 space-y-2">
                {s.options.map((o, k) => (
                  <div
                    key={k}
                    className="rounded-xl px-3 py-2.5"
                    style={{ background: '#EDF4ED' }}
                  >
                    <p className="text-xs font-medium" style={{ color: 'var(--sage)' }}>{o.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--stone)' }}>{o.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Link acción */}
            {'link' in s && s.link && (
              <Link
                href={s.link}
                className="inline-block text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--sage)' }}
              >
                {s.linkLabel}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
