'use client'

import { Megaphone } from 'lucide-react'

/**
 * Alerte plein écran quand le ticket est appelé : impossible à manquer,
 * même téléphone en main dans une salle bruyante.
 */
export function YourTurnOverlay({ open, ticketNumber, counter, onDismiss }: {
  open: boolean
  ticketNumber: string
  counter: string
  onDismiss: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-gradient-to-br from-[#fb923c] via-brand to-brand-700 px-6 text-center text-white animate-page-in" role="alertdialog" aria-live="assertive">
      <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold uppercase tracking-wider animate-pop-in">
        <Megaphone size={16} /> C&apos;est votre tour
      </div>

      <div className="relative my-10 flex items-center justify-center">
        <span className="absolute h-44 w-44 rounded-full bg-white/30 animate-ripple" />
        <span className="absolute h-44 w-44 rounded-full bg-white/20 animate-ripple" style={{ animationDelay: '0.9s' }} />
        <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-white text-brand-700 shadow-2xl animate-pop-in">
          <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums">{ticketNumber}</span>
        </div>
      </div>

      <p className="text-lg opacity-90">Présentez-vous au</p>
      <p className="mt-1 font-display text-5xl font-extrabold">{counter}</p>

      <button
        onClick={onDismiss}
        className="pressable mt-12 w-full max-w-xs rounded-2xl bg-white py-4 text-lg font-bold text-brand-700 shadow-xl"
      >
        J&apos;arrive
      </button>
    </div>
  )
}
