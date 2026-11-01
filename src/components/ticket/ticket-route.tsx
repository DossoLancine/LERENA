import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Étapes déjà faites puis étape en cours : « Secrétariat ✓ → Caisse ».
 * Rien n'est affiché tant que le client n'a pas changé de service.
 */
export function TicketRoute({ route, current, dark = false, className }: {
  route?: { step: number; done: string[] } | null
  current: string
  dark?: boolean
  className?: string
}) {
  if (!route || route.step <= 1) return null
  return (
    <div className={cn('animate-rise-in', className)} aria-label={`Étape ${route.step} : ${current}`}>
      <p className={cn('text-xs font-bold uppercase tracking-wider', dark ? 'text-white/60' : 'text-brand')}>Étape {route.step}</p>
      <ol className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        {route.done.map((name, i) => (
          <li key={i} className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', dark ? 'bg-white/10 text-white/70' : 'bg-success-soft text-success-ink')}>
            <Check size={12} aria-hidden="true" /> {name}
            <span className="sr-only">(terminé)</span>
          </li>
        ))}
        <li className={cn('rounded-full px-2.5 py-1 font-bold', dark ? 'bg-brand text-white' : 'bg-brand text-white')}>
          {current} <span className="sr-only">(en cours)</span>
        </li>
      </ol>
    </div>
  )
}
