'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './button'
import { cn } from '@/lib/cn'

const EXIT_MS = 220

/**
 * Fenêtre modale : centrée sur ordinateur, montant du bas comme un volet sur téléphone.
 * Elle entre et sort en douceur ; fermeture par Échap ou clic sur le fond ; le focus est placé dans la fenêtre.
 */
export function Dialog({ open, onClose, title, children, size = 'md' }: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'md' | 'lg'
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  // Garde le dernier contenu affiché pendant l'animation de sortie
  const lastShown = useRef({ title, children })
  if (open) lastShown.current = { title, children }
  const shown = lastShown.current

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open || !mounted) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open, mounted, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={shown.title}>
      <div
        className={cn('absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-raised outline-none pb-safe sm:max-h-[90vh] sm:rounded-card sm:pb-0',
          'transition-[transform,opacity] ease-[cubic-bezier(0.32,0.72,0,1)]',
          visible ? 'duration-[420ms] translate-y-0 opacity-100 sm:scale-100' : 'duration-200 translate-y-full sm:translate-y-3 sm:scale-95 sm:opacity-0',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-surface-line px-5 py-4">
          <h3 className="text-lg font-bold text-ink">{shown.title}</h3>
          <IconButton label="Fermer" onClick={onClose} className="h-8 w-8">
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto p-5">{shown.children}</div>
      </div>
    </div>
  )
}
