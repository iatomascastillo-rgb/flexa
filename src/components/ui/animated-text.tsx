'use client'

import { motion, useInView } from 'framer-motion'
import { useRef, ElementType, Fragment } from 'react'

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

  // Split by words. Each word animates letter-by-letter but wraps as a unit.
  // Between words: regular space (= valid line-break opportunity for the browser).
  const words = text.split(' ')
  let globalIndex = 0

  return (
    <Tag ref={ref as never} className={`inline ${className}`}>
      <span className={`inline ${textClassName}`} aria-label={text}>
        {words.map((word, wi) => {
          const wordStart = globalIndex
          globalIndex += word.length + 1 // +1 accounts for the space separator
          return (
            <Fragment key={wi}>
              {/* Regular space between words — allows the browser to wrap here */}
              {wi > 0 && ' '}
              {/* Each word is inline-block so it won't break mid-word */}
              <span className="inline-block whitespace-nowrap">
                {word.split('').map((char, ci) => {
                  const li = wordStart + ci
                  return (
                    <motion.span
                      key={ci}
                      className="inline-block"
                      initial={{ opacity: 0, y: 8 }}
                      animate={isInView ? { opacity: 1, y: 0 } : {}}
                      transition={{
                        duration: 0.28,
                        delay: delay + li * duration,
                        ease: [0.25, 0.1, 0.25, 1],
                      }}
                      aria-hidden="true"
                    >
                      {char}
                    </motion.span>
                  )
                })}
              </span>
            </Fragment>
          )
        })}
      </span>
    </Tag>
  )
}
