import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { AnimatedNumber } from './animated-number'

/** Carte blanche standard. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-surface-line bg-surface shadow-card', className)} {...props} />
}

/** En-tête de carte : titre, sous-titre facultatif et action à droite. */
export function CardHeader({ title, subtitle, action, className }: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-surface-line px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="truncate font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** Indicateur chiffré : valeur en gros, libellé, icône et tendance facultatives. */
export function StatCard({ label, value, icon, hint, hintTone = 'neutral' }: {
  label: string
  value: ReactNode
  icon?: ReactNode
  hint?: ReactNode
  hintTone?: 'neutral' | 'good' | 'bad'
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        {icon}
        {hint && (
          <span className={cn(
            'text-xs font-medium',
            hintTone === 'good' && 'text-success',
            hintTone === 'bad' && 'text-warning',
            hintTone === 'neutral' && 'text-ink-subtle'
          )}>
            {hint}
          </span>
        )}
      </div>
      <p className="text-3xl font-black tabular-nums text-ink">{typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </Card>
  )
}

/** État vide : explique pourquoi il n'y a rien et propose une action. */
export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 text-gray-300">{icon}</div>}
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-ink-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
