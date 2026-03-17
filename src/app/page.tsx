import Link from 'next/link'
import Image from 'next/image'
import { HowItWorks } from '@/components/HowItWorks'

// ── Datos ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '+1.200', label: 'Reservas procesadas' },
  { value: '+40', label: 'Estudios activos' },
  { value: '0', label: 'Errores de crédito' },
  { value: 'Todo el día', label: 'Soporte disponible' },
]

const PAINS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
      </svg>
    ),
    title: 'No sabés cómo está tu estudio de verdad',
    body: 'Sin datos claros no podés saber cuántas alumnas están activas, cuánto facturaste realmente ni qué clases son rentables.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    title: 'Cancelaciones y recuperos sin control',
    body: 'Los créditos se pierden, las deudas se olvidan y la política de gracia se gestiona con mensajes que nadie ve.',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
    title: 'Experiencia desprolija para tus alumnas',
    body: 'Sin un sistema propio, el estudio no transmite la profesionalidad que merece. La experiencia es la misma que la de cualquier grupo de WhatsApp.',
  },
]

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" />
      </svg>
    ),
    title: 'Reservas online 24/7',
    body: 'Tus alumnas reservan y cancelan desde el celular, en cualquier momento. Vos ves todo en tiempo real.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Créditos automáticos',
    body: 'El sistema descuenta créditos al reservar y los devuelve al cancelar. Sin errores, sin planillas.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="14" x="2" y="5" rx="2" /><path d="M2 10h20" />
      </svg>
    ),
    title: 'Pagos con MercadoPago',
    body: 'Las alumnas pagan sus paquetes online. El dinero va directo a tu cuenta, sin intermediarios.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: 'Lista de espera automática',
    body: 'Si alguien cancela, la primera en la lista recibe su lugar sin que hagas nada.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Período de gracia configurable',
    body: 'Definís cuántos días puede asistir una alumna antes de pagar. El corte es automático.',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
      </svg>
    ),
    title: 'Análisis inteligente',
    body: 'Cada mes tu estudio te habla: quién se está alejando, qué clases funcionan, cuánto creciste.',
  },
]

const AI_INSIGHTS = [
  {
    tag: 'Resumen del mes',
    title: 'Tu estudio en números',
    quote: 'La facturación creció un 18% respecto al mes anterior. La clase de Reformer del martes a las 18hs es tu turno estrella con 95% de ocupación. Considerá abrir un segundo turno.',
  },
  {
    tag: 'Alumnas que se alejan',
    title: 'Quién está perdiendo el ritmo',
    quote: '4 alumnas activas no reservaron en las últimas 2 semanas. 2 tienen créditos por vencer esta semana. Un mensaje hoy puede recuperar al menos la mitad.',
  },
  {
    tag: 'Tu agenda',
    title: 'Qué ajustar para ganar más',
    quote: 'El turno de miércoles 7:00 tiene un 28% de ocupación promedio. Moverlo a las 8:00 podría elevarla al 60%, basado en el patrón de reservas de los últimos 3 meses.',
  },
]

const CUSTOMIZATIONS = [
  { title: 'Período de gracia', body: 'Cuántos días puede asistir una alumna antes de pagar. El corte es automático.' },
  { title: 'Política de cancelación', body: 'Elegís si liberar el lugar a lista de espera o mantenerlo con alerta.' },
  { title: 'Branding propio', body: 'Colores, logo y nombre del estudio. Tus alumnas ven tu marca, no la nuestra.' },
  { title: 'Tipos de clase y cupos', body: 'Reformer, Mat, Duet, grupal. Cada tipo con su capacidad y sus reglas.' },
  { title: 'Paquetes a medida', body: 'Definís la cantidad de clases, el precio y el vencimiento de cada paquete.' },
  { title: 'Recurrencia semanal', body: 'Generás todo el mes siguiente con un clic, respetando feriados.' },
]

const COMPARISON_ROWS = [
  { label: 'Idioma', generic: 'Español (básico)', intl: 'Inglés', flexa: 'Español argentino' },
  { label: 'Pagos', generic: 'Transferencia manual', intl: 'Sin MercadoPago', flexa: 'MercadoPago directo' },
  { label: 'Análisis de tu negocio', generic: 'No existe', intl: 'Reportes básicos', flexa: 'IA que interpreta y sugiere' },
  { label: 'Precio', generic: '—', intl: 'USD 129+/mes', flexa: 'ARS accesible' },
  { label: 'Soporte', generic: 'Ninguno', intl: 'Tickets en inglés', flexa: 'Equipo local todo el día' },
  { label: 'Hecho para pilates boutique', generic: 'No', intl: 'No (genérico)', flexa: 'Diseñado para esto' },
]

const TESTIMONIALS = [
  {
    name: 'Valeria M.',
    studio: 'Studio Reform, Buenos Aires',
    quote: 'Antes no sabía cuántas alumnas tenía activas de verdad ni cuánto había facturado en el mes. Ahora lo veo al instante y me llega un resumen con recomendaciones que antes ni me hubiese imaginado.',
  },
  {
    name: 'Cecilia R.',
    studio: 'Pilates Norte, Córdoba',
    quote: 'El análisis de alumnas que se están alejando fue lo que más me sorprendió. Me avisó antes de que se fueran y pude contactarlas a tiempo. En un mes retuve a 3.',
  },
  {
    name: 'Lucía T.',
    studio: 'Movimiento Boutique, Rosario',
    quote: 'El período de gracia configurable fue clave para mí. Antes perdía alumnas por no tener flexibilidad. Ahora cada estudio lo maneja a su manera y el sistema lo controla solo.',
  },
]

const BASIC_FEATURES = [
  'Reservas y cancelaciones online',
  'Panel de alumnos con créditos',
  'Pagos con MercadoPago',
  'Lista de espera automática',
  'Branding personalizado',
  'Período de gracia configurable',
  'Notificaciones automáticas por email',
  'Resumen mensual automático',
  'Soporte de equipo todo el día',
]

const PRO_FEATURES = [
  ...BASIC_FEATURES,
  'Análisis inteligente con IA',
  'Detección de alumnas que se alejan',
  'Optimización de agenda con IA',
  'Recurrencia semanal automática',
  'Soporte prioritario',
]

const FAQS = [
  {
    q: '¿Mis alumnas necesitan instalar una app?',
    a: 'No. Flexa funciona desde el navegador del celular. Tus alumnas entran desde un link, sin descargas ni cuentas en stores. Es una web app mobile-first diseñada para ser rápida y simple.',
  },
  {
    q: '¿Cómo funcionan los pagos con MercadoPago?',
    a: 'Las alumnas pagan sus paquetes directamente en tu cuenta de MercadoPago. Vos configurás tu access token y el dinero va directo a tu billetera. Flexa no toca el dinero ni cobra comisión por transacción.',
  },
  {
    q: '¿Qué es el período de gracia y cómo se configura?',
    a: 'Es el tiempo que una alumna puede asistir a clases antes de tener que pagar. Vos definís cuántos días permite tu estudio y qué pasa al vencimiento: Flexa puede liberar su lugar automáticamente o mandarte una alerta para que gestiones vos.',
  },
  {
    q: '¿En qué consiste el análisis inteligente?',
    a: 'Flexa analiza los datos de tu estudio (reservas, pagos, asistencia) con inteligencia artificial y te genera un diagnóstico mensual en palabras simples: qué funciona, qué alumnas están por irse y qué ajustes podés hacer para mejorar. Sin planillas ni dashboards complicados.',
  },
  {
    q: '¿Puedo migrar desde mi planilla o sistema actual?',
    a: 'Sí. Podés cargar tus alumnas y paquetes existentes desde el panel de admin. El equipo de Flexa te acompaña en la migración inicial sin costo adicional.',
  },
  {
    q: '¿Qué pasa si cancelo la suscripción?',
    a: 'Podés cancelar cuando querés. Tus datos quedan guardados por 30 días. Si volvés en ese período, todo sigue igual. Sin penalidades ni compromisos.',
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--cream)', color: 'var(--ink)' }}>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: 'rgba(247,243,238,0.95)', backdropFilter: 'blur(12px)', borderColor: '#E8E0D6' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Image src="/flexa-logo.svg" alt="Flexa" width={32} height={32} />
            <span className="text-xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>
              Flexa
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              Iniciar sesión
            </Link>
            <Link href="/registro" className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85" style={{ background: 'var(--sage)', color: 'white' }}>
              Empezar gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-5xl px-5 py-20 text-center md:py-28">
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
          Gestioná, entendé
          <br />
          <em className="not-italic" style={{ color: 'var(--sage)' }}>y hacé crecer tu estudio</em>
        </h1>
        <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed" style={{ color: 'var(--stone)' }}>
          Reservas, créditos, pagos integrados y análisis inteligente en un solo lugar.
          La plataforma diseñada para estudios de pilates boutique en Argentina.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/registro"
            className="rounded-2xl px-8 py-4 text-base font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--sage)', color: 'white' }}
          >
            Crear mi estudio gratis →
          </Link>
          <a href="#como-funciona" className="rounded-2xl px-8 py-4 text-base font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
            Ver cómo funciona
          </a>
        </div>

        {/* Dual mockup: alumna (izq) + admin (der) */}
        <div className="mx-auto mt-16 flex flex-col items-center gap-6 md:flex-row md:items-end md:justify-center md:gap-6">

          {/* Phone: vista alumna */}
          <div className="w-52 shrink-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Vista alumna</p>
            <div
              className="overflow-hidden rounded-[1.8rem] p-1"
              style={{ background: '#2C2C2C', boxShadow: '0 16px 48px rgba(0,0,0,0.16)' }}
            >
              <div className="overflow-hidden rounded-[1.5rem]" style={{ background: 'var(--cream)' }}>
                <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ background: 'var(--sage)' }}>
                  <span className="text-xs text-white/60">9:41</span>
                  <span className="text-sm font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Mi Pilates</span>
                  <span className="text-xs text-white/60">●●</span>
                </div>
                <div className="px-3 py-3">
                  <div className="mb-3 rounded-xl p-3" style={{ background: 'var(--sage)' }}>
                    <p className="mb-0.5 text-xs font-medium uppercase tracking-widest text-white/60">Créditos</p>
                    <p className="text-4xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>8</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/20">
                      <div className="h-full w-2/3 rounded-full bg-white/60" />
                    </div>
                  </div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Próximas clases</p>
                  {[
                    { name: 'Pilates Mat', date: 'Mañana 10:00' },
                    { name: 'Reformer', date: 'Jue 18:00' },
                  ].map((c, i) => (
                    <div key={i} className="mb-1.5 rounded-xl px-2.5 py-2" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>{c.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card: vista admin */}
          <div className="w-72 shrink-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Vista admin</p>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'white', border: '1px solid #E8E0D6', boxShadow: '0 16px 48px rgba(0,0,0,0.10)' }}
            >
              {/* Admin header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--ink)' }}>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-widest">Panel admin</p>
                  <p className="text-sm font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Centro Pilates</p>
                </div>
                <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: 'var(--sage)' }}>A</div>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-px" style={{ background: '#E8E0D6' }}>
                {[
                  { label: 'Activas', value: '10' },
                  { label: 'Este mes', value: '$52k' },
                  { label: 'Ocupación', value: '74%' },
                ].map((s, i) => (
                  <div key={i} className="px-3 py-3 text-center" style={{ background: 'var(--cream)' }}>
                    <p className="text-base font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>{s.value}</p>
                    <p className="text-xs" style={{ color: 'var(--stone)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {/* AI recommendation */}
              <div className="px-4 py-4">
                <div className="mb-3 rounded-xl p-3.5" style={{ background: 'rgba(155,109,255,0.08)', border: '1px solid rgba(155,109,255,0.2)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: '#9B6DFF', fontSize: '11px' }}>✦</span>
                    <p className="text-xs font-medium" style={{ color: '#9B6DFF' }}>Análisis de Marzo</p>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
                    4 alumnas no reservaron en 2 semanas. Contactarlas hoy puede retener al menos la mitad.
                  </p>
                </div>
                {/* Student list */}
                <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Alumnas recientes</p>
                {[
                  { name: 'Marta G.', status: 'Activa', color: '#5C7A5E', bg: '#EDF4ED' },
                  { name: 'Julia R.', status: 'Sin paquete', color: '#C4774A', bg: '#F5E8DE' },
                  { name: 'Ana P.', status: 'Activa', color: '#5C7A5E', bg: '#EDF4ED' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: i < 2 ? '1px solid #F0EBE5' : 'none' }}>
                    <p className="text-xs" style={{ color: 'var(--ink)' }}>{s.name}</p>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: s.bg, color: s.color }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: 'var(--ink)' }}>
        <div className="mx-auto max-w-5xl px-5 py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl font-light text-white md:text-4xl" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-white/50">{s.label}</p>
              </div>
            ))}
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
            Gestionar un estudio es más
            <br />complejo de lo que parece
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Sin la información correcta, tomás decisiones a ciegas. Y eso tiene un costo.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <div key={i} className="rounded-2xl p-6" style={{ background: 'var(--cream)', border: '1px solid #E8E0D6' }}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--terracotta-light)', color: 'var(--terracotta)' }}>
                  {p.icon}
                </div>
                <h3 className="mb-2 text-lg font-medium" style={{ color: 'var(--ink)' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cómo funciona (interactivo) ── */}
      <section id="como-funciona" className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Cómo funciona
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Simple desde el primer día
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Sin configuraciones técnicas ni manuales. Flexa está diseñado para que empieces a operar el mismo día.
          </p>
          <HowItWorks />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20" style={{ background: 'white' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Funcionalidades
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Todo en un solo lugar
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Flexa automatiza la gestión para que puedas enfocarte en lo que hacés bien: enseñar.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl p-6" style={{ background: 'var(--cream)', border: '1px solid #E8E0D6' }}>
                <div className="mb-4">{f.icon}</div>
                <h3 className="mb-2 text-base font-medium" style={{ color: 'var(--ink)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Análisis inteligente (IA) ── */}
      <section style={{ background: 'var(--ink)' }}>
        <div className="mx-auto max-w-5xl px-5 py-24">
          <div className="mb-16 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: '#9B6DFF' }}>
              Análisis inteligente
            </p>
            <h2
              className="mb-4 text-4xl font-light text-white md:text-5xl"
              style={{ fontFamily: 'var(--font-cormorant, serif)' }}
            >
              Tu estudio genera datos.
              <br />
              <em className="not-italic" style={{ color: '#9B6DFF' }}>Flexa los convierte en decisiones.</em>
            </h2>
            <p className="mx-auto max-w-lg text-base text-white/60">
              No necesitás saber de análisis ni de tecnología. Flexa procesa los datos de tu estudio
              y te entrega diagnósticos claros cada mes, como si tuvieras un socio de negocio propio.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {AI_INSIGHTS.map((insight, i) => (
              <div
                key={i}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
              >
                <span
                  className="mb-4 inline-block rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: 'rgba(155,109,255,0.15)', color: '#9B6DFF' }}
                >
                  {insight.tag}
                </span>
                <h3 className="mb-3 text-lg font-medium text-white">{insight.title}</h3>
                <p
                  className="text-sm leading-relaxed italic"
                  style={{ color: 'rgba(255,255,255,0.5)', borderLeft: '2px solid rgba(155,109,255,0.35)', paddingLeft: '12px' }}
                >
                  &ldquo;{insight.quote}&rdquo;
                </p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            El análisis inteligente está disponible en el Plan Pro · Se genera automáticamente cada mes
          </p>
        </div>
      </section>

      {/* ── Personalización ── */}
      <section className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <div className="md:flex md:items-start md:gap-16">
            <div className="mb-12 md:mb-0 md:w-2/5">
              <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--terracotta)' }}>
                Tu estudio, tus reglas
              </p>
              <h2
                className="mb-4 text-4xl font-light md:text-5xl"
                style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
              >
                Cada estudio es diferente.
                <br />
                <em className="not-italic" style={{ color: 'var(--terracotta)' }}>Flexa se adapta al tuyo.</em>
              </h2>
              <p className="text-base leading-relaxed" style={{ color: 'var(--stone)' }}>
                Desde las políticas de pago hasta el diseño de la app que ven tus alumnas.
                No hay configuración fija: todo se ajusta a cómo trabaja tu estudio.
              </p>
            </div>
            <div className="md:w-3/5">
              <div className="grid gap-4 sm:grid-cols-2">
                {CUSTOMIZATIONS.map((c, i) => (
                  <div key={i} className="rounded-2xl p-5" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                    <div className="mb-1 flex items-center gap-2">
                      <span style={{ color: 'var(--terracotta)', fontSize: '14px' }}>✦</span>
                      <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{c.title}</h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>{c.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparación vs competidores ── */}
      <section className="py-20" style={{ background: 'white' }}>
        <div className="mx-auto max-w-4xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            ¿Por qué Flexa?
          </p>
          <h2
            className="mb-4 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Hecho para Argentina,
            <br />hecho para pilates
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Las apps internacionales no están pensadas para estudios boutique en Argentina. Flexa sí.
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #E8E0D6' }}>
            <div className="grid grid-cols-4" style={{ borderBottom: '1px solid #E8E0D6' }}>
              <div className="px-4 py-4" style={{ background: 'var(--cream)' }} />
              <div className="px-4 py-4 text-center" style={{ background: 'var(--cream)', borderLeft: '1px solid #E8E0D6' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--stone)' }}>Planilla<br />+ WhatsApp</p>
              </div>
              <div className="px-4 py-4 text-center" style={{ background: 'var(--cream)', borderLeft: '1px solid #E8E0D6' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--stone)' }}>Apps<br />internacionales</p>
              </div>
              <div className="px-4 py-4 text-center" style={{ background: '#EDF4ED', borderLeft: '1px solid #E8E0D6' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--sage)' }}>Flexa ✓</p>
              </div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={i} className="grid grid-cols-4" style={{ borderTop: '1px solid #E8E0D6' }}>
                <div className="px-4 py-3.5" style={{ background: i % 2 === 0 ? 'white' : 'var(--cream)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{row.label}</p>
                </div>
                <div className="px-4 py-3.5 text-center flex items-center justify-center" style={{ background: i % 2 === 0 ? 'white' : 'var(--cream)', borderLeft: '1px solid #E8E0D6' }}>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>{row.generic}</p>
                </div>
                <div className="px-4 py-3.5 text-center flex items-center justify-center" style={{ background: i % 2 === 0 ? 'white' : 'var(--cream)', borderLeft: '1px solid #E8E0D6' }}>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>{row.intl}</p>
                </div>
                <div className="px-4 py-3.5 text-center flex items-center justify-center" style={{ background: i % 2 === 0 ? '#F5FAF5' : '#EDF4ED', borderLeft: '1px solid #E8E0D6' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--sage)' }}>{row.flexa}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimoniales ── */}
      <section className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Estudios que ya usan Flexa
          </p>
          <h2
            className="mb-14 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Resultados reales
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl p-7" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                <p
                  className="mb-6 text-sm leading-relaxed italic"
                  style={{ color: 'var(--stone)', borderLeft: '2px solid var(--sage)', paddingLeft: '14px' }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{t.name}</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>{t.studio}</p>
                </div>
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
            <div className="rounded-2xl p-7" style={{ background: 'var(--cream)', border: '1px solid #E8E0D6' }}>
              <p className="mb-1 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Básico</p>
              <span className="text-5xl font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>$12.000</span>
              <p className="mb-6 mt-1 text-xs" style={{ color: 'var(--stone)' }}>ARS / mes</p>
              <ul className="mb-6 space-y-2">
                {BASIC_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--stone)' }}>
                    <span style={{ color: 'var(--sage)', flexShrink: 0, marginTop: '2px' }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-80" style={{ background: 'var(--sage)', color: 'white' }}>
                Empezar gratis
              </Link>
            </div>
            <div className="rounded-2xl p-7" style={{ background: 'var(--ink)', border: '1px solid var(--ink)' }}>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-widest text-white/60">Pro</p>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: '#9B6DFF', color: 'white' }}>Con análisis IA</span>
              </div>
              <span className="text-5xl font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>$22.000</span>
              <p className="mb-6 mt-1 text-xs text-white/50">ARS / mes</p>
              <ul className="mb-6 space-y-2">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/80">
                    <span style={{ color: 'var(--sage-light)', flexShrink: 0, marginTop: '2px' }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/registro" className="block w-full rounded-xl py-3 text-center text-sm font-medium transition-opacity hover:opacity-85" style={{ background: 'var(--sage)', color: 'white' }}>
                Empezar gratis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-2xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>
            Preguntas frecuentes
          </p>
          <h2
            className="mb-12 text-center text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Dudas comunes
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details key={i} className="group rounded-2xl" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-sm font-medium" style={{ color: 'var(--ink)' }}>
                  {faq.q}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--stone)' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: 'var(--stone)' }}>{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Soporte + Contacto ── */}
      <section className="py-20" style={{ background: 'white' }}>
        <div className="mx-auto max-w-xl px-5 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Siempre cerca
          </p>
          <h2
            className="mb-4 text-4xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          >
            Soporte humano,
            <br />todo el día
          </h2>
          <p className="mx-auto mb-10 max-w-sm text-base leading-relaxed" style={{ color: 'var(--stone)' }}>
            Nuestro equipo está disponible para resolver cualquier duda, siempre en español.
            Si algo no funciona como esperás, lo resolvemos con vos.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="https://wa.me/5491100000000?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Flexa"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-medium transition-opacity hover:opacity-85"
              style={{ background: '#25D366', color: 'white' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Escribir por WhatsApp
            </a>
            <a
              href="mailto:hola@flexa.app"
              className="flex items-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ border: '1.5px solid #E8E0D6', color: 'var(--stone)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              hola@flexa.app
            </a>
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 text-center" style={{ background: 'var(--sage)' }}>
        <div className="mx-auto max-w-xl px-5">
          <h2
            className="mb-4 text-4xl font-light text-white md:text-6xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)' }}
          >
            Empezá hoy,
            <br />gratis por 14 días
          </h2>
          <p className="mb-8 text-base text-white/75">Sin tarjeta de crédito. Sin compromisos. Cancelás cuando querés.</p>
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
      <footer className="py-10" style={{ background: 'var(--ink)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <Image src="/flexa-logo.svg" alt="Flexa" width={24} height={24} />
              <span className="text-xl font-light text-white/80" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Flexa</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              {[
                { label: 'Cómo funciona', href: '#como-funciona' },
                { label: 'Precios', href: '#precios' },
                { label: 'Privacidad', href: '#' },
                { label: 'Términos', href: '#' },
                { label: 'Contacto', href: 'mailto:hola@flexa.app' },
              ].map((l) => (
                <a key={l.label} href={l.href} className="text-sm transition-opacity hover:opacity-70" style={{ color: 'rgba(255,255,255,0.4)' }}>
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
