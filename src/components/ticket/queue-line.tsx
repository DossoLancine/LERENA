import { cn } from '@/lib/cn'

/**
 * Ligne de file : les personnes devant vous, puis vous (en orange).
 * Quand quelqu'un passe, la ligne avance avec un petit glissement.
 */
export function QueueLine({ ahead, className }: { ahead: number; className?: string }) {
  const shown = Math.min(ahead, 7)
  const more = ahead - shown
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)} role="img" aria-label={ahead === 0 ? 'Personne devant vous' : `${ahead} personne${ahead > 1 ? 's' : ''} devant vous`}>
      {/* Le guichet */}
      <span className="mr-1 flex h-7 items-center rounded-lg bg-ink px-2 text-[10px] font-bold uppercase tracking-wider text-white">Guichet</span>
      <span key={ahead} className="animate-queue-step flex items-center gap-1.5">
        {more > 0 && <span className="text-xs font-semibold text-ink-subtle">+{more}</span>}
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="h-3 w-3 rounded-full bg-gray-300" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
        <span className="relative flex h-5 w-5 items-center justify-center" style={{ animationDelay: `${shown * 40}ms` }}>
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
          <span className="relative h-5 w-5 rounded-full bg-brand ring-4 ring-brand/20" />
        </span>
      </span>
      <span className="ml-1 text-xs font-bold text-brand">Vous</span>
    </div>
  )
}
