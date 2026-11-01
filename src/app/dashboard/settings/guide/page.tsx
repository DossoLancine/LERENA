import { CheckCircle2, Lightbulb } from 'lucide-react'
import { Card } from '@/components/ui'
import { GUIDE, GUIDE_UPDATED_AT } from './content'

// Guide d'utilisation : tout ce qu'un responsable doit savoir, au même endroit
export default function GuidePage() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-lg font-bold text-ink">Guide d’utilisation</h2>
        <p className="mt-1 text-sm text-ink-muted">Mis à jour le {GUIDE_UPDATED_AT}. Touchez une rubrique pour l’ouvrir.</p>
        <nav aria-label="Sommaire du guide" className="mt-4 flex flex-wrap gap-2">
          {GUIDE.map(s => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-200">{s.title}</a>
          ))}
        </nav>
      </Card>

      <div className="stagger space-y-3">
        {GUIDE.map((s, i) => (
          <details key={s.id} id={s.id} open={i === 0} className="group scroll-mt-24 rounded-card border border-surface-line bg-white shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-semibold text-ink">
              {s.title}
              <span aria-hidden="true" className="text-ink-subtle transition-transform duration-300 group-open:rotate-180">⌄</span>
            </summary>
            <div className="space-y-4 border-t border-surface-line px-5 py-4 text-sm leading-relaxed text-ink">
              {s.intro && <p className="text-ink-muted">{s.intro}</p>}
              {s.steps && (
                <ol className="space-y-2.5">
                  {s.steps.map((step, n) => (
                    <li key={n} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand">{n + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.tips && (
                <ul className="space-y-2 rounded-2xl bg-surface-sunken p-4">
                  {s.tips.map((tip, n) => (
                    <li key={n} className="flex gap-2.5">
                      {n === 0 ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" /> : <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />}
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
