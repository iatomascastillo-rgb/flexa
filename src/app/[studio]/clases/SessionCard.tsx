'use client'

import { useRef, useTransition } from 'react'
import Link from 'next/link'

interface SessionCardProps {
  sessionId: string
  studio: string
  time: string
  className: string
  description?: string | null
  instructorName?: string | null
  spotsLeft: number
  capacity: number
  isBookable: boolean
  isCancellable: boolean
  canLeaveWaitlist: boolean
  myBookingStatus: string | null
  myBookingId: string | null
  isAdmin: boolean
  bookAction: (formData: FormData) => Promise<void>
  cancelAction: (formData: FormData) => Promise<void>
}

export function SessionCard({
  sessionId,
  studio,
  time,
  className,
  description,
  instructorName,
  spotsLeft,
  isBookable,
  isCancellable,
  canLeaveWaitlist,
  myBookingStatus,
  myBookingId,
  isAdmin,
  bookAction,
  cancelAction,
}: SessionCardProps) {
  const [isPending, startTransition] = useTransition()
  const actionRef = useRef<'book' | 'cancel' | null>(null)

  const isConfirmed = myBookingStatus === 'CONFIRMED'
  const isWaitlist = myBookingStatus === 'WAITLIST'
  const isFull = spotsLeft === 0 && !isConfirmed && !isWaitlist

  const timeColor = isConfirmed
    ? 'var(--sage)'
    : isWaitlist
      ? 'var(--terracotta)'
      : isFull
        ? 'var(--stone)'
        : 'var(--sage)'

  const spotsText = isConfirmed
    ? 'Reservada'
    : isWaitlist
      ? 'En espera'
      : isFull
        ? 'Sin lugares'
        : spotsLeft === 1
          ? 'Último lugar'
          : `${spotsLeft} lugares`

  const spotsColor = isConfirmed
    ? 'var(--sage)'
    : isWaitlist
      ? 'var(--terracotta)'
      : isFull
        ? '#C4B8AC'
        : 'var(--sage)'

  const isBooking = isPending && actionRef.current === 'book'
  const isCancelling = isPending && actionRef.current === 'cancel'

  function handleBook(formData: FormData) {
    actionRef.current = 'book'
    startTransition(() => bookAction(formData))
  }

  function handleCancel(formData: FormData) {
    if (!confirm('¿Cancelar esta reserva?')) return
    actionRef.current = 'cancel'
    startTransition(() => cancelAction(formData))
  }

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '14px',
        padding: '12px',
        opacity: isPending ? 0.6 : 1,
        transition: 'opacity 0.15s',
        border: isConfirmed
          ? '1px solid var(--sage)'
          : isWaitlist
            ? '1px solid var(--terracotta)'
            : '1px solid #E8E0D6',
      }}
    >
      <p
        className="mb-0.5 font-medium tabular-nums"
        style={{ fontSize: '15px', color: timeColor, lineHeight: 1 }}
      >
        {time}
      </p>

      <p
        className="font-semibold"
        style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.2, marginBottom: instructorName || description ? '3px' : '4px' }}
      >
        {className}
      </p>

      {instructorName && (
        <p style={{ fontSize: '10px', color: 'var(--stone)', lineHeight: 1.2, marginBottom: '2px' }}>
          {instructorName}
        </p>
      )}

      {description && (
        <p style={{
          fontSize: '10px', color: 'var(--stone)', lineHeight: 1.3, marginBottom: '3px',
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        } as React.CSSProperties}>
          {description}
        </p>
      )}

      <p style={{ fontSize: '11px', color: spotsColor, marginBottom: spotsText !== 'Sin lugares' ? '8px' : '0' }}>
        {spotsText}
      </p>

      {isConfirmed && isCancellable && (
        <form action={handleCancel}>
          <input type="hidden" name="bookingId" value={myBookingId!} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              background: '#F0EDEB',
              color: 'var(--stone)',
              border: 'none',
            }}
          >
            {isCancelling ? 'Cancelando...' : 'Cancelar'}
          </button>
        </form>
      )}

      {isWaitlist && canLeaveWaitlist && (
        <form action={handleCancel}>
          <input type="hidden" name="bookingId" value={myBookingId!} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              background: '#FDF0EC',
              color: 'var(--terracotta)',
              border: 'none',
            }}
          >
            {isCancelling ? 'Saliendo...' : 'Salir de lista'}
          </button>
        </form>
      )}

      {isBookable && !isFull && (
        <form action={handleBook}>
          <input type="hidden" name="classSessionId" value={sessionId} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              background: 'var(--sage)',
              color: 'white',
              border: 'none',
            }}
          >
            {isBooking ? 'Reservando...' : 'Reservar'}
          </button>
        </form>
      )}

      {isBookable && isFull && (
        <form action={handleBook}>
          <input type="hidden" name="classSessionId" value={sessionId} />
          <input type="hidden" name="studio" value={studio} />
          <button
            type="submit"
            disabled={isPending}
            style={{
              width: '100%',
              padding: '5px 0',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              background: '#FDF0EC',
              color: 'var(--terracotta)',
              border: 'none',
            }}
          >
            {isBooking ? 'Anotando...' : 'Lista de espera'}
          </button>
        </form>
      )}

      {isAdmin && (
        <Link
          href={`/${studio}/admin/sesiones/${sessionId}`}
          style={{
            display: 'block',
            marginTop: '6px',
            textAlign: 'center',
            fontSize: '10px',
            color: 'var(--stone)',
            textDecoration: 'none',
            opacity: 0.6,
          }}
        >
          ⚙ gestionar
        </Link>
      )}
    </div>
  )
}
