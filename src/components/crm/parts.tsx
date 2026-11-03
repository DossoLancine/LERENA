import { cn } from '@/lib/cn'

// Petits éléments communs du CRM : étiquette colorée, initiales, ancienneté lisible.

export function TagChip({ tag, small, suffix }: { tag: { name: string; color: string }; small?: boolean; suffix?: number }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full border font-semibold', small ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs')}
      style={{ color: tag.color, borderColor: `${tag.color}40`, backgroundColor: `${tag.color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden="true" />
      {tag.name}
      {suffix != null && <span className="tabular-nums opacity-70">{suffix}</span>}
    </span>
  )
}

export function Initials({ name, size = 'md' }: { name: string | null; size?: 'md' | 'lg' }) {
  const letters = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '·'
  return (
    <span aria-hidden="true" className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fb923c] to-brand font-display font-bold text-white',
      size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-sm'
    )}>
      {letters}
    </span>
  )
}

/** « aujourd'hui », « hier », « il y a 5 jours », « il y a 3 mois ». */
export function sinceLabel(date: Date | string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400_000)
  if (days < 0) return 'bientôt'
  if (days === 0) return 'aujourd’hui'
  if (days === 1) return 'hier'
  if (days < 31) return `il y a ${days} jours`
  const months = Math.round(days / 30.4)
  if (months < 12) return `il y a ${months} mois`
  const years = Math.floor(months / 12)
  return `il y a ${years} an${years > 1 ? 's' : ''}`
}

/** Événement qui fait relire les pastilles du menu (suivis du jour, avis à traiter). */
export const COUNTS_EVENT = 'lerena:counts'
export const refreshMenuCounts = () => { try { window.dispatchEvent(new Event(COUNTS_EVENT)) } catch {} }
