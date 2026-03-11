import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

export default async function RecurrenciaPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const classTypes = await prisma.classType.findMany({
    where: { studioId: tenant.studioId, active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-24">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Recurrencia
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--stone)' }}>
        Reservá automáticamente tus clases favoritas cada semana
      </p>

      {/* Explicación */}
      <div
        className="mb-6 rounded-2xl p-5"
        style={{ background: 'white', border: '1px solid #E8E0D6' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: '#EDF4ED' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l4 2" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>¿Cómo funciona?</p>
            <p className="text-xs" style={{ color: 'var(--stone)' }}>Clases fijas cada semana</p>
          </div>
        </div>
        <ul className="space-y-2">
          {[
            'Elegís el tipo de clase, el día y el horario',
            'El sistema te reserva automáticamente cada semana',
            'Si no tenés créditos, la reserva queda en lista de espera',
            'Podés pausar o cancelar en cualquier momento',
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--stone)' }}>
              <span className="mt-0.5 text-xs font-bold" style={{ color: 'var(--sage)' }}>
                {i + 1}.
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      {/* Tipos de clase disponibles */}
      {classTypes.length > 0 ? (
        <div className="mb-6">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Clases disponibles en el estudio
          </p>
          <div className="flex flex-wrap gap-2">
            {classTypes.map((ct) => (
              <span
                key={ct.id}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: '#EDF4ED', color: 'var(--sage)' }}
              >
                {ct.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Próximamente */}
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: 'white', border: '2px dashed #E8E0D6' }}
      >
        <p
          className="mb-2 text-2xl font-light"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Próximamente
        </p>
        <p className="text-sm" style={{ color: 'var(--stone)' }}>
          La configuración de clases recurrentes estará disponible en la próxima actualización.
          Por ahora podés reservar tus clases desde la sección{' '}
          <a href={`/${studio}/clases`} className="font-medium" style={{ color: 'var(--sage)' }}>
            Clases
          </a>.
        </p>
      </div>
    </div>
  )
}
