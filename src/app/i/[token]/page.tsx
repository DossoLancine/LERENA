'use client'

import { useEffect, useState } from 'react'
import { Tv, Tablet, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { checkSetupLink, redeemSetupLink, type DeviceType } from '@/server/actions/devices'
import { adoptDeviceRole, readDeviceToken } from '@/components/devices/pairing-screen'
import { cn } from '@/lib/cn'

type State =
  | { step: 'loading' }
  | { step: 'invalid' }
  | { step: 'choose'; orgName: string }
  | { step: 'installing'; role: DeviceType }
  | { step: 'error'; message: string }

const ROLES: { role: DeviceType; icon: typeof Tv; title: string; text: string }[] = [
  { role: 'TV', icon: Tv, title: 'Écran d’affichage', text: 'Affiche les numéros appelés et les annonce à voix haute. Pour la TV de la salle d’attente.' },
  { role: 'KIOSK', icon: Tablet, title: 'Borne de tickets', text: 'Les visiteurs touchent un service et reçoivent leur ticket. Pour une tablette à l’entrée.' }
]

/** Ouverture d'un lien d'installation sur une TV ou une tablette : on choisit son rôle, c'est tout. */
export default function SetupLinkPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<State>({ step: 'loading' })
  const [installedAs, setInstalledAs] = useState<DeviceType | null>(null)

  useEffect(() => {
    // Retire le secret de la barre d'adresse et de l'historique dès l'ouverture
    window.history.replaceState(window.history.state, '', '/i')
    setInstalledAs(readDeviceToken('TV') ? 'TV' : readDeviceToken('KIOSK') ? 'KIOSK' : null)
    checkSetupLink(params.token)
      .then(res => setState(res.valid ? { step: 'choose', orgName: res.orgName } : { step: 'invalid' }))
      .catch(() => setState({ step: 'error', message: 'Connexion impossible. Vérifiez le réseau puis rouvrez le lien.' }))
  }, [params.token])

  const install = async (role: DeviceType) => {
    setState({ step: 'installing', role })
    try {
      const res = await redeemSetupLink(params.token, role)
      if (!res.success) return setState({ step: 'error', message: res.error })
      window.location.replace(adoptDeviceRole({ orgId: res.orgId, type: res.type, token: res.token }))
    } catch {
      setState({ step: 'error', message: 'Connexion impossible. Vérifiez le réseau puis rouvrez le lien.' })
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 py-10 text-center text-white">
      {state.step === 'loading' && <Loader2 size={48} className="animate-spin text-white/50" aria-label="Vérification du lien" />}

      {(state.step === 'invalid' || state.step === 'error') && (
        <div className="max-w-md animate-pop-in">
          <ShieldAlert size={56} className="mx-auto text-amber-400" aria-hidden="true" />
          <h1 className="mt-6 text-2xl font-bold">{state.step === 'invalid' ? 'Lien expiré ou déjà utilisé' : 'Installation impossible'}</h1>
          <p className="mt-3 text-white/70">
            {state.step === 'invalid'
              ? 'Pour votre sécurité, chaque lien ne sert qu’une fois et pendant 30 minutes. Demandez au responsable un nouveau lien (Paramètres → Appareils).'
              : state.message}
          </p>
        </div>
      )}

      {(state.step === 'choose' || state.step === 'installing') && (
        <div className="w-full max-w-3xl animate-rise-in">
          <p className="text-sm font-medium uppercase tracking-widest text-white/50">Installer un appareil</p>
          <h1 className="mt-2 text-3xl font-bold">{state.step === 'choose' ? state.orgName : 'Installation…'}</h1>
          <p className="mt-3 text-lg text-white/70">Que doit faire cet appareil ?</p>

          {installedAs && state.step === 'choose' && (
            <p className="mx-auto mt-6 max-w-xl rounded-2xl bg-white/10 p-4 text-sm text-white/80">
              Cet appareil est déjà installé comme {installedAs === 'TV' ? 'écran d’affichage' : 'borne'}.
              Continuer le remplacera. <a href={installedAs === 'TV' ? '/tv/pair' : '/kiosk'} className="font-semibold text-white underline">Revenir à l’affichage actuel</a>
            </p>
          )}

          <div className="stagger mt-10 grid gap-4 sm:grid-cols-2">
            {ROLES.map(({ role, icon: Icon, title, text }) => {
              const busy = state.step === 'installing' && state.role === role
              return (
                <button key={role} type="button" disabled={state.step === 'installing'} onClick={() => install(role)}
                  className={cn('flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl border-2 p-8 transition-colors',
                    busy ? 'border-brand bg-brand/20' : 'border-white/15 bg-white/5 hover:border-white/40 focus-visible:border-white disabled:opacity-40')}>
                  {busy ? <Loader2 size={56} className="animate-spin" aria-hidden="true" /> : <Icon size={56} aria-hidden="true" />}
                  <span className="text-2xl font-bold">{title}</span>
                  <span className="text-sm text-white/60">{text}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-xs text-white/40">
            <CheckCircle2 size={14} aria-hidden="true" /> Lien sécurisé, à usage unique
          </p>
        </div>
      )}
    </main>
  )
}
