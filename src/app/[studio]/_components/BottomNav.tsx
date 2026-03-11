'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function RepeatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function GridIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}

export function BottomNav({ studio, role }: { studio: string; role: string }) {
  const pathname = usePathname()

  // SUPER_ADMIN: nav simplificado hacia el panel de plataforma
  if (role === 'SUPER_ADMIN') {
    const superLinks = [
      { href: '/superadmin', label: 'Panel', icon: GridIcon },
      { href: `/${studio}/perfil`, label: 'Perfil', icon: UserIcon },
    ]
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-[#171717]" style={{ borderColor: '#2A2A2A' }}>
        <div className="flex">
          {superLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors"
                style={{ color: isActive ? '#C4774A' : '#555' }}
              >
                <Icon active={isActive} />
                <span className={isActive ? 'font-medium' : ''}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  // Alumnos y STUDIO_ADMIN
  const links = [
    { href: `/${studio}`, label: 'Inicio', icon: HomeIcon },
    { href: `/${studio}/clases`, label: 'Clases', icon: CalendarIcon },
    { href: `/${studio}/recurrencia`, label: 'Recurrencia', icon: RepeatIcon },
    { href: `/${studio}/perfil`, label: 'Perfil', icon: UserIcon },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E8E0D6] bg-[#F7F3EE]">
      <div className="flex">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-3 text-xs transition-colors"
              style={{ color: isActive ? 'var(--sage)' : 'var(--stone)' }}
            >
              <Icon active={isActive} />
              <span className={isActive ? 'font-medium' : ''}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
