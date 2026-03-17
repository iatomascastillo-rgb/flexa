'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/flexa/login' })}
      style={{
        padding: '5px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666',
        background: 'transparent',
        border: '1px solid #2A2A2A',
        cursor: 'pointer',
      }}
    >
      Salir
    </button>
  )
}
