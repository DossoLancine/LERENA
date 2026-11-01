'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestPasswordReset, resetPasswordWithCode } from '@/server/actions/account'
import { AccountCard } from '@/components/account/account-card'
import { Button, TextInput } from '@/components/ui'

/** Mot de passe oublié : e-mail → lien ; téléphone → code SMS puis nouveau mot de passe. */
export default function ForgotPasswordPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [step, setStep] = useState<'ask' | 'email-sent' | 'sms-code'>('ask')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await requestPasswordReset(identifier)
    setBusy(false)
    if (!res.success) return setError(res.error)
    if (res.channel === 'sms') { setPhone(res.phone); setStep('sms-code') } else setStep('email-sent')
  }

  const reset = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await resetPasswordWithCode(phone, code, password)
    setBusy(false)
    if (!res.success) return setError(res.error ?? 'Réinitialisation impossible')
    router.push('/auth/login?reset=1')
  }

  return (
    <AccountCard title="Mot de passe oublié" subtitle="Nous allons vous aider à en choisir un nouveau." back="/auth/login">
      {step === 'ask' && (
        <form onSubmit={ask} className="space-y-4">
          <TextInput label="E-mail ou numéro de téléphone" value={identifier} onChange={e => setIdentifier(e.target.value)} required autoComplete="username" placeholder="vous@exemple.ci ou 07 00 00 00 00" />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" fullWidth loading={busy}>Continuer</Button>
        </form>
      )}
      {step === 'email-sent' && (
        <p role="status" className="rounded-2xl bg-success-soft p-4 text-sm text-success-ink">
          Si un compte correspond à cet e-mail, un lien vient d’y être envoyé. Il est valable 1 heure. Pensez à regarder dans les indésirables.
        </p>
      )}
      {step === 'sms-code' && (
        <form onSubmit={reset} className="space-y-4">
          <p className="text-sm text-ink-muted">Si un compte correspond à ce numéro, un code à 4 chiffres vient d’être envoyé par SMS.</p>
          <TextInput label="Code reçu par SMS" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" required />
          <TextInput label="Nouveau mot de passe" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required hint="Code PIN de 6 chiffres ou mot de passe de 8 caractères" />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" fullWidth loading={busy}>Enregistrer</Button>
        </form>
      )}
    </AccountCard>
  )
}
