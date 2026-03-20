'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

interface Insight {
  tag: string
  title: string
  quote: string
}

export function AIInsightsCarousel({ insights }: { insights: Insight[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <div ref={ref} className="grid gap-6 md:grid-cols-3">
      {insights.map((insight, i) => (
        <motion.div
          key={i}
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
          }}
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.55,
            delay: i * 0.15,
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'rgba(155,109,255,0.18)', color: '#9B6DFF' }}
            >
              {insight.tag}
            </span>
            <span className="text-xs" style={{ color: 'rgba(155,109,255,0.45)' }}>✦ IA</span>
          </div>

          <h3
            className="mb-3 text-xl font-light text-white"
            style={{ fontFamily: 'var(--font-cormorant, serif)' }}
          >
            {insight.title}
          </h3>

          <p
            className="text-sm leading-relaxed italic"
            style={{
              color: 'rgba(255,255,255,0.5)',
              borderLeft: '2px solid rgba(155,109,255,0.35)',
              paddingLeft: '12px',
            }}
          >
            &ldquo;{insight.quote}&rdquo;
          </p>
        </motion.div>
      ))}
    </div>
  )
}
