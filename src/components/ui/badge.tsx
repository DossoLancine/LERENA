import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  info: 'bg-info-soft text-info-ink',
}

/** Pastille de statut. Toujours accompagnée d'un texte : la couleur seule ne porte pas l'information. */
export function Badge({ tone = 'neutral', dot, children, className }: {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}

// Statuts de ticket : libellé et couleur au même endroit pour tous les écrans
export const TICKET_STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  WAITING: { label: 'En attente', tone: 'warning' },
  CALLED: { label: 'Appelé', tone: 'brand' },
  SERVING: { label: 'En service', tone: 'info' },
  COMPLETED: { label: 'Terminé', tone: 'success' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
}

export function TicketStatusBadge({ status }: { status: string }) {
  const s = TICKET_STATUS_BADGE[status] ?? { label: status, tone: 'neutral' as const }
  return <Badge tone={s.tone}>{s.label}</Badge>
}
