'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './button'

/**
 * Fenêtre modale centrée (bureau). Sur téléphone, préférer BottomSheet.
 * Fermeture par Échap ou clic sur le fond ; le focus est placé dans la fenêtre à l'ouverture.
 */
export function Dialog({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40 animate-page-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-card bg-white shadow-raised outline-none animate-pop-in ${size === 'lg' ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-surface-line px-5 py-4">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <IconButton label="Fermer" onClick={onClose} className="h-8 w-8">
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
