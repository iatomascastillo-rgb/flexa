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
        {/* Logo */}
        <motion.div
          className="mb-6 flex justify-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <AnimatedLogo height={110} withText pulse />
        </motion.div>

        {/* Badge */}
        <motion.p
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest"
          style={{ background: '#EDF4ED', color: 'var(--sage)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
        >
          14 días gratis · Sin tarjeta de crédito
        </motion.p>

        {/* Headline */}
        <motion.h1
          className="mb-6 text-5xl font-light leading-[1.15] md:text-7xl"
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
          {' '}para
          <br />
          <em className="not-italic" style={{ color: 'var(--sage)' }}>tu estudio de Pilates</em>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="mx-auto mb-10 max-w-lg text-lg leading-relaxed"
          style={{ color: 'var(--stone)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.38, ease: 'easeOut' }}
        >
          Flexa automatiza reservas, pagos y te ayuda a tomar mejores decisiones con IA, sin complicaciones.
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
            style={{ background: 'white', border: '1px solid #E8E0D6', boxShadow: '0 16px 48px rgba(0,0,0,0.08)' }}
          >
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--ink)' }}>
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest">Panel admin</p>
                <p className="text-sm font-light text-white" style={{ fontFamily: 'var(--font-cormorant, serif)' }}>Centro Pilates</p>
              </div>
              <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium text-white" style={{ background: 'var(--sage)' }}>A</div>
            </div>
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
            <div className="px-4 py-4">
              <div className="mb-3 rounded-xl p-3.5" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: '#8B5CF6', fontSize: '11px' }}>✦</span>
                    <p className="text-xs font-medium" style={{ color: '#8B5CF6' }}>IA Flexa · Marzo</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>
                    ⚠ Riesgo de abandono
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--stone)' }}>
                  4 alumnas llevan más de 2 semanas sin venir. Contactarlas hoy puede recuperar al menos 2.
                </p>
              </div>
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
      </motion.div>
    </section>
  )
}
