'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPasswordWithToken } from '@/server/actions/account'
import { AccountCard } from '@/components/account/account-card'
import { Button, TextInput } from '@/components/ui'

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Le jeton est lu puis retiré de la barre d'adresse (il ne reste ni dans l'historique ni dans les journaux)
  useEffect(() => {
    const t = params.get('token')
    if (t) { setToken(t); window.history.replaceState(window.history.state, '', '/auth/reset') }
  }, [params])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques')
    setBusy(true); setError(null)
    const res = await resetPasswordWithToken(token, password)
    setBusy(false)
    if (!res.success) return setError(res.error ?? 'Réinitialisation impossible')
    router.push('/auth/login?reset=1')
  }

  return (
    <AccountCard title="Nouveau mot de passe" subtitle="Toutes vos sessions ouvertes seront fermées." back="/auth/login">
      <form onSubmit={submit} className="space-y-4">
        <TextInput label="Nouveau mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required hint="8 caractères minimum, avec lettres et chiffres" />
        <TextInput label="Confirmer" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" fullWidth loading={busy} disabled={!token}>Enregistrer</Button>
        {!token && <p className="text-xs text-ink-muted">Ouvrez cette page depuis le lien reçu par e-mail.</p>}
      </form>
    </AccountCard>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>
}
