'use client'

import { useState } from 'react'
import { Check, Star } from 'lucide-react'
import { FEATURES } from '@/lib/billing-labels'
import { cn } from '@/lib/cn'
import type { getPublicPricing } from '@/server/actions/leads'

type Plan = Awaited<ReturnType<typeof getPublicPricing>>['plans'][number]
const limit = (v: number | null, unit: string) => (v == null ? `${unit} illimités` : `${v.toLocaleString('fr-FR')} ${unit}`)

/** Cartes des forfaits, avec bascule mensuel / annuel. */
export function PricingPlans({ plans }: { plans: Plan[] }) {
  const [yearly, setYearly] = useState(false)
  const maxDiscount = Math.max(0, ...plans.map(p => p.yearlyDiscountPct))
  return (
    <>
      <div className="mt-4 inline-flex rounded-full bg-white p-1 text-sm font-semibold shadow-card" role="group" aria-label="Rythme de paiement">
        {[false, true].map(y => (
          <button key={String(y)} type="button" aria-pressed={yearly === y} onClick={() => setYearly(y)} className={cn('rounded-full px-4 py-1.5 transition-all', yearly === y ? 'bg-ink text-white' : 'text-ink-muted')}>
            {y ? 'Annuel' : 'Mensuel'}{y && maxDiscount > 0 && <span className={cn('ml-1', yearly ? 'text-green-300' : 'text-success-ink')}>−{maxDiscount} %</span>}
          </button>
        ))}
      </div>
      <div className="stagger mt-5 grid gap-4 md:grid-cols-3">
        {plans.map(p => {
          const price = p.priceMonthly == null ? null : Math.round(p.priceMonthly * (yearly ? 1 - p.yearlyDiscountPct / 100 : 1))
          return (
            <article key={p.id} className={cn('lift relative flex flex-col rounded-card border bg-white p-6 shadow-card', p.highlight ? 'border-brand ring-2 ring-brand/15' : 'border-surface-line')}>
              {p.highlight && <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow"><Star size={12} /> Le plus choisi</span>}
              <h3 className="text-xl font-bold text-ink">{p.name}</h3>
              {p.tagline && <p className="text-sm text-ink-muted">{p.tagline}</p>}
              <p className="mt-4">{price == null ? <span className="text-3xl font-black text-ink">Sur devis</span> : <><span key={price} className="animate-value text-4xl font-black tabular-nums text-ink">{price.toLocaleString('fr-FR')}</span> <span className="text-sm text-ink-muted">FCFA / site / mois</span></>}</p>
              <ul className="mt-5 space-y-2 text-sm text-ink">
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxCounters, 'guichets')} par site</li>
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxTicketsMonth, 'tickets')} par mois</li>
                <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{p.smsIncluded ? `${p.smsIncluded.toLocaleString('fr-FR')} SMS inclus par mois` : 'SMS en packs'}</li>
                {p.features.map(f => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{FEATURES[f as keyof typeof FEATURES] ?? f}</li>)}
              </ul>
              <a href="#demo" className={cn('mt-auto block rounded-control pt-6 text-center')}>
                <span className={cn('block rounded-control py-3 text-sm font-bold', p.highlight ? 'bg-brand text-white shadow-sm' : 'border border-gray-200 text-ink')}>{p.priceMonthly == null ? 'Demander un devis' : 'Commencer'}</span>
              </a>
            </article>
          )
        })}
      </div>
    </>
  )
}
