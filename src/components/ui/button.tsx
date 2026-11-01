import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-ink border border-gray-200 hover:bg-gray-50',
  ghost: 'bg-transparent text-ink-muted hover:bg-gray-100',
  danger: 'bg-danger text-white hover:bg-danger-ink',
  dark: 'bg-gray-900 text-white hover:bg-black',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'min-h-touch px-5 text-sm gap-2',
  lg: 'h-14 px-6 text-base gap-2',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  fullWidth?: boolean
}

/** Bouton standard d'Lerena : retour tactile, état de chargement et focus visible inclus. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, fullWidth, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-control font-semibold',
        ' disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

/** Bouton rond contenant seulement une icône. Le libellé est obligatoire pour les lecteurs d'écran. */
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: 'neutral' | 'brand' | 'active' }>(
  function IconButton({ label, tone = 'neutral', className, children, type = 'button', ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
          tone === 'neutral' && 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          tone === 'brand' && 'bg-brand-50 text-brand-600 hover:bg-brand-100',
          tone === 'active' && 'bg-brand text-white shadow-sm',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
