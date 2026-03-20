'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, ElementType } from 'react'

interface AnimatedTextProps {
  text: string
  as?: ElementType
  className?: string
  textClassName?: string
  duration?: number
  delay?: number
}

export function AnimatedText({
  text,
  as: Tag = 'span',
  className = '',
  textClassName = '',
  duration = 0.04,
  delay = 0.02,
}: AnimatedTextProps) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  const letters = text.split('')

  return (
    // inline (not inline-block) so text wraps naturally at word boundaries
    <Tag ref={ref as never} className={`inline ${className}`}>
      <span className={`inline ${textClassName}`} aria-label={text}>
        {letters.map((char, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={{ opacity: 0, y: 8 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.28,
              delay: delay + i * duration,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            aria-hidden="true"
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        ))}
      </span>
    </Tag>
  )
}
