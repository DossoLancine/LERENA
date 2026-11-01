'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { changePassword } from '@/server/actions/account'
import { AccountCard } from '@/components/account/account-card'
import { Button, TextInput } from '@/components/ui'
import { homeForRole, type Role } from '@/lib/constants'

function PasswordForm() {
  const router = useRouter()
  const required = useSearchParams().get('required') === '1'
  const { data: session, update } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next !== confirm) return setError('Les deux mots de passe ne sont pas identiques')
    setBusy(true); setError(null)
    const res = await changePassword(current, next)
    if (!res.success) { setBusy(false); return setError(res.error ?? 'Changement impossible') }
    // Met à jour la session (le mot de passe n'est plus provisoire), puis ouvre l'espace de l'utilisateur
    await update()
    router.replace(homeForRole((session?.user as { role?: Role } | undefined)?.role))
    router.refresh()
  }

  return (
    <AccountCard
      title={required ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}
      subtitle={required ? 'Vous vous êtes connecté avec un mot de passe provisoire : remplacez-le par un mot de passe personnel.' : 'Les autres appareils connectés seront déconnectés.'}>
      <form onSubmit={submit} className="space-y-4">
        <TextInput label={required ? 'Mot de passe provisoire' : 'Mot de passe actuel'} type="password" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required />
        <TextInput label="Nouveau mot de passe" type="password" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" required hint="8 caractères minimum, avec lettres et chiffres" />
        <TextInput label="Confirmer" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" fullWidth loading={busy}>Enregistrer</Button>
      </form>
    </AccountCard>
  )
}

export default function ChangePasswordPage() {
  return <Suspense><PasswordForm /></Suspense>
}
