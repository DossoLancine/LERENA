import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'
import { INVOICE_STATUS, STATE_LABELS } from '@/lib/billing-labels'
import { cn } from '@/lib/cn'

/** État de l'abonnement (essai, actif, en retard, suspendu, résilié), avec les jours restants. */
export function StateBadge({ state, daysLeft }: { state: keyof typeof STATE_LABELS; daysLeft?: number | null }) {
  const [label, tone] = STATE_LABELS[state]
  const days = daysLeft != null && (state === 'TRIAL' || state === 'GRACE') ? ` · ${daysLeft} j` : ''
  return <Badge tone={tone} dot>{label}{days}</Badge>
}

export function InvoiceBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  if (overdue) return <Badge tone="danger" dot>En retard</Badge>
  const [label, tone] = INVOICE_STATUS[status as keyof typeof INVOICE_STATUS] ?? [status, 'neutral']
  return <Badge tone={tone}>{label}</Badge>
}

/** En-tête de page des espaces de gestion : titre, sous-titre et actions alignées à droite. */
export function PageHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3 pb-1', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Jauge de consommation (tickets, SMS, guichets) : la couleur change à 80 % puis à 100 %. */
export function UsageMeter({ label, used, max, unit = '' }: { label: string; used: number; max: number | null; unit?: string }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  const tone = !max ? 'bg-success' : pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-brand'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{used.toLocaleString('fr-FR')}{unit} <span className="font-normal text-ink-subtle">/ {max == null ? 'illimité' : `${max.toLocaleString('fr-FR')}${unit}`}</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="meter" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max ?? undefined}>
        <div className={cn('h-full rounded-full transition-[width] duration-700 ease-spring', tone)} style={{ width: max ? `${Math.max(2, pct)}%` : '100%', opacity: max ? 1 : 0.25 }} />
      </div>
    </div>
  )
}
