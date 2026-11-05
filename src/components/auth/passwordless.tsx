'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { MailCheck } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import { requestEmailLink, requestLoginCode } from '@/server/actions/sign-in'
import { signInWithCredentials } from '@/lib/sign-in'

const input = 'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10'
const primary = 'pressable flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#fb923c] to-brand py-4 font-bold text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)] transition-all disabled:opacity-60'

function Terms({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2.5 text-sm text-ink-muted">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
      <span>J’accepte les <Link href="/legal/cgu" className="font-semibold text-orange-700 underline">conditions d’utilisation</Link> et la <Link href="/legal/confidentialite" className="font-semibold text-orange-700 underline">politique de confidentialité</Link>.</span>
    </label>
  )
}

/** Connexion par code reçu par WhatsApp ou SMS ; un numéro inconnu crée son compte au passage. */
export function CodeSignIn({ simulated, onSignedIn }: { simulated: boolean; onSignedIn: () => void }) {
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [channel, setChannel] = useState<'WHATSAPP' | 'SMS'>('SMS')
  const [isNew, setIsNew] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ask = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError('')
    const res = await requestLoginCode(phone)
    setBusy(false)
    if (!res.success) return setError(res.error)
    setChannel(res.channel); setIsNew(res.isNew); setStep('code')
  }
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isNew && !terms) return setError('Acceptez les conditions pour créer votre compte.')
    setBusy(true); setError('')
    const res = await signInWithCredentials({ phone, code, acceptTerms: String(terms), name }, 'phone-code')
    if (res?.ok) return onSignedIn()
    setBusy(false)
    setError(res?.error === 'TERMS_REQUIRED' ? 'Acceptez les conditions pour créer votre compte.' : res?.error && res.error !== 'CredentialsSignin' ? res.error : 'Code incorrect ou expiré')
  }

  if (step === 'phone') {
    return (
      <form onSubmit={ask} className="space-y-4">
        {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
        <div>
          <label htmlFor="code-phone" className="mb-1 block text-sm font-medium text-gray-700">Numéro de téléphone</label>
          <PhoneInput id="code-phone" value={phone} onChange={setPhone} />
        </div>
        <button type="submit" disabled={busy || phone.replace(/\D/g, '').length < 8} className={primary}>{busy ? 'Envoi…' : 'Recevoir mon code'}</button>
        <p className="text-center text-xs text-ink-subtle">Un code à 6 chiffres arrive par WhatsApp ou par SMS. Pas de mot de passe à retenir.{simulated ? ' (Test : code lisible dans Console → Messages.)' : ''}</p>
      </form>
    )
  }
  return (
    <form onSubmit={confirm} className="space-y-4 animate-rise-in">
      <p className="text-sm text-ink-muted">Code envoyé par {channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'} au {phone}. <button type="button" onClick={() => { setStep('phone'); setCode(''); setError('') }} className="font-semibold text-orange-700">Changer</button></p>
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
      <div>
        <label htmlFor="code-value" className="mb-1 block text-sm font-medium text-gray-700">Code reçu</label>
        <input id="code-value" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={`${input} text-center text-2xl tracking-[0.5em]`} placeholder="••••••" />
      </div>
      {isNew && (
        <div className="space-y-3 rounded-2xl bg-white/80 p-4 ring-1 ring-black/5">
          <p className="text-sm font-semibold text-ink">Bienvenue : votre compte se crée avec ce numéro.</p>
          <div>
            <label htmlFor="code-name" className="mb-1 block text-sm font-medium text-gray-700">Votre prénom (facultatif)</label>
            <input id="code-name" value={name} onChange={e => setName(e.target.value)} maxLength={80} className={input} autoComplete="given-name" />
          </div>
          <Terms checked={terms} onChange={setTerms} />
        </div>
      )}
      <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? 'Connexion…' : isNew ? 'Créer mon compte' : 'Me connecter'}</button>
      <button type="button" onClick={() => ask()} disabled={busy} className="w-full text-center text-sm font-medium text-orange-700">Renvoyer un code</button>
    </form>
  )
}

/** Lien de connexion par e-mail (valable 15 minutes). */
export function EmailLinkSignIn({ simulated }: { simulated: boolean }) {
  const [email, setEmail] = useState('')
  const [terms, setTerms] = useState(false)
  const [sent, setSent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const res = await requestEmailLink(email, terms)
    setBusy(false)
    if (!res.success) return setError(res.error)
    setSent(res.message)
  }
  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-5 text-center shadow-card ring-1 ring-black/5 animate-rise-in">
        <MailCheck className="mx-auto text-brand" size={30} />
        <p className="mt-2 font-semibold text-ink">Regardez votre messagerie</p>
        <p className="mt-1 text-sm text-ink-muted">{sent}{simulated ? ' (Test : e-mail lisible dans Console → Messages.)' : ''}</p>
      </div>
    )
  }
  return (
    <form onSubmit={send} className="space-y-4">
      {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</p>}
      <div>
        <label htmlFor="link-email" className="mb-1 block text-sm font-medium text-gray-700">Adresse e-mail</label>
        <input id="link-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={input} placeholder="vous@exemple.ci" />
      </div>
      <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5">
        <p className="mb-2 text-xs text-ink-subtle">Pas encore de compte ? Il se crée à l’ouverture du lien :</p>
        <Terms checked={terms} onChange={setTerms} />
      </div>
      <button type="submit" disabled={busy} className={primary}>{busy ? 'Envoi…' : 'Recevoir un lien de connexion'}</button>
    </form>
  )
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" /></svg>
)
const MicrosoftMark = () => (
  <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z" /><path fill="#7fba00" d="M11 1h9v9h-9z" /><path fill="#00a4ef" d="M1 11h9v9H1z" /><path fill="#ffb900" d="M11 11h9v9h-9z" /></svg>
)

/** Boutons Google et Microsoft (affichés seulement si leur connecteur est branché). */
export function SsoButtons({ google, microsoft, note }: { google: boolean; microsoft: boolean; note?: string }) {
  if (!google && !microsoft) return null
  const btn = 'pressable flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 text-sm font-semibold text-ink ring-1 ring-gray-200 hover:ring-gray-300'
  return (
    <div className="space-y-2.5">
      {google && <button type="button" onClick={() => signIn('google', { callbackUrl: '/auth/continue' })} className={btn}><GoogleMark /> Continuer avec Google</button>}
      {microsoft && <button type="button" onClick={() => signIn('azure-ad', { callbackUrl: '/auth/continue' })} className={btn}><MicrosoftMark /> Continuer avec Microsoft</button>}
      {note && <p className="text-center text-[11px] text-ink-subtle">{note}</p>}
    </div>
  )
}
