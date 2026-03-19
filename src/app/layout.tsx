import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '600'],
})

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Flexa',
  description: 'Gestión de estudios de Pilates',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Flexa',
  },
  formatDetection: { telephone: false },
  other: {
    'theme-color': '#5C7A5E',
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/flexa-icon.svg" />
      </head>
      <body className={`${cormorant.variable} ${dmSans.variable}`} style={{ fontFamily: 'var(--font-dm-sans, sans-serif)' }}>
        {children}
      </body>
    </html>
  )
}
