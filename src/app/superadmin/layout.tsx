import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { LogoutButton } from './LogoutButton'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login?studio=flexa&callbackUrl=/superadmin')
  if (session.user.role !== 'SUPER_ADMIN') redirect('/login?studio=flexa&callbackUrl=/superadmin')

  return (
    <div style={{ fontFamily: 'var(--font-dm-sans, system-ui)', minHeight: '100vh', background: '#0F0F0F', color: '#E8E8E8' }}>
      {/* Top bar */}
      <nav style={{ borderBottom: '1px solid #2A2A2A', background: '#171717' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', gap: '32px' }}>
          <span style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '22px', fontWeight: 300, color: '#C4774A' }}>
            Flexa · SuperAdmin
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { href: '/superadmin', label: 'Dashboard' },
              { href: '/superadmin/estudios', label: 'Estudios' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px', color: '#A0A0A0', textDecoration: 'none' }}
              >
                {label}
              </Link>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#555' }}>{session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  )
}
