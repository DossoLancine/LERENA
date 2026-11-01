'use client'

import { useEffect, useState } from 'react'
import { AnimatedNumber } from '@/components/ui/animated-number'

/**
 * Anneau de progression autour du nombre de personnes devant le client (0 = il est le prochain).
 * L'anneau se remplit au fil de l'avancée de la file, le chiffre change en douceur.
 */
export function ProgressRing({ position, progress, waitLabel }: {
  position: number
  progress: number // 0 à 100
  waitLabel: string
}) {
  const size = 220
  const stroke = 14
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const target = circumference * (1 - Math.min(100, Math.max(0, progress)) / 100)
  // L'anneau se remplit à l'ouverture du ticket, puis suit la progression
  const [offset, setOffset] = useState(circumference)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(target))
    return () => cancelAnimationFrame(id)
  }, [target])

  // Petit rebond du chiffre quand la position change
  const [bump, setBump] = useState(false)
  useEffect(() => {
    setBump(true)
    const t = setTimeout(() => setBump(false), 320)
    return () => clearTimeout(t)
  }, [position])

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFEDD5" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#ring-gradient)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.32, 0.72, 0, 1)' }}
        />
        <defs>
          <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="text-6xl font-black text-gray-900 tabular-nums leading-none"
          style={{ transform: bump ? 'scale(1.15)' : 'scale(1)', transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          <AnimatedNumber value={position} duration={500} />
        </span>
        <span className="mt-2 text-xs font-medium text-gray-500">
          {position === 0 ? 'vous êtes le prochain' : `personne${position > 1 ? 's' : ''} devant vous`}
        </span>
        <span className="mt-3 rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-600">{waitLabel}</span>
      </div>
    </div>
  )
}
