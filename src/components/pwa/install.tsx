'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, Share, PlusSquare, X } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'

// Installation de l'application (PWA).
// Android et ordinateur : le navigateur fournit une invite qu'on garde pour la déclencher au bon moment.
// iPhone : Safari n'a pas d'invite, on explique « Partager → Sur l'écran d'accueil ».

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'prompt' | 'ios' | 'installed' | 'unsupported'

let deferred: InstallPromptEvent | null = null
let platform: Platform = 'unsupported'
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

function detect(): Platform {
  if (typeof window === 'undefined') return 'unsupported'
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
  if (standalone) return 'installed'
  if (deferred) return 'prompt'
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return ios ? 'ios' : 'unsupported'
}

if (typeof window !== 'undefined') {
  platform = detect()
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    platform = 'prompt'
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    platform = 'installed'
    emit()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Ce que l'appareil permet : invite d'installation, instructions iPhone, déjà installée, ou rien. */
export function useInstallPlatform(): Platform {
  return useSyncExternalStore(subscribe, () => platform, () => 'unsupported')
}

async function promptInstall() {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  platform = outcome === 'accepted' ? 'installed' : detect()
  emit()
  return outcome === 'accepted'
}

/** Enregistre le service worker dès l'ouverture : c'est ce qui rend l'application installable. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    const register = () => navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service worker:', err))
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])
  return null
}

/** Instructions pour iPhone / iPad (Safari ne propose pas d'invite d'installation). */
function IosInstructions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-lg font-bold text-ink">Installer Lerena sur l’iPhone</h2>
      <ol className="stagger mt-4 space-y-3 text-sm text-ink">
        <li className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-info shadow-card"><Share size={18} aria-hidden="true" /></span>
          <span>Touchez <strong>Partager</strong> dans la barre de Safari</span>
        </li>
        <li className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-ink shadow-card"><PlusSquare size={18} aria-hidden="true" /></span>
          <span>Choisissez <strong>Sur l’écran d’accueil</strong></span>
        </li>
        <li className="flex items-center gap-3 rounded-2xl bg-surface-sunken p-3">
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-xl" />
          <span>Touchez <strong>Ajouter</strong> : Lerena s’ouvre ensuite comme une application</span>
        </li>
      </ol>
      <p className="mt-3 text-xs text-ink-muted">Sur iPhone, l’installation n’est possible que depuis Safari.</p>
      <Button fullWidth className="mt-5" onClick={onClose}>J’ai compris</Button>
    </BottomSheet>
  )
}

/** Bouton « Installer l'application », affiché seulement si l'appareil le permet. */
export function InstallAppButton({ className }: { className?: string }) {
  const p = useInstallPlatform()
  const [iosOpen, setIosOpen] = useState(false)
  if (p !== 'prompt' && p !== 'ios') return null
  return (
    <>
      <Button variant="secondary" fullWidth icon={<Download size={16} />} className={className}
        onClick={() => (p === 'prompt' ? promptInstall() : setIosOpen(true))}>
        Installer l’application
      </Button>
      <IosInstructions open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  )
}

const DISMISS_KEY = 'attends_install_dismissed'
const DISMISS_DAYS = 14

/** Carte discrète au-dessus de la barre du bas, une fois par période, pour proposer l'installation. */
export function InstallBanner() {
  const p = useInstallPlatform()
  const [hidden, setHidden] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [iosOpen, setIosOpen] = useState(false)

  useEffect(() => {
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
      setHidden(Date.now() - at < DISMISS_DAYS * 86400_000)
    } catch {
      setHidden(false)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setLeaving(true)
    setTimeout(() => setHidden(true), 180)
  }

  if (hidden || (p !== 'prompt' && p !== 'ios')) return <IosInstructions open={iosOpen} onClose={() => setIosOpen(false)} />

  return (
    <>
      <div className={`fixed inset-x-3 bottom-[84px] z-30 mx-auto max-w-lg ${leaving ? 'animate-pop-out' : 'animate-rise-in'}`} role="region" aria-label="Installer l’application">
        <div className="flex items-center gap-3 rounded-2xl bg-gray-900 p-3 pr-2 text-white shadow-raised">
          <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Installer Lerena</p>
            <p className="text-xs text-gray-300">Accès en un geste et alertes même écran verrouillé</p>
          </div>
          <button type="button" onClick={async () => { if (p === 'prompt') { if (await promptInstall()) dismiss() } else setIosOpen(true) }}
            className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-900">
            Installer
          </button>
          <button type="button" onClick={dismiss} aria-label="Plus tard" className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-300 hover:bg-white/10">
            <X size={16} />
          </button>
        </div>
      </div>
      <IosInstructions open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  )
}
