import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'

export default async function AuthTestPage() {
  const session = await auth()
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, hasValue: !!c.value }))

  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#C4774A', marginBottom: '2rem' }}>Auth Debug</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#5C7A5E' }}>Session</h2>
        <pre style={{ background: '#222', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#5C7A5E' }}>Cookies (names only)</h2>
        <pre style={{ background: '#222', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
          {JSON.stringify(allCookies, null, 2)}
        </pre>
      </section>

      <section>
        <h2 style={{ color: '#5C7A5E' }}>Env</h2>
        <pre style={{ background: '#222', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
          {JSON.stringify({
            NODE_ENV: process.env.NODE_ENV,
            HAS_AUTH_SECRET: !!process.env.AUTH_SECRET,
            HAS_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
            NEXTAUTH_URL: process.env.NEXTAUTH_URL,
            AUTH_URL: process.env.AUTH_URL,
          }, null, 2)}
        </pre>
      </section>
    </div>
  )
}
