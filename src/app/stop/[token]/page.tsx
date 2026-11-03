'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BellOff, Check } from 'lucide-react'
import { confirmUnsubscribe, getUnsubscribe } from '@/server/actions/stop'
import { Button } from '@/components/ui'

// Lien « STOP » des SMS d'information : la personne confirme d'un appui, sans compte ni mot de passe.
export default function StopPage({ params }: { params: { token: string } }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof getUnsubscribe>> | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => { getUnsubscribe(params.token).then(setInfo).catch(() => setInfo(null)) }, [params.token])

  const confirm = async () => {
    setBusy(true)
    const res = await confirmUnsubscribe(params.token)
    setBusy(false)
    if (res.success) setDone(true)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-card">
        {info === undefined ? <div className="h-32 animate-pulse rounded-2xl bg-gray-100" /> : info === null ? (
          <>
            <p className="font-display text-xl font-bold text-ink">Lien expiré</p>
            <p className="mt-2 text-sm text-ink-muted">Ce lien n’est plus valable. Vous pouvez aussi répondre STOP au SMS reçu.</p>
          </>
        ) : done || info.done ? (
          <div className="animate-pop-in">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><Check size={28} /></span>
            <p className="mt-4 font-display text-xl font-bold text-ink">C’est fait</p>
            <p className="mt-2 text-sm text-ink-muted">Vous ne recevrez plus de messages d’information de {info.orgName}. Les SMS liés à vos tickets et rendez-vous continuent d’arriver.</p>
          </div>
        ) : (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand"><BellOff size={26} /></span>
            <p className="mt-4 font-display text-xl font-bold text-ink">Ne plus recevoir les messages de {info.orgName} ?</p>
            <p className="mt-2 text-sm text-ink-muted">Fermetures, campagnes, nouveautés : vous ne les recevrez plus. Vos tickets et rendez-vous ne changent pas.</p>
            <Button fullWidth size="lg" className="mt-6" loading={busy} onClick={confirm}>Ne plus recevoir</Button>
          </>
        )}
        <Link href="/" className="mt-5 inline-block text-xs font-semibold text-ink-subtle hover:text-ink">Lerena</Link>
      </div>
    </main>
  )
}
