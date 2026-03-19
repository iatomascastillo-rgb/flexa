'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedLogoProps {
  height?: number
  withText?: boolean
  pulse?: boolean
  className?: string
}

// El PNG mide 2272 × 1884. La F ocupa ~57% superior, FLEXA el ~43% inferior.
const PNG_W = 2272
const PNG_H = 1884
const ICON_RATIO = 0.57

/**
 * Procesa el PNG en un canvas y hace transparentes todos los píxeles
 * que sean claros Y con baja saturación (= el checkerboard blanco/gris).
 * Los colores del logo (morado) y el texto negro se preservan.
 */
function removeLightBackground(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    const sat = max === min ? 0 : (max - min) / (lightness > 127 ? 510 - max - min : max + min)

    // Pixel claro + sin saturación → checkerboard → transparente
    if (lightness > 160 && sat < 0.25) {
      data[i + 3] = 0
    }
  }

  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0)
  return canvas
}

export function AnimatedLogo({ height = 40, withText = false, pulse = false, className }: AnimatedLogoProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = removeLightBackground(img)
      setDataUrl(canvas.toDataURL('image/png'))
    }
    img.src = '/flexa-logo-full.png'
  }, [])

  // Dimensiones del contenedor
  const imgAspect = PNG_W / PNG_H
  const containerW = withText
    ? Math.round(height * imgAspect)
    : Math.round(height * imgAspect * ICON_RATIO)

  // Para modo ícono: escalamos la imagen más alta y dejamos que overflow:hidden corte el texto
  const renderH = withText ? height : Math.round(height / ICON_RATIO)
  const renderW = Math.round(renderH * imgAspect)

  return (
    <>
      <style>{`
        @keyframes flexa-in {
          from { opacity: 0; transform: scale(0.82) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes flexa-beat {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.05); }
        }
        .flexa-logo {
          animation: flexa-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
          display: inline-flex;
          align-items: flex-start;
          overflow: hidden;
          transition: transform 0.2s ease, filter 0.2s ease;
          flex-shrink: 0;
        }
        .flexa-logo:hover {
          transform: scale(1.06);
          filter: drop-shadow(0 4px 14px rgba(147, 51, 234, 0.4));
        }
        .flexa-logo.pulse {
          animation: flexa-in 0.65s cubic-bezier(0.16, 1, 0.3, 1) both,
                     flexa-beat 3.2s ease-in-out 0.8s infinite;
        }
      `}</style>

      <span
        ref={containerRef}
        className={`flexa-logo${pulse ? ' pulse' : ''}${className ? ` ${className}` : ''}`}
        style={{ width: containerW, height }}
      >
        {dataUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="Flexa"
            width={renderW}
            height={renderH}
            style={{ display: 'block', flexShrink: 0 }}
          />
        )}
      </span>
    </>
  )
}
