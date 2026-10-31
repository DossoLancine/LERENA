import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-control border border-gray-200 bg-white px-4 text-sm text-ink placeholder:text-ink-subtle transition ' +
  'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:bg-gray-50 disabled:text-ink-subtle'

/** Champ de formulaire : libellé relié au contrôle, aide et message d'erreur annoncés aux lecteurs d'écran. */
export function Field({ label, hint, error, children, id }: {
  label: string
  hint?: ReactNode
  error?: string | null
  id: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  )
}

type FieldProps = { label: string; hint?: ReactNode; error?: string | null }

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  function TextInput({ label, hint, error, className, id, ...props }, ref) {
    const autoId = useId()
    const inputId = id ?? autoId
    return (
      <Field label={label} hint={hint} error={error} id={inputId}>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(control, 'min-h-touch', error && 'border-danger', className)}
          {...props}
        />
      </Field>
    )
  }
)

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function TextArea({ label, hint, error, className, id, ...props }, ref) {
    const autoId = useId()
    const inputId = id ?? autoId
    return (
      <Field label={label} hint={hint} error={error} id={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cn(control, 'min-h-[96px] py-3', error && 'border-danger', className)}
          {...props}
        />
      </Field>
    )
  }
)

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & FieldProps>(
  function SelectInput({ label, hint, error, className, id, children, ...props }, ref) {
    const autoId = useId()
    const inputId = id ?? autoId
    return (
      <Field label={label} hint={hint} error={error} id={inputId}>
        <select ref={ref} id={inputId} className={cn(control, 'min-h-touch', className)} {...props}>
          {children}
        </select>
      </Field>
    )
  }
)
