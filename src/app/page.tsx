import Link from 'next/link'

// ── Datos ──────────────────────────────────────────────────────────────────────

const PAINS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'WhatsApp para coordinar todo',
    body: 'Mensajes perdidos, confirmaciones manuales, alumnas que no saben si tienen lugar.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
    title: 'Planillas para los créditos',
    body: 'Errores de cálculo, créditos vencidos sin aviso, tiempo perdido en administración.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    title: 'Cobros sin seguimiento',
    body: 'Transferencias que no llegan, pagos pendientes que se olvidan, flujo de caja incierto.',
  },
]

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <path d="m9 16 2 2 4-4" />
      </svg>
    ),
    title: 'Reservas online',
    body: 'Tus alumnas reservan y cancelan desde el celular. Vos ves todo en tiempo real.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Créditos automáticos',
    body: 'El sistema descuenta créditos al reservar y los devuelve al cancelar. Sin errores.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    title: 'Pagos con MercadoPago',
    body: 'Las alumnas pagan sus paquetes online. El dinero va directo a tu cuenta.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
    title: 'Tu marca, tu estudio',
    body: 'Colores propios, logo, mensaje de bienvenida. Una experiencia profesional para tus alumnas.',
  },
]

const BASIC_FEATURES = [
  'Reservas y cancelaciones online',
  'Panel de alumnos con créditos',
  'Pagos con MercadoPago',
  'Lista de espera automática',
  'Branding personalizado',
  'Período de gracia configurable',
]

const PRO_FEATURES = [
  ...BASIC_FEATURES,
  'Insights IA sobre tu estudio',
  'Notificaciones por WhatsApp',
  'Recurrencia semanal automática',
  'Soporte prioritario',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--cream)', color: 'var(--ink)' }}>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: 'rgba(247,243,238,0.92)', backdropFilter: 'blur(12px)', borderColor: '#E8E0D6' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span
            className="text-2xl font-light"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Flexa
          </span>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--stone)' }}
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: 'var(--sage)', color: 'white' }}
            >
              Empezar gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-5 py-20 text-center md:py-32">
        <p
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest"
          style={{ background: '#EDF4ED', color: 'var(--sage)' }}
        >
          14 días gratis · Sin tarjeta de crédito
        </p>
        <h1
          className="mb-6 text-5xl font-light leading-tight md:text-7xl"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
        >
          Tu estudio de Pilates,
          <br />
          <em className="not-italic" style={{ color: 'var(--sage)' }}>organizado</em>
        </h1>
        <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed" style={{ color: 'var(--stone)' }}>
          Reservas online, créditos automáticos y pagos integrados. Todo lo que necesitás para gestionar tu estudio sin planillas ni WhatsApp.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/registro"
            className="rounded-2xl px-8 py-4 text-base font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            Empezar 14 días gratis →
          </Link>
          <Link
            href="#precios"
            className="rounded-2xl px-8 py-4 text-base font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--stone)' }}
          >
            Ver planes
          </Link>
        </div>

        {/* Mockup de la app */}
        <div className="mx-auto mt-16 max-w-xs">
          <div
            className="overflow-hidden rounded-[2rem] p-1"
            style={{ background: '#2C2C2C', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
          >
            <div className="overflow-hidden rounded-[1.7rem]" style={{ background: 'var(--cream)' }}>
              {/* Status bar */}
              <div
                className="flex items-center justify-between px-5 pt-3 pb-2"
                style={{ background: 'var(--sage)' }}
              >
                <span className="text-xs text-white/70">9:41</span>
                <span
                  className="text-lg font-light text-white"
                  style={{ fontFamily: 'var(--font-cormorant, serif)' }}
                >
                  Mi Pilates
                </span>
                <span className="text-xs text-white/70">●●●</span>
              </div>
              {/* App content preview */}
              <div className="px-4 py-4">
                <div className="mb-3 rounded-2xl p-4" style={{ background: 'var(--sage)' }}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-widest text-white/70">Créditos</p>
                  <p className="text-5xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>8</p>
                  <div className="mt-2 h-1.5 rounded-full bg-white/20">
                    <div className="h-full w-2/3 rounded-full bg-white/60" />
                  </div>
                </div>
                <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Próximas clases</p>
                {[
                  { name: 'Pilates Mat', date: 'Mañana 10:00', spots: '3 lugares' },
                  { name: 'Reformer', date: 'Jue 18:00', spots: '1 lugar' },
                ].map((c, i) => (
                  <div
                    key={i}
                    className="mb-2 flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{ background: 'white', border: '1px solid #E8E0D6' }}
                  >
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>{c.date}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: '#EDF4ED', color: 'var(--sage)' }}>
                      {c.spots}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Problema ── */}
      <section className="py-20" style={{ background: 'white' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--terracotta)' }}>
            El problema
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            ¿Seguís gestionando tu estudio por WhatsApp?
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            La mayoría de los estudios de Pilates gestionan todo a mano. Es tiempo que no dedicás a tus alumnas.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{ background: 'var(--cream)', border: '1px solid #E8E0D6' }}
              >
                <div
                  className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}
                >
                  {p.icon}
                </div>
                <h3 className="mb-2 text-lg font-medium" style={{ color: 'var(--ink)' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solución ── */}
      <section className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            La solución
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Todo en un solo lugar
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Flexa automatiza la gestión de tu estudio para que puedas enfocarte en lo que hacés bien: enseñar.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{ background: 'white', border: '1px solid #E8E0D6' }}
              >
                <div className="mb-4">{f.icon}</div>
                <h3 className="mb-2 text-base font-medium" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Precios ── */}
      <section id="precios" className="py-20" style={{ background: 'white' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Precios
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Simple y transparente
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            14 días de prueba gratis. Sin tarjeta de crédito. Cancelás cuando querés.
          </p>

          <div className="grid gap-6 md:grid-cols-2 md:max-w-2xl md:mx-auto">
            {/* BÁSICO */}
            <div className="rounded-2xl p-7" style={{ background: 'var(--cream)', border: '1px solid #E8E0D6' }}>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
                Básico
              </p>
              <div className="mb-1 flex items-end gap-1">
                <span
                  className="text-5xl font-light"
                  style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
                >
                  $12.000
                </span>
              </div>
              <p className="mb-6 text-xs" style={{ color: 'var(--stone)' }}>ARS / mes</p>
              <ul className="mb-6 space-y-2">
                {BASIC_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--stone)' }}>
                    <span style={{ color: 'var(--sage)', flexShrink: 0, marginTop: '2px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/registro"
                className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                Empezar gratis
              </Link>
            </div>

            {/* PRO */}
            <div
              className="rounded-2xl p-7"
              style={{ background: 'var(--ink)', border: '1px solid var(--ink)' }}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-white/60">Pro</p>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--terracotta)', color: 'white' }}
                >
                  Recomendado
                </span>
              </div>
              <div className="mb-1 flex items-end gap-1">
                <span
                  className="text-5xl font-light text-white"
                  style={{ fontFamily: 'var(--font-cormorant, serif)' }}
                >
                  $22.000
                </span>
              </div>
              <p className="mb-6 text-xs text-white/50">ARS / mes</p>
              <ul className="mb-6 space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                    <span style={{ color: 'var(--sage-light)', flexShrink: 0, marginTop: '2px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/registro"
                className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-85"
                style={{ background: 'var(--sage)', color: 'white' }}
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section
        className="py-24 text-center"
        style={{ background: 'var(--sage)' }}
      >
        <div className="mx-auto max-w-xl px-5">
          <h2
            className="mb-4 text-4xl font-light text-white md:text-6xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)' }}
          >
            Probalo gratis
            <br />14 días
          </h2>
          <p className="mb-8 text-base text-white/75">
            Sin tarjeta de crédito. Sin compromisos. Cancelás cuando querés.
          </p>
          <Link
            href="/registro"
            className="inline-block rounded-2xl px-10 py-4 text-base font-medium transition-all hover:opacity-90"
            style={{ background: 'white', color: 'var(--sage)' }}
          >
            Crear mi estudio gratis →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="py-10"
        style={{ background: 'var(--ink)' }}
      >
        <div className="mx-auto max-w-5xl px-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <span
              className="text-xl font-light text-white/80"
              style={{ fontFamily: 'var(--font-cormorant, serif)' }}
            >
              Flexa
            </span>
            <nav className="flex flex-wrap justify-center gap-6">
              {[
                { label: 'Privacidad', href: '#' },
                { label: 'Términos', href: '#' },
                { label: 'Contacto', href: 'mailto:hola@flexa.app' },
              ].map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="text-sm transition-opacity hover:opacity-70"
                  style={{ color: 'white', opacity: 0.5 }}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <p className="text-xs text-white/30">© {new Date().getFullYear()} Flexa</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
