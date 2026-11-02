'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, PartyPopper, Rocket, X } from 'lucide-react'
import { getOnboarding } from '@/server/actions/onboarding'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getOnboarding>>>
const HIDE_KEY = (orgId: string) => `lerena:onboarding-hidden:${orgId}`

/** Assistant de démarrage du tableau de bord : progression, étape suivante mise en avant, masquable une fois prêt. */
export function OnboardingChecklist() {
  const [data, setData] = useState<Data | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    getOnboarding().then(d => {
      setData(d)
      try { setHidden(!!d && localStorage.getItem(HIDE_KEY(d.orgId)) === '1') } catch { setHidden(false) }
    }).catch(() => null)
  }, [])

  if (!data || hidden) return null
  const total = data.steps.length
  const complete = data.done === total
  const next = data.steps.find(s => !s.done)
  const pct = Math.round((data.done / total) * 100)
  const hide = () => { try { localStorage.setItem(HIDE_KEY(data.orgId), '1') } catch {} setHidden(true) }

  return (
    <section aria-label="Démarrage" className="animate-rise-in overflow-hidden rounded-card border border-brand/20 bg-gradient-to-br from-brand-50 via-white to-white shadow-card">
      <div className="flex items-start gap-4 p-5">
        {/* Anneau de progression */}
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-brand/15" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-brand transition-[stroke-dashoffset] duration-1000 ease-spring" strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={97.4} strokeDashoffset={97.4 * (1 - data.done / total)} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold text-ink">{complete ? <><PartyPopper size={18} className="text-brand" /> Tout est prêt !</> : <><Rocket size={18} className="text-brand" /> Démarrage : {data.done} étape{data.done > 1 ? 's' : ''} sur {total}</>}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{complete ? 'Votre établissement est configuré. Vous pouvez masquer ce guide.' : next ? <>Prochaine étape : <strong className="text-ink">{next.title}</strong> — {next.text}.</> : null}</p>
        </div>
        {next && <Link href={next.href} className="hidden shrink-0 items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 sm:inline-flex">Continuer <ArrowRight size={15} /></Link>}
        <button type="button" onClick={hide} aria-label="Masquer le guide de démarrage" title="Masquer" className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-subtle hover:bg-gray-100 hover:text-ink"><X size={16} /></button>
      </div>
      <ol className="stagger grid gap-1.5 border-t border-brand/10 p-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.steps.map((s, i) => (
          <li key={s.id}>
            <Link href={s.href} className={cn('group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
              s.done ? 'text-ink-muted' : s === next ? 'bg-white text-ink shadow-sm ring-1 ring-brand/30' : 'text-ink hover:bg-white')}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ease-spring',
                s.done ? 'scale-100 bg-success text-white' : 'bg-white text-ink-muted ring-1 ring-gray-200 group-hover:ring-brand')}>
                {s.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('min-w-0 truncate', s.done && 'line-through decoration-ink-subtle/50')}>{s.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
