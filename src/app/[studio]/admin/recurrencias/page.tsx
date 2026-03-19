export const dynamic = 'force-dynamic'

import { requireStudioAdminPage } from '@/lib/auth-guards'
import RecurrenciasRunner from './RecurrenciasRunner'

export default async function RecurrenciasAdminPage({
  params,
}: {
  params: Promise<{ studio: string }>
}) {
  const { studio } = await params

  const { studioId } = await requireStudioAdminPage(studio)

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-24">
      <h1
        className="mb-1 text-3xl font-light"
        style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
      >
        Reservas recurrentes
      </h1>
      <p className="mb-8 text-sm" style={{ color: 'var(--stone)' }}>
        Ejecutá manualmente el cron de recurrencias para un mes específico.
      </p>

      <RecurrenciasRunner studioId={studioId} />
    </div>
  )
}
