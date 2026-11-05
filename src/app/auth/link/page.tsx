'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Zap } from 'lucide-react'
import { destinationAfterSignIn, signInWithCredentials } from '@/lib/sign-in'
import { homeForRole } from '@/lib/constants'

// Lien reçu par e-mail. La connexion attend un appui : les antivirus des messageries ouvrent les liens
// automatiquement, ce qui grillerait le lien (valable une seule fois) si la page se connectait toute seule.
function LinkSignIn() {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true); setError('')
    const res = await signInWithCredentials({ token }, 'email-link')
    if (!res?.ok) { setBusy(false); setError(res?.error && res.error !== 'CredentialsSignin' ? res.error : 'Lien invalide ou expiré : demandez-en un nouveau.'); return }
    router.push(await destinationAfterSignIn(homeForRole as never)); router.refresh()
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#fde3cc] via-[#fff6ef] via-30% to-white px-6">
      <div className="w-full max-w-sm text-center">
        <span className="flex items-center justify-center gap-1 font-display text-xl font-extrabold text-ink">Lerena <Zap size={17} className="fill-brand text-brand" /></span>
        <span className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-brand shadow-card"><Mail size={28} /></span>
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-ink">Votre lien de connexion</h1>
        <p className="mt-2 text-sm text-ink-muted">Appuyez sur le bouton pour vous connecter sur cet appareil.</p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
        <button onClick={go} disabled={busy || !token} className="pressable mt-6 w-full rounded-2xl bg-gradient-to-br from-[#fb923c] to-brand py-4 font-bold text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)] disabled:opacity-60">
          {busy ? 'Connexion…' : 'Me connecter'}
        </button>
        <Link href="/auth/login" className="mt-4 inline-block text-sm font-medium text-orange-700">Autre méthode de connexion</Link>
      </div>
    </main>
  )
}

export default function LinkPage() {
  return <Suspense fallback={null}><LinkSignIn /></Suspense>
}
