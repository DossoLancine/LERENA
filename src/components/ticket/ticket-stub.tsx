import type { ReactNode } from 'react'
import { OrgMark } from '@/components/branding/org-mark'
import { cn } from '@/lib/cn'

/**
 * Le ticket Lerena, motif signature de la marque : encoches découpées, ligne de déchirure,
 * numéro en grand dans la police de marque. « sun » : version très contrastée, lisible en plein soleil.
 */
export function TicketStub({ number, orgName, serviceName, logo, color, status, footer, printed, sun }: {
  number: string
  orgName: string
  serviceName: string
  logo?: string | null
  color?: string | null
  status: ReactNode
  footer?: ReactNode
  printed?: boolean
  sun?: boolean
}) {
  return (
    <div className={cn('ticket-shadow', printed && 'animate-ticket-print')}>
      <div className={cn('ticket-notch relative overflow-hidden rounded-[28px]', sun ? 'bg-white text-black' : 'bg-white text-ink')} style={{ ['--notch-y' as string]: '96px' }}>
        {/* Partie haute : établissement */}
        <div className={cn('relative flex h-[96px] items-center gap-3 px-5', !sun && 'bg-gradient-to-br from-brand-50 to-white')}>
          {!sun && <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-brand/10" aria-hidden="true" />}
          <OrgMark name={orgName} logo={logo} color={color} size={48} />
          <div className="relative min-w-0 flex-1">
            <p className="truncate text-base font-bold">{orgName}</p>
            <p className={cn('truncate text-sm', sun ? 'text-black' : 'text-ink-muted')}>{serviceName}</p>
          </div>
          <div className="relative shrink-0">{status}</div>
        </div>
        {/* Ligne de déchirure */}
        <div className={cn('mx-5 border-t-2 border-dashed', sun ? 'border-black/40' : 'border-brand/20')} aria-hidden="true" />
        {/* Partie basse : le numéro */}
        <div className="px-5 pb-5 pt-4 text-center">
          <p className={cn('text-[11px] font-semibold uppercase tracking-[0.25em]', sun ? 'text-black' : 'text-ink-subtle')}>Votre numéro</p>
          <p className={cn('font-display font-extrabold leading-none tracking-tight tabular-nums', sun ? 'text-[104px] text-black' : 'text-[88px] text-ink')}>{number}</p>
          {footer}
        </div>
      </div>
    </div>
  )
}
