import { redirect, notFound } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getTenantBySlug } from '@/lib/tenant'
import { prisma } from '@/lib/prisma'

// ── Server Action ──────────────────────────────────────────────────────────────

async function savePoliticasAction(formData: FormData) {
  'use server'
  const studio = formData.get('studio') as string

  const session = await auth()
  if (!session?.user?.id) return
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') return

  const tenant = await getTenantBySlug(studio)
  if (!tenant || tenant.studioId !== session.user.studioId) return

  const cancellationHours = Math.min(48, Math.max(1, parseInt(formData.get('cancellationHours') as string) || 12))
  const lateCancellationPolicy = formData.get('lateCancellationPolicy') === 'KEEP_CREDIT' ? 'KEEP_CREDIT' : 'LOSE_CREDIT'
  const noShowPolicy = formData.get('noShowPolicy') === 'KEEP_CREDIT' ? 'KEEP_CREDIT' : 'LOSE_CREDIT'
  const allowWaitlist = formData.get('allowWaitlist') === 'on'
  const waitlistAutoPromote = formData.get('waitlistAutoPromote') === 'on'
  const gracePeriodEnabled = formData.get('gracePeriodEnabled') === 'on'
  const gracePeriodCutoffDay = Math.min(28, Math.max(1, parseInt(formData.get('gracePeriodCutoffDay') as string) || 10))
  const graceRequiresHistory = formData.get('graceRequiresHistory') === 'on'
  const graceOnNoPay = formData.get('graceOnNoPay') === 'KEEP_AND_ALERT' ? 'KEEP_AND_ALERT' : 'RELEASE_TO_WAITLIST'

  await prisma.studioSettings.update({
    where: { studioId: tenant.studioId },
    data: {
      cancellationHours,
      lateCancellationPolicy,
      noShowPolicy,
      allowWaitlist,
      waitlistAutoPromote,
      gracePeriodEnabled,
      gracePeriodCutoffDay,
      graceRequiresHistory,
      graceOnNoPay,
    },
  })

  revalidateTag(`settings-${tenant.studioId}`)
  redirect(`/${studio}/admin/settings/politicas?saved=1`)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PoliticasPage({
  params,
  searchParams,
}: {
  params: Promise<{ studio: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { studio } = await params
  const { saved } = await searchParams

  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'STUDIO_ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect(`/${studio}`)
  }

  const tenant = await getTenantBySlug(studio)
  if (!tenant) notFound()
  if (session.user.studioId !== tenant.studioId) redirect('/login')

  const settings = await prisma.studioSettings.findUnique({
    where: { studioId: tenant.studioId },
  })

  if (!settings) notFound()

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
        Políticas
      </h1>
      <p className="mb-6 text-sm" style={{ color: 'var(--stone)' }}>
        Configurá las reglas de cancelación y créditos de tu estudio.
      </p>

      {saved === '1' && (
        <div
          className="mb-5 rounded-xl px-4 py-3 text-sm"
          style={{ background: '#EDF4ED', color: 'var(--sage)' }}
        >
          ✓ Cambios guardados correctamente.
        </div>
      )}

      <form action={savePoliticasAction} className="space-y-4">
        <input type="hidden" name="studio" value={studio} />

        {/* ── Cancelación ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Cancelación
          </p>

          {/* Horas mínimas */}
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Horas mínimas para cancelar sin penalidad
            </label>
            <p className="mb-2 text-xs" style={{ color: 'var(--stone)' }}>
              Si la alumna cancela con menos de estas horas de anticipación, se aplica la política de cancelación tarde.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="cancellationHours"
                defaultValue={settings.cancellationHours}
                min={1}
                max={48}
                className="w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
              />
              <span className="text-sm" style={{ color: 'var(--stone)' }}>horas</span>
            </div>
          </div>

          {/* Política cancelación tarde */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Cancelación tarde
            </label>
            <div className="space-y-2">
              {[
                { value: 'LOSE_CREDIT', label: 'Pierde el crédito', desc: 'La alumna pierde el crédito si cancela tarde.' },
                { value: 'KEEP_CREDIT', label: 'Conserva el crédito', desc: 'El crédito se devuelve aunque cancele tarde.' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                  style={{ background: '#F7F3EE' }}
                >
                  <input
                    type="radio"
                    name="lateCancellationPolicy"
                    value={opt.value}
                    defaultChecked={settings.lateCancellationPolicy === opt.value}
                    className="mt-0.5 shrink-0 accent-[var(--sage)]"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Política no-show */}
          <div>
            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
              No-show (no asistió sin cancelar)
            </label>
            <div className="space-y-2">
              {[
                { value: 'LOSE_CREDIT', label: 'Pierde el crédito', desc: 'Si no asiste y no canceló, pierde el crédito.' },
                { value: 'KEEP_CREDIT', label: 'Conserva el crédito', desc: 'Se devuelve el crédito aunque no haya cancelado.' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                  style={{ background: '#F7F3EE' }}
                >
                  <input
                    type="radio"
                    name="noShowPolicy"
                    value={opt.value}
                    defaultChecked={settings.noShowPolicy === opt.value}
                    className="mt-0.5 shrink-0 accent-[var(--sage)]"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{opt.label}</p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Lista de espera ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Lista de espera
          </p>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="allowWaitlist"
                defaultChecked={settings.allowWaitlist}
                className="mt-0.5 shrink-0 accent-[var(--sage)]"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Habilitar lista de espera</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  Cuando una clase se llena, las alumnas pueden anotarse en lista de espera.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="waitlistAutoPromote"
                defaultChecked={settings.waitlistAutoPromote}
                className="mt-0.5 shrink-0 accent-[var(--sage)]"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Promover automáticamente</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  Cuando se cancela una reserva, la primera alumna de la lista con créditos disponibles ocupa el lugar.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* ── Período de gracia ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Período de gracia
          </p>
          <p className="mb-4 text-xs" style={{ color: 'var(--stone)' }}>
            Permite que alumnas reserven sin créditos al inicio del mes, a la espera de que renueven su paquete.
          </p>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="gracePeriodEnabled"
                defaultChecked={settings.gracePeriodEnabled}
                className="mt-0.5 shrink-0 accent-[var(--sage)]"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Habilitar período de gracia</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  Las alumnas sin créditos pueden reservar hasta el día de corte.
                </p>
              </div>
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Día de corte
              </label>
              <p className="mb-2 text-xs" style={{ color: 'var(--stone)' }}>
                Después de este día del mes, se aplica la acción configurada abajo.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="gracePeriodCutoffDay"
                  defaultValue={settings.gracePeriodCutoffDay}
                  min={1}
                  max={28}
                  className="w-20 rounded-xl border px-3 py-2 text-sm outline-none focus:border-[var(--sage)]"
                  style={{ borderColor: '#E8E0D6', color: 'var(--ink)' }}
                />
                <span className="text-sm" style={{ color: 'var(--stone)' }}>del mes</span>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="graceRequiresHistory"
                defaultChecked={settings.graceRequiresHistory}
                className="mt-0.5 shrink-0 accent-[var(--sage)]"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Requiere historial de pago</p>
                <p className="text-xs" style={{ color: 'var(--stone)' }}>
                  Solo aplica gracia a alumnas que compraron un paquete el mes anterior.
                </p>
              </div>
            </label>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--ink)' }}>
                Acción si no paga antes del corte
              </label>
              <div className="space-y-2">
                {[
                  { value: 'RELEASE_TO_WAITLIST', label: 'Pasar a lista de espera', desc: 'Las reservas en gracia se mueven a lista de espera y liberan el lugar.' },
                  { value: 'KEEP_AND_ALERT', label: 'Mantener y alertar', desc: 'Las reservas se mantienen pero se notifica al admin para seguimiento manual.' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
                    style={{ background: '#F7F3EE' }}
                  >
                    <input
                      type="radio"
                      name="graceOnNoPay"
                      value={opt.value}
                      defaultChecked={settings.graceOnNoPay === opt.value}
                      className="mt-0.5 shrink-0 accent-[var(--sage)]"
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{opt.label}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Guardar */}
        <button
          type="submit"
          className="w-full rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ background: 'var(--sage)', color: 'white' }}
        >
          Guardar cambios
        </button>
      </form>
    </div>
  )
}
