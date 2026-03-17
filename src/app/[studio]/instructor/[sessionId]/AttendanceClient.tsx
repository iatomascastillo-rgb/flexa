'use client'

import { useState, useTransition } from 'react'

type Student = {
  bookingId: string
  userId: string
  name: string
  attendanceStatus: 'ATTENDED' | 'NO_SHOW' | null
}

export function AttendanceClient({
  students: initial,
  studio,
  canEdit,
}: {
  students: Student[]
  studio: string
  canEdit: boolean
}) {
  const [students, setStudents] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function mark(bookingId: string, status: 'ATTENDED' | 'NO_SHOW') {
    setLoadingId(bookingId)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/${studio}/instructor/attendance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, status }),
        })
        if (res.ok) {
          setStudents((prev) =>
            prev.map((s) =>
              s.bookingId === bookingId ? { ...s, attendanceStatus: status } : s,
            ),
          )
        }
      } finally {
        setLoadingId(null)
      }
    })
  }

  const attended = students.filter((s) => s.attendanceStatus === 'ATTENDED').length
  const noShow = students.filter((s) => s.attendanceStatus === 'NO_SHOW').length
  const total = students.length

  return (
    <div>
      {/* Summary */}
      {total > 0 && (
        <div
          className="mb-4 flex rounded-2xl"
          style={{ background: 'white', border: '1px solid #E8E0D6' }}
        >
          <Stat label="Presente" value={attended} color="var(--sage)" />
          <div style={{ width: '1px', background: '#E8E0D6' }} />
          <Stat label="Ausente" value={noShow} color="var(--terracotta)" />
          <div style={{ width: '1px', background: '#E8E0D6' }} />
          <Stat label="Sin registrar" value={total - attended - noShow} color="var(--stone)" />
        </div>
      )}

      {total === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: 'var(--stone)' }}>
          No hay alumnos inscriptos en esta clase
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((s) => {
            const isLoading = loadingId === s.bookingId && pending
            return (
              <div
                key={s.bookingId}
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background: 'white',
                  border: '1px solid #E8E0D6',
                  opacity: isLoading ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {s.name}
                </span>

                {canEdit ? (
                  <div className="flex gap-1.5">
                    <AttendanceBtn
                      label="Presente"
                      active={s.attendanceStatus === 'ATTENDED'}
                      activeStyle={{ background: '#EDF4ED', color: 'var(--sage)', borderColor: 'var(--sage)' }}
                      disabled={isLoading}
                      onClick={() => mark(s.bookingId, 'ATTENDED')}
                    />
                    <AttendanceBtn
                      label="Ausente"
                      active={s.attendanceStatus === 'NO_SHOW'}
                      activeStyle={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)', borderColor: 'var(--terracotta)' }}
                      disabled={isLoading}
                      onClick={() => mark(s.bookingId, 'NO_SHOW')}
                    />
                  </div>
                ) : (
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        s.attendanceStatus === 'ATTENDED'
                          ? 'var(--sage)'
                          : s.attendanceStatus === 'NO_SHOW'
                            ? 'var(--terracotta)'
                            : 'var(--stone)',
                    }}
                  >
                    {s.attendanceStatus === 'ATTENDED'
                      ? 'Presente'
                      : s.attendanceStatus === 'NO_SHOW'
                        ? 'Ausente'
                        : 'Sin registrar'}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-1 flex-col items-center py-3">
      <span className="text-2xl font-semibold" style={{ color }}>{value}</span>
      <span className="mt-0.5 text-xs" style={{ color: 'var(--stone)' }}>{label}</span>
    </div>
  )
}

function AttendanceBtn({
  label,
  active,
  activeStyle,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  activeStyle: React.CSSProperties
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
      style={{
        border: '1px solid',
        cursor: disabled ? 'default' : 'pointer',
        ...(active
          ? activeStyle
          : { borderColor: '#E8E0D6', background: 'transparent', color: 'var(--stone)' }),
      }}
    >
      {label}
    </button>
  )
}
