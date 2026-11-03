'use client'

import { useEffect, useState } from 'react'
import { getTicketConsent, setTicketConsent } from '@/server/actions/marketing'
import { cn } from '@/lib/cn'

/** Le visiteur accepte (ou non) les messages d'information de l'établissement : fermetures, campagnes, nouveautés. */
export function ConsentOptIn({ ticketId }: { ticketId: string }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof getTicketConsent>>>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getTicketConsent(ticketId).then(setState).catch(() => null) }, [ticketId])
  if (!state) return null

  const toggle = async () => {
    setBusy(true)
    const next = !state.consent
    const res = await setTicketConsent(ticketId, next)
    setBusy(false)
    if (res.success) setState({ ...state, consent: next })
  }

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-[22px] bg-white p-4 shadow-card ring-1 ring-black/[0.03]">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">Nouvelles de {state.orgName} par SMS</span>
        <span className="block text-xs text-ink-muted">Fermetures exceptionnelles, campagnes, nouveaux services. Arrêt à tout moment.</span>
      </span>
      <button type="button" role="switch" aria-checked={state.consent} disabled={busy} onClick={toggle}
        className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60', state.consent ? 'bg-brand' : 'bg-gray-200')}>
        <span className={cn('absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform', state.consent ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </label>
  )
}
