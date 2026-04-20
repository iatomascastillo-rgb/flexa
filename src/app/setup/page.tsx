'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [key, setKey]           = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [status, setStatus]     = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, email, password, name }),
    })

    const data = await res.json()

    if (res.ok) {
      setStatus('ok')
      setMessage(`Super admin creado: ${data.user.email}`)
    } else {
      setStatus('error')
      setMessage(data.error ?? 'Error desconocido')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-md">
        <h1 className="mb-1 text-xl font-semibold text-gray-800">Crear Super Admin</h1>
        <p className="mb-6 text-sm text-gray-500">Solo funciona una vez. Requiere la clave de setup.</p>

        {status === 'ok' ? (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Clave de setup</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                placeholder="SETUP_SECRET"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@flexa.com"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>

            {status === 'error' && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{message}</p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-xl bg-gray-800 py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50 hover:opacity-85"
            >
              {status === 'loading' ? 'Creando...' : 'Crear super admin'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
