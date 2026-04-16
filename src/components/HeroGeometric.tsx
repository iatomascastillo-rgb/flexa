'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { AnimatedLogo } from './AnimatedLogo'
import { AnimatedText } from '@/components/ui/animated-text'

// ── Floating shape helper ─────────────────────────────────────────────────────

interface ShapeProps {
  className?: string
  style?: React.CSSProperties
  delay?: number
  duration?: number
}

function FloatingShape({ className = '', style = {}, delay = 0, duration = 12 }: ShapeProps) {
  return (
    <motion.div
      className={`absolute pointer-events-none ${className}`}
      style={style}
      animate={{
        y: [-12, 12, -12],
        x: [-6, 6, -6],
        rotate: [-4, 4, -4],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HeroGeometric() {
  return (
    <section
      className="relative overflow-hidden mx-auto max-w-5xl px-5 py-20 text-center md:py-28"
      style={{ background: 'var(--cream)' }}
    >
      {/* Ambient background blobs */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Violet blob — top right */}
        <div
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Green blob — bottom left */}
        <div
          className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(95,125,101,0.07) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Large violet circle — top right area */}
        <FloatingShape
          className="w-64 h-64 rounded-full border"
          style={{
            top: '5%',
            right: '-4%',
            borderColor: 'rgba(139,92,246,0.08)',
            background: 'rgba(139,92,246,0.04)',
          }}
          delay={0}
          duration={14}
        />
        {/* Small green circle — top left */}
        <FloatingShape
          className="w-24 h-24 rounded-full"
          style={{
            top: '12%',
            left: '4%',
            background: 'rgba(95,125,101,0.07)',
          }}
          delay={2}
          duration={10}
        />
        {/* Diagonal rectangle — bottom right */}
        <FloatingShape
          className="w-40 h-40 rounded-3xl"
          style={{
            bottom: '8%',
            right: '6%',
            background: 'rgba(139,92,246,0.05)',
            transform: 'rotate(15deg)',
          }}
          delay={4}
          duration={16}
        />
        {/* Small violet diamond — left center */}
        <FloatingShape
          className="w-14 h-14 rounded-xl"
          style={{
            top: '45%',
            left: '2%',
            background: 'rgba(139,92,246,0.06)',
            transform: 'rotate(45deg)',
          }}
          delay={1}
          duration={9}
        />
        {/* Green pill — bottom left area */}
        <FloatingShape
          className="w-32 h-12 rounded-full"
          style={{
            bottom: '20%',
            left: '8%',
            background: 'rgba(95,125,101,0.06)',
          }}
          delay={3}
          duration={13}
        />
        {/* Tiny violet circle — center right */}
        <FloatingShape
          className="w-10 h-10 rounded-full border"
          style={{
            top: '35%',
            right: '10%',
            borderColor: 'rgba(139,92,246,0.1)',
          }}
          delay={5}
          duration={8}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10">
        {/* Logo — más pequeño en mobile */}
        <motion.div
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <span className="md:hidden"><AnimatedLogo height={72} withText pulse /></span>
          <span className="hidden md:inline-flex"><AnimatedLogo height={110} withText pulse /></span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="mb-6 text-[2.4rem] font-light leading-[1.2] sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
        >
          <AnimatedText
            text="Gestión inteligente"
            as="span"
            textClassName="font-bold text-[#8B5CF6]"
            duration={0.04}
            delay={0.02}
          />
          <br />
          <em className="not-italic" style={{ color: 'var(--sage)' }}>para tu estudio de Pilates</em>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mb-10 max-w-lg text-lg leading-relaxed"
          style={{ color: 'var(--stone)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.38, ease: 'easeOut' }}
        >
          <strong style={{ color: '#8B5CF6', fontWeight: 700 }}>Flexa</strong> automatiza reservas, pagos y te ayuda a tomar mejores decisiones con IA, sin complicaciones.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
        >
          <Link
            href="/registro"
            className="rounded-full px-8 py-4 text-base font-medium transition-all hover:opacity-85 active:scale-95"
            style={{ background: '#5F7D65', color: 'white' }}
          >
            Crear mi estudio gratis →
          </Link>
          <a
            href="#como-funciona"
            className="rounded-full px-8 py-4 text-base font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--stone)' }}
          >
            Ver cómo funciona
          </a>
        </motion.div>

        {/* Founder subtext */}
        <motion.div
          className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm"
          style={{ background: 'var(--ink)', color: 'rgba(255,255,255,0.75)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.65, ease: 'easeOut' }}
        >
          <span>Unite como</span>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.35)', fontWeight: 700 }}
          >
            ✦ Miembro Fundador
          </span>
          <span>y congelá tu precio con</span>
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: '#F59E0B', color: '#1C1400' }}
          >
            50% OFF por un año
          </span>
        </motion.div>
      </div>

      {/* ── Mockups ── */}
      <motion.div
        className="relative z-10 mx-auto mt-16 flex flex-col items-center gap-6 md:flex-row md:items-end md:justify-center md:gap-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.65, ease: 'easeOut' }}
      >
        {/* Phone: vista alumno */}
        <div className="w-52 shrink-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Vista alumno</p>
          <div
            className="overflow-hidden rounded-[1.8rem] p-1"
            style={{ background: '#2C2C2C', boxShadow: '0 16px 48px rgba(0,0,0,0.12)' }}
          >
            <div className="overflow-hidden rounded-[1.5rem]" style={{ background: 'var(--cream)' }}>
              {/* Status bar */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ background: 'var(--sage)' }}>
                <span className="text-xs text-white/60">9:41</span>
                <span className="text-sm font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Mi Pilates</span>
                <span className="text-xs text-white/60">●●</span>
              </div>
              <div className="px-3 py-3 space-y-2.5">
                {/* Créditos */}
                <div className="rounded-xl p-3" style={{ background: 'var(--sage)' }}>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-widest text-white/60">Créditos</p>
                      <p className="text-4xl font-light text-white leading-none mt-0.5" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>8</p>
                    </div>
                    <p className="text-xs text-white/50 mb-0.5">Vencen 15/05</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/20">
                    <div className="h-full w-2/3 rounded-full bg-white/60" />
                  </div>
                </div>
                {/* Noticias */}
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Noticias</p>
                  <div className="rounded-xl px-2.5 py-2 flex items-start gap-2" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <span style={{ color: '#8B5CF6', fontSize: '11px', marginTop: '1px' }}>✦</span>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--ink)' }}>Nueva clase de Reformer agregada para el martes a las 18hs.</p>
                  </div>
                </div>
                {/* Próximas reservas */}
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Mis reservas</p>
                  {[
                    { name: 'Pilates Mat', date: 'Mañana · 10:00' },
                    { name: 'Reformer', date: 'Jue · 18:00' },
                  ].map((c, i) => (
                    <div key={i} className="mb-1.5 flex items-center justify-between rounded-xl px-2.5 py-2" style={{ background: 'white', border: '1px solid #E8E0D6' }}>
                      <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{c.name}</p>
                      <p className="text-xs" style={{ color: 'var(--stone)' }}>{c.date}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card: vista admin */}
        <div className="w-72 shrink-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Vista admin</p>
          <div
            className="overflow-hidden rounded-2xl"
            style={{ background: 'white', border: '1px solid #E8E0D6', boxShadow: '0 16px 48px rgba(0,0,0,0.08)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--ink)' }}>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest">Panel admin</p>
                <p className="text-sm font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Centro Pilates</p>
              </div>
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: 'var(--sage)' }}>A</div>
            </div>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-px" style={{ background: '#E8E0D6' }}>
              {[
                { label: 'Alumnas', value: '42' },
                { label: 'Este mes', value: '$180k' },
                { label: 'Ocupación', value: '78%' },
              ].map((s, i) => (
                <div key={i} className="px-3 py-2.5 text-center" style={{ background: 'var(--cream)' }}>
                  <p className="text-base font-light" style={{ fontFamily: 'var(--font-cormorant, serif)', color: 'var(--ink)' }}>{s.value}</p>
                  <p className="text-xs" style={{ color: 'var(--stone)' }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div className="px-4 py-3">
              {/* Line chart — facturación mensual */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--stone)' }}>Facturación mensual</p>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#DCFCE7', color: '#166534' }}>↑ +89%</span>
              </div>
              <div className="mb-1">
                <svg viewBox="0 0 240 56" className="w-full" style={{ overflow: 'visible' }}>
                  {/* Grid lines */}
                  <line x1="0" y1="5" x2="240" y2="5" stroke="#E8E0D6" strokeWidth="0.5" />
                  <line x1="0" y1="30" x2="240" y2="30" stroke="#E8E0D6" strokeWidth="0.5" />
                  <line x1="0" y1="55" x2="240" y2="55" stroke="#E8E0D6" strokeWidth="0.5" />
                  {/* Area fill */}
                  <polygon
                    points="0,55 48,47 96,39 144,43 192,22 240,5 240,55"
                    fill="rgba(92,122,94,0.1)"
                  />
                  {/* Line */}
                  <polyline
                    points="0,55 48,47 96,39 144,43 192,22 240,5"
                    fill="none"
                    stroke="#5C7A5E"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Last point dot */}
                  <circle cx="240" cy="5" r="2.5" fill="#5C7A5E" />
                  {/* Last value label */}
                  <text x="232" y="2" fontSize="7" fill="#5C7A5E" textAnchor="end" fontWeight="600">$180k</text>
                  {/* Month labels */}
                  {['Ene','Feb','Mar','Abr','May','Jun'].map((m, i) => (
                    <text key={m} x={i * 48} y="56" fontSize="7" fill="#8C7B6B" textAnchor="middle">{m}</text>
                  ))}
                </svg>
              </div>
              {/* IA alert */}
              <div className="rounded-xl p-3" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span style={{ color: '#8B5CF6', fontSize: '11px' }}>✦</span>
                  <p className="text-xs font-medium" style={{ color: '#8B5CF6' }}>IA Flexa · Abril</p>
                </div>
                <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  ⚠ Riesgo de abandono
                </span>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
                  3 alumnas sin reservas y 2 con ausencias repetidas. Contactarlas hoy puede recuperar al menos 3.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
