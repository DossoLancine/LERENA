'use client'

import { useEffect, useRef, useState } from 'react'

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Nombre qui glisse jusqu'à sa nouvelle valeur : on voit qu'il a changé, et dans quel sens.
 * Au premier affichage il part de zéro ; avec « mouvement réduit », il change sans animation.
 */
export function AnimatedNumber({ value, duration = 600, decimals = 0, className }: {
  value: number
  duration?: number
  decimals?: number
  className?: string
}) {
  const [display, setDisplay] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || from.current === value) {
      from.current = value
      setDisplay(value)
      return
    }
    const start = performance.now()
    const origin = from.current
    let frame = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setDisplay(origin + (value - origin) * easeOut(p))
      if (p < 1) frame = requestAnimationFrame(tick)
      else from.current = value
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      from.current = value
    }
  }, [value, duration])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  )
}
