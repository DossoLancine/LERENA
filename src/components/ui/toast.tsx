'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; tone: ToastTone }

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})

/** Petits messages de confirmation en bas de l'écran (« Enregistré », « Erreur réseau »…). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, tone }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-raised animate-rise-in',
              t.tone === 'success' && 'bg-gray-900',
              t.tone === 'error' && 'bg-danger',
              t.tone === 'info' && 'bg-info'
            )}
          >
            {t.tone === 'success' && <CheckCircle2 size={16} />}
            {t.tone === 'error' && <AlertTriangle size={16} />}
            {t.tone === 'info' && <Info size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
