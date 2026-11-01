'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { fcfa } from '@/lib/billing-labels'

// Format choisi par nom : une page serveur ne peut pas transmettre de fonction à ce composant
const FORMATS = { count: (v: number) => v.toLocaleString('fr-FR'), fcfa } as const

/**
 * Histogramme d'une seule série (pas de légende : le titre de la carte la nomme).
 * Barres fines arrondies côté valeur, grille discrète, info-bulle au survol ou au toucher, montée animée.
 */
export function BarChart({ data, unit = 'count', height = 180, label }: {
  data: { label: string; value: number; hint?: string }[]
  unit?: keyof typeof FORMATS
  height?: number
  /** Description pour les lecteurs d'écran. */
  label: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const format = FORMATS[unit]
  // Graduation « ronde » (1, 2, 5 × 10ⁿ) pour des repères lisibles et distincts
  const raw = Math.max(...data.map(d => d.value), 0)
  const step = raw > 0 ? Math.pow(10, Math.floor(Math.log10(raw))) : 1
  const max = raw > 0 ? [1, 2, 5, 10].map(m => m * step).find(v => v >= raw)! : 4
  const ticks = [0, max / 2, max]
  const empty = raw === 0
  const active = hover ?? null

  return (
    <figure className="relative" aria-label={label}>
      <div className="relative flex gap-3" style={{ height }}>
        {/* Axe des valeurs */}
        <div className="flex w-14 shrink-0 flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-ink-subtle" aria-hidden="true">
          {[...ticks].reverse().map((t, i) => <span key={i} className="-translate-y-1/2 leading-none">{empty ? '' : t >= 1000 ? `${(t / 1000).toLocaleString('fr-FR')} k` : t.toLocaleString('fr-FR')}</span>)}
        </div>
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((_, i) => <div key={i} className={cn('border-t', i === ticks.length - 1 ? 'border-gray-300' : 'border-dashed border-gray-200')} />)}
          </div>
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-1.5 sm:gap-2">
            {data.map((d, i) => (
              <button key={d.label + i} type="button" className="group relative flex h-full flex-1 items-end justify-center outline-none"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={`${d.label} : ${format(d.value)}`}>
                <span
                  className={cn('w-full max-w-[28px] origin-bottom animate-bar-grow rounded-t-[4px] transition-colors duration-200',
                    active === i ? 'bg-brand-600' : active == null ? 'bg-brand' : 'bg-brand/45')}
                  style={{ height: d.value > 0 ? `${Math.max(2, (d.value / max) * 100)}%` : '2px', animationDelay: `${i * 35}ms`, opacity: d.value > 0 ? 1 : 0.35 }}
                />
              </button>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-5 gap-1.5 sm:gap-2" aria-hidden="true">
            {data.map((d, i) => <span key={i} className={cn('flex-1 truncate text-center text-[11px] capitalize', active === i ? 'font-semibold text-ink' : 'text-ink-subtle')}>{d.label}</span>)}
          </div>
          {empty && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-ink-subtle">Aucune donnée pour l’instant</p>}
          {active != null && (
            <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full animate-pop-in rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}>
              <p className="font-semibold capitalize">{data[active].label}</p>
              <p className="tabular-nums">{format(data[active].value)}</p>
              {data[active].hint && <p className="text-white/70">{data[active].hint}</p>}
            </div>
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

/** Courbe compacte (activité sur 30 jours) : tracé de 2 px et aire très légère. */
export function Sparkline({ values, height = 56, label }: { values: number[]; height?: number; label: string }) {
  const max = Math.max(1, ...values)
  const w = 300
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, height - 4 - (v / max) * (height - 8)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="h-14 w-full" role="img" aria-label={label}>
      <path d={`${line} L${w},${height} L0,${height} Z`} className="fill-brand/10" />
      <path d={line} className="animate-fade-in fill-none stroke-brand" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
