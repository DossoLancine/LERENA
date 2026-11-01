'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Smartphone, Monitor, KeyRound, LogOut, Copy, Check } from 'lucide-react'
import { confirmTwoFactor, disableTwoFactor, getSecurityOverview, revokeOtherSessions, revokeSession, startTwoFactorSetup } from '@/server/actions/account'
import { AccountCard } from '@/components/account/account-card'
import { Badge, Button, TextInput, useToast } from '@/components/ui'

type Overview = NonNullable<Awaited<ReturnType<typeof getSecurityOverview>>>

/** Description courte d'un appareil d'après son navigateur. */
function deviceLabel(ua: string | null) {
  if (!ua) return 'Appareil inconnu'
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone / iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Appareil'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur'
  return `${browser} · ${os}`
}
const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function SecurityContent() {
  const toast = useToast()
  const required = useSearchParams().get('required') === '1'
  const { update } = useSession()
  const [data, setData] = useState<Overview | null>(null)
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => getSecurityOverview().then(setData), [])
  useEffect(() => { load() }, [load])

  const begin = async () => {
    setError(null)
    const res = await startTwoFactorSetup()
    if (res && !res.alreadyEnabled) setSetup({ secret: res.secret, qr: res.qr })
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await confirmTwoFactor(code)
    setBusy(false)
    if (!res.success) return setError(res.error)
    setRecovery(res.recoveryCodes)
    setSetup(null); setCode('')
    await update()
    load()
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const res = await disableTwoFactor(code)
    setBusy(false)
    if (!res.success) return setError(res.error ?? 'Impossible')
    setCode('')
    toast('Double authentification désactivée')
    await update()
    load()
  }

  if (!data) return <AccountCard title="Sécurité du compte"><div className="h-40 rounded-card shimmer" /></AccountCard>

  return (
    <AccountCard title="Sécurité du compte" subtitle={data.email ?? undefined}>
      <div className="space-y-6">
        {required && !data.twoFactorEnabled && (
          <p role="alert" className="rounded-2xl bg-warning-soft p-4 text-sm font-medium text-warning-ink">
            Votre rôle donne accès à des données sensibles : activez la double authentification pour continuer.
          </p>
        )}

        {/* Double authentification */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Smartphone size={18} aria-hidden="true" /> Double authentification</h2>
            <Badge tone={data.twoFactorEnabled ? 'success' : 'neutral'}>{data.twoFactorEnabled ? 'Activée' : 'Désactivée'}</Badge>
          </div>
          <p className="text-sm text-ink-muted">À chaque connexion, un code à 6 chiffres de votre application d’authentification (Google Authenticator, Microsoft Authenticator…) est demandé en plus du mot de passe.</p>

          {recovery && (
            <div role="status" className="space-y-2 rounded-2xl border border-green-200 bg-success-soft p-4 text-sm text-success-ink">
              <p className="font-bold">Codes de secours — à noter et ranger en lieu sûr, ils ne seront plus affichés.</p>
              <p>Chacun permet une connexion si vous perdez votre téléphone.</p>
              <ul className="grid grid-cols-2 gap-1 font-mono text-base font-bold">{recovery.map(c => <li key={c}>{c}</li>)}</ul>
              <Button size="sm" variant="secondary" icon={copied ? <Check size={15} /> : <Copy size={15} />}
                onClick={() => { navigator.clipboard?.writeText(recovery.join('\n')); setCopied(true) }}>Copier</Button>
            </div>
          )}

          {!data.twoFactorEnabled && !setup && <Button onClick={begin}>Activer</Button>}

          {setup && (
            <form onSubmit={confirm} className="space-y-3 rounded-2xl bg-surface-sunken p-4">
              <p className="text-sm text-ink">1. Dans votre application, ajoutez un compte en scannant ce QR code :</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qr} alt="QR code à scanner avec l’application d’authentification" className="mx-auto h-48 w-48 rounded-xl bg-white p-2 animate-pop-in" />
              <p className="text-xs text-ink-muted">Impossible de scanner ? Saisissez cette clé : <span className="select-all break-all font-mono font-semibold text-ink">{setup.secret}</span></p>
              <TextInput label="2. Code affiché par l’application" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required />
              {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
              <Button type="submit" fullWidth loading={busy} disabled={code.length !== 6}>Confirmer et activer</Button>
            </form>
          )}

          {data.twoFactorEnabled && !data.twoFactorRequired && (
            <form onSubmit={disable} className="flex items-end gap-2">
              <div className="flex-1"><TextInput label="Code actuel pour désactiver" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" /></div>
              <Button type="submit" variant="secondary" loading={busy} disabled={code.length !== 6}>Désactiver</Button>
            </form>
          )}
          {data.twoFactorEnabled && <p className="text-xs text-ink-muted">Codes de secours restants : {data.recoveryCodesLeft}</p>}
          {data.twoFactorEnabled && error && !setup && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        </section>

        {/* Mot de passe */}
        <section className="space-y-2 border-t border-surface-line pt-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><KeyRound size={18} aria-hidden="true" /> Mot de passe</h2>
          <Link href="/account/password" className="inline-flex text-sm font-semibold text-brand">Changer mon mot de passe →</Link>
        </section>

        {/* Appareils connectés */}
        <section className="space-y-3 border-t border-surface-line pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Monitor size={18} aria-hidden="true" /> Appareils connectés</h2>
            {data.sessions.length > 1 && (
              <Button size="sm" variant="ghost" icon={<LogOut size={15} />} onClick={async () => { await revokeOtherSessions(); toast('Autres appareils déconnectés'); load() }}>Tous les autres</Button>
            )}
          </div>
          <ul className="stagger divide-y divide-surface-line">
            {data.sessions.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{deviceLabel(s.userAgent)} {s.current && <Badge tone="brand">Cet appareil</Badge>}</p>
                  <p className="text-xs text-ink-muted">Actif {when(s.lastSeenAt)}{s.ip ? ` · ${s.ip}` : ''}</p>
                </div>
                {!s.current && (
                  <Button size="sm" variant="secondary" onClick={async () => { await revokeSession(s.id); toast('Appareil déconnecté'); load() }}>Déconnecter</Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">Un appareil déconnecté perd l’accès dans les 5 minutes.</p>
        </section>
      </div>
    </AccountCard>
  )
}

export default function SecurityPage() {
  return <Suspense><SecurityContent /></Suspense>
}
