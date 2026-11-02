import { cn } from '@/lib/cn'

/**
 * Marque d'un établissement : son logo s'il en a un, sinon son initiale sur sa couleur (ou la couleur Lerena).
 * Utilisée sur la TV, la borne, le ticket, la fiche et les réglages.
 */
export function OrgMark({ name, logo, color, size = 44, className }: { name: string; logo?: string | null; color?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size }
  if (logo) {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-black/5', className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={`Logo ${name}`} className="h-full w-full object-contain" />
      </span>
    )
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-2xl font-black text-white', className)} style={{ ...style, background: color ?? '#c2410c', fontSize: size * 0.45 }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || 'L'}
    </span>
  )
}
