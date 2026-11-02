'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { requestDataCopy } from '@/server/actions/account'
import { useToast } from '@/components/ui'

/** Téléchargement d'un fichier JSON sur l'appareil (utilisé par la console pour traiter les demandes). */
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** « Mes données » : demande d'une copie, traitée par l'équipe Lerena (pas d'export en libre-service). */
export function MyDataCard() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const request = async () => {
    setBusy(true)
    const res = await requestDataCopy()
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setSent(true)
    toast('Demande envoyée : réponse sous 30 jours')
  }

  return (
    <div className="overflow-hidden rounded-[22px] bg-white shadow-card ring-1 ring-black/[0.03]">
      <button type="button" onClick={request} disabled={busy || sent} className="flex w-full items-center gap-3 px-4 py-3.5 text-left disabled:opacity-70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><ShieldCheck size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{sent ? 'Demande envoyée' : 'Demander une copie de mes données'}</span>
          <span className="block text-xs text-ink-subtle">{sent ? 'Nous vous répondons sous 30 jours' : 'Traitée par l’équipe Lerena sous 30 jours'}</span>
        </span>
        <ChevronRight size={17} className="text-ink-subtle" />
      </button>
      <Link href="/legal/confidentialite" className="flex items-center justify-between border-t border-surface-line px-4 py-3 text-sm text-ink-muted hover:text-ink">
        Politique de confidentialité <ChevronRight size={16} className="text-ink-subtle" />
      </Link>
    </div>
  )
}
