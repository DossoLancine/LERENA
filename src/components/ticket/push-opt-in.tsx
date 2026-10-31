'use client'

import { Bell, BellRing, Share } from 'lucide-react'
import { usePush } from '@/hooks/use-push'
import { haptics } from '@/lib/haptics'

/** Proposition d'alerte push sur l'écran ticket : prévenu même téléphone verrouillé. */
export function PushOptIn({ ticketId }: { ticketId: string }) {
  const { state, enable } = usePush(ticketId)

  if (state === 'loading' || state === 'unsupported') return null

  if (state === 'subscribed') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-green-800 animate-rise-in">
        <BellRing size={22} className="shrink-0" />
        <p className="text-sm font-medium">Alertes activées : vous serez prévenu même téléphone verrouillé.</p>
      </div>
    )
  }

  if (state === 'ios-install') {
    return (
      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-gray-700 animate-rise-in">
        <p className="font-semibold text-gray-900">Être prévenu quand c&apos;est votre tour</p>
        <p className="mt-1">
          Sur iPhone, touchez <Share size={14} className="inline -mt-0.5" /> puis « Sur l&apos;écran d&apos;accueil »,
          rouvrez ATTENDS depuis l&apos;icône, puis activez les alertes.
        </p>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
        Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur pour être prévenu.
      </div>
    )
  }

  return (
    <button
      onClick={() => { haptics.tap(); enable() }}
      className="pressable flex w-full items-center gap-3 rounded-2xl border border-orange-100 bg-white p-4 text-left shadow-sm animate-rise-in"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
        <Bell size={20} />
      </span>
      <span>
        <span className="block text-sm font-bold text-gray-900">Me prévenir quand c&apos;est mon tour</span>
        <span className="block text-xs text-gray-500">Même téléphone verrouillé ou application fermée</span>
      </span>
    </button>
  )
}
