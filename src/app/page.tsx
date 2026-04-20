import Link from 'next/link'
import { HowItWorks } from '@/components/HowItWorks'
import { AnimatedLogo } from '@/components/AnimatedLogo'
import { HeroGeometric } from '@/components/HeroGeometric'
import { BeamsBackground } from '@/components/ui/beams-background'
import { AIInsightsCarousel } from '@/components/AIInsightsCarousel'
import { AnimatedText } from '@/components/ui/animated-text'
import { PricingSection } from '@/components/PricingSection'

// ── Datos ──────────────────────────────────────────────────────────────────────



const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" />
      </svg>
    ),
    title: 'Reservas online 24/7',
    body: 'Tus alumnas reservan y cancelan desde el celular, en cualquier momento.',
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
]

const AI_INSIGHTS = [
  {
    tag: 'Resumen del mes',
    title: 'Tu estudio en números',
    quote: 'La facturación creció un 18% respecto al mes anterior. La clase de Reformer del martes a las 18hs es tu turno estrella con 95% de ocupación.',
  },
  {
    tag: 'Tu agenda',
    title: 'Qué ajustar para ganar más',
    quote: 'El turno del lunes a las 10:00 tiene solo 3 inscriptas. Correrlo a las 10:30 lo une con el grupo de las 11:00, reduce un turno vacío y no perdés ninguna alumna.',
  },
  {
    tag: 'Alumnas que se alejan',
    title: 'Quién está perdiendo el ritmo',
    quote: 'Carla F. lleva 16 días sin reservar y tiene 4 créditos activos. Paula M. faltó 3 veces seguidas sin avisar. Ambas venían 2 veces por semana. Un mensaje hoy tiene alta probabilidad de recuperarlas — después de los 20 días el patrón de abandono se consolida.',
  },
  {
    tag: 'Asistencia',
    title: 'Ausencias que no avisaron',
    quote: '4 alumnas faltaron 3 clases seguidas sin cancelar. No significa que se van — pero sí que algo pasó. Vale la pena escribirles antes de que el vínculo se enfríe.',
  },
]

const CUSTOMIZATIONS = [
  { title: 'Gestión de ausencias', body: 'Definís qué pasa cuando una alumna falta sin cancelar: registro automático, alerta para vos, o ambas.' },
  { title: 'Política de cancelación', body: 'Configurás con cuántas horas de anticipación se puede cancelar. Si cancela fuera de ese plazo, el crédito se descuenta igual.' },
  { title: 'Branding propio', body: 'Colores, logo y nombre del estudio. Tus alumnas ven tu marca, no la nuestra.' },
  { title: 'Tipos de clase y cupos', body: 'Reformer, Mat, Duet, grupal. Cada tipo con su capacidad y sus reglas.' },
  { title: 'Paquetes a medida', body: 'Definís la cantidad de clases, el precio y el vencimiento de cada paquete.' },
  { title: 'Recurrencia semanal', body: 'El mes siguiente se genera solo: mismos horarios, respetando feriados. Una de las funciones más pedidas por los estudios que usan Flexa.' },
]


const TESTIMONIALS_PLACEHOLDER = [
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
    quote: 'Los días de acceso sin crédito fueron clave para mí. Antes perdía alumnas por no tener flexibilidad. Ahora cada estudio lo maneja a su manera y el sistema lo controla solo.',
  },
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
    q: '¿Qué son los días de acceso sin crédito?',
    a: 'Es el tiempo que una alumna puede seguir asistiendo después de quedarse sin créditos. Vos definís cuántos días permite tu estudio y qué pasa al vencimiento: Flexa puede bloquear el acceso automáticamente o mandarte una alerta para que lo gestiones vos.',
  },
  {
    q: '¿En qué consiste el análisis inteligente?',
    a: 'Flexa analiza los datos de tu estudio (reservas, pagos, asistencia) con inteligencia artificial y te genera diagnósticos en palabras simples: qué funciona, qué alumnas están por irse y qué ajustes podés hacer. El plan Pro usa Claude Sonnet, el modelo más avanzado de Anthropic, para análisis más ricos y detallados. El plan Básico incluye una versión de prueba del análisis de IA.',
  },
  {
    q: '¿Qué incluye el panel financiero?',
    a: 'El panel financiero (Plan Pro) muestra seis métricas calculadas automáticamente: cuánta plata ya cobraste por paquetes activos, qué alumnas están en riesgo de irse y cuánto representan, si ganaste o perdiste en el mes (comparando ingresos vs. costos fijos), cuánto vale cada alumna en promedio, una proyección de lo que vas a cobrar en los próximos 3 meses, y qué te deja cada tipo de clase. Para las métricas de costos necesitás cargar el alquiler, instructores y gastos fijos del mes — lo hacés desde el mismo panel en un par de pasos.',
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

      {/* ── Announcement Bar ── */}
      <div className="w-full py-2.5 px-5 text-center text-sm" style={{ background: 'var(--ink)', color: 'white' }}>
        <span>🚀 <strong>¡LANZAMIENTO FLEXA!</strong> 50% OFF en el plan anual (Miembros Fundadores).{' '}</span>
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: 'rgba(139,92,246,0.25)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.4)' }}>
          ÚLTIMOS 10 CUPOS
        </span>
      </div>

      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ background: 'rgba(247,243,238,0.95)', backdropFilter: 'blur(12px)', borderColor: '#E8E0D6' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <div className="flex items-center">
            <AnimatedLogo height={42} />
          </div>
          <nav className="flex items-center gap-1">
            {/* Links de sección — solo desktop */}
            <a href="#como-funciona" className="hidden md:inline-block rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              Cómo funciona
            </a>
            <a href="#precios" className="hidden md:inline-block rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              Precios
            </a>
            <a href="#ia" className="hidden md:inline-block rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              IA
            </a>
            <a href="#financiero" className="hidden md:inline-block rounded-xl px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              Finanzas
            </a>
            {/* Separador */}
            <span className="hidden md:block mx-2 h-4 w-px" style={{ background: '#D1C9C0' }} />
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--stone)' }}>
              Iniciar sesión
            </Link>
            <Link href="/registro" className="rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-85" style={{ background: 'var(--sage)', color: 'white' }}>
              Empezar gratis
            </Link>
          </nav>
        </div>
        {/* Mobile quick nav */}
        <div className="md:hidden flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide" style={{ borderTop: '1px solid #E8E0D6' }}>
          {[
            { label: 'Cómo funciona', href: '#como-funciona' },
            { label: 'Precios', href: '#precios' },
            { label: 'IA', href: '#ia' },
            { label: 'Finanzas', href: '#financiero' },
            { label: 'Contacto', href: '#contacto' },
          ].map((l) => (
            <a key={l.label} href={l.href} className="shrink-0 rounded-full px-3 py-1 mt-2 text-xs font-medium transition-opacity hover:opacity-70" style={{ background: 'white', color: 'var(--stone)', border: '1px solid #E8E0D6' }}>
              {l.label}
            </a>
          ))}
        </div>
      </header>

      {/* ── Hero ── */}
      <HeroGeometric />



      {/* ── Cómo funciona (interactivo) ── */}
      <section id="como-funciona" className="py-20" style={{ background: 'var(--cream)' }}>
        <div className="mx-auto max-w-5xl px-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--sage)' }}>
            Cómo funciona
          </p>
          <h2
            className="mb-4 text-center text-3xl font-light md:text-5xl"
            style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)', textWrap: 'balance' } as React.CSSProperties}
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
            Todo en{' '}
            <em className="not-italic" style={{ color: 'var(--sage)' }}>un solo lugar</em>
          </h2>
          <p className="mx-auto mb-14 max-w-md text-center text-base" style={{ color: 'var(--stone)' }}>
            Flexa automatiza la gestión para que puedas enfocarte en lo que hacés bien: enseñar.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 md:max-w-2xl md:mx-auto">
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
      <div id="ia">
      <BeamsBackground intensity="medium">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <div className="mb-16 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{ background: 'rgba(155,109,255,0.18)', color: '#9B6DFF', border: '1px solid rgba(155,109,255,0.3)' }}
              >
                ✦ Inteligencia Artificial
              </span>
            </div>
            <h2
              className="mb-4 text-3xl font-light text-white sm:text-4xl md:text-5xl"
              style={{ fontFamily: 'var(--font-cormorant, serif)' }}
            >
              Tu estudio genera datos.
              <br />
              <span className="block">
                <AnimatedText
                  text="La IA los convierte"
                  as="em"
                  className="not-italic"
                  textClassName="text-[#9B6DFF] font-bold"
                  duration={0.04}
                  delay={0.02}
                />
              </span>
              <span className="block">
                <AnimatedText
                  text="en decisiones."
                  as="em"
                  className="not-italic"
                  textClassName="text-[#9B6DFF] font-bold"
                  duration={0.04}
                  delay={0.9}
                />
              </span>
            </h2>
            <p className="mx-auto max-w-lg text-base text-white/60">
              Cada mes, la inteligencia artificial de Flexa analiza reservas, pagos y asistencia,
              y genera un diagnóstico en palabras simples: qué está pasando, por qué, y qué hacer.
            </p>
          </div>

          <AIInsightsCarousel insights={AI_INSIGHTS} />

          <p className="mt-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Diagnósticos generados automáticamente con IA cada mes · Disponible en Plan Pro
          </p>
        </div>
      </BeamsBackground>
      </div>

      {/* ── Dashboard Financiero ── */}
      <section id="financiero" className="py-24" style={{ background: '#0D1A12' }}>
        <div className="mx-auto max-w-5xl px-5">
          <div className="mb-14 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                style={{ background: 'rgba(74,169,106,0.18)', color: '#4AA96A', border: '1px solid rgba(74,169,106,0.3)' }}
              >
                💰 Dashboard Financiero · Plan Pro
              </span>
            </div>
            <h2
              className="mb-4 text-3xl font-light text-white sm:text-4xl md:text-5xl"
              style={{ fontFamily: 'var(--font-cormorant, serif)' }}
            >
              No solo ves lo que pasó.
              <br />
              <em className="not-italic font-semibold" style={{ color: '#4AA96A' }}>
                Sabés lo que viene.
              </em>
            </h2>
            <p className="mx-auto max-w-lg text-base" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Flexa calcula automáticamente cuánto dinero ya tenés comprometido, qué alumnas están en
              riesgo de irse, y cuánto vas a cobrar el mes que viene — sin planillas ni cuentas manuales.
            </p>
          </div>

          {/* Cards de preview con datos de ejemplo */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <p className="mb-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                💰 Plata ya cobrada
              </p>
              <p className="mb-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Clases pagas, aún no dadas
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">$148.500</p>
              <p className="mt-1 text-xs" style={{ color: '#4AA96A' }}>+12% vs mes anterior</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                23 paquetes · 4 clases promedio
              </p>
            </div>

            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <p className="mb-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ⚠️ Podés perder
              </p>
              <p className="mb-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Alumnas que se están yendo
              </p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: '#d97706' }}>$32.000</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>4 alumnas en riesgo</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Carla F., Paula M. +2 más
              </p>
            </div>

            <div
              className="rounded-2xl px-5 py-5"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <p className="mb-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>
                🔮 Próximo mes
              </p>
              <p className="mb-0.5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Proyección de cobros
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">$126.000</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>proyectado</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Basado en 72% de renovación
              </p>
            </div>
          </div>

          {/* Más métricas en fila secundaria */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
                📊 Resultado del mes — con costos cargados
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Ingresaste $95.000 · Gastaste $68.000</p>
                  <p className="mt-1 text-lg font-semibold" style={{ color: '#4AA96A' }}>Ganaste $27.000</p>
                </div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Necesitabas 34 clases para cubrir costos
                </p>
              </div>
            </div>
            <div
              className="rounded-2xl px-5 py-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="mb-2 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>
                📋 Qué te deja cada tipo de clase
              </p>
              <div className="space-y-1">
                {[
                  { name: 'Reformer', margin: '+$3.200' },
                  { name: 'Mat grupal', margin: '+$1.800' },
                  { name: 'Duet', margin: '+$4.100' },
                ].map((c) => (
                  <div key={c.name} className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{c.name}</p>
                    <p className="text-xs font-medium" style={{ color: '#4AA96A' }}>{c.margin}/clase</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-10 text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Datos calculados automáticamente cada hora · Disponible en Plan Pro
          </p>
        </div>
      </section>

      {/* ── Personalización ── */}
      <section className="pt-20 pb-10" style={{ background: 'var(--cream)' }}>
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
                <em className="not-italic font-semibold" style={{ color: 'var(--terracotta)' }}>Flexa se adapta al tuyo.</em>
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

      {/* ── Por qué Flexa / Comparación (oculto hasta tener data real) ── */}

      {/* ── Testimoniales (ocultos hasta tener resultados reales) ── */}

      {/* ── Precios ── */}
      <PricingSection />

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
      <section id="contacto" className="py-20" style={{ background: 'var(--cream)' }}>
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
            Nuestro equipo está disponible para resolver cualquier duda que tengas.
            Si algo no funciona como esperás, lo resolvemos con vos.
          </p>
          <div className="flex justify-center">
            <a
              href="https://wa.me/5491156972644?text=Hola%2C%20estoy%20interesado%20en%20Flexa!"
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
            <br />gratis por 30 días
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
            <div className="flex items-center">
              <AnimatedLogo height={34} />
            </div>
            <nav className="flex flex-wrap justify-center gap-6">
              {[
                { label: 'Cómo funciona', href: '#como-funciona' },
                { label: 'Precios', href: '#precios' },
                { label: 'IA', href: '#ia' },
                { label: 'Privacidad', href: '#' },
                { label: 'Términos', href: '#' },
                { label: 'Contacto', href: 'https://wa.me/5491156972644?text=Hola%2C%20estoy%20interesado%20en%20Flexa!' },
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
