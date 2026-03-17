'use client'

import { useState } from 'react'

interface BuyButtonProps {
  studio: string
  packageId: string
  disabled?: boolean
}

/**
 * Botón de compra con MercadoPago.
 * Llama al API route del servidor (que crea la preferencia MP y devuelve la URL)
 * y luego redirige al checkout de MercadoPago.
 *
 * El precio nunca se envía desde el cliente — el servidor lo lee de la DB.
 */
export function BuyButton({ studio, packageId, disabled }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBuy() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/${studio}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setError(data.error ?? 'Error al iniciar el pago')
        return
      }

      const { checkoutUrl } = (await res.json()) as { checkoutUrl: string }
      // Redirigir al checkout de MercadoPago
      window.location.href = checkoutUrl
    } catch {
      setError('No se pudo conectar con el servidor de pagos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={disabled || loading}
        className="w-full rounded-xl py-3 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        style={{ background: 'var(--sage)' }}
      >
        {loading ? 'Redirigiendo a MercadoPago…' : 'Comprar con MercadoPago'}
      </button>

      {error && (
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--terracotta)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
