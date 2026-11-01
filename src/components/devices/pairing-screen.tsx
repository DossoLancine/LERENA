'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Tv, Tablet, MonitorSmartphone, Loader2 } from 'lucide-react'
import { getDeviceStatus, startPairing, type DeviceType, type PairingType } from '@/server/actions/devices'
import { usePolling } from '@/hooks/use-polling'
import { t } from '@/lib/i18n'

export const deviceTokenKey = (type: PairingType) => `attends_device_${type.toLowerCase()}`

export function readDeviceToken(type: PairingType) {
  try { return localStorage.getItem(deviceTokenKey(type)) } catch { return null }
}

/**
 * Écran d'appairage d'une TV ou d'une borne : affiche un code à 6 chiffres que le responsable
 * saisit dans le tableau de bord. L'appareil se connecte seul dès que le code est validé.
 */
export function PairingScreen({ type, onPaired }: {
  type: PairingType
  onPaired: (status: { orgId: string; siteId?: string | null; name: string | null; type: DeviceType; token: string }) => void
}) {
  const [code, setCode] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const failures = useRef(0)
  // Une fois connecté, on arrête de vérifier : sinon la navigation vers l'écran repartirait toutes les 3 s
  const done = useRef(false)

  // Jeton existant (appareil déjà enregistré), sinon nouvelle demande de code
  useEffect(() => {
    const existing = readDeviceToken(type)
    if (existing) {
      setToken(existing)
      return
    }
    startPairing(type).then(res => {
      if (!res) return
      try { localStorage.setItem(deviceTokenKey(type), res.token) } catch {}
      setToken(res.token)
      setCode(res.pairingCode)
    })
  }, [type])

  const check = useCallback(async () => {
    if (!token || done.current) return
    let status: Awaited<ReturnType<typeof getDeviceStatus>>
    try {
      status = await getDeviceStatus(token)
      failures.current = 0
    } catch (error) {
      // Serveur injoignable plusieurs fois de suite (souvent : nouvelle version en ligne) :
      // on recharge pour ne jamais laisser affiché un code périmé
      if (++failures.current >= 3) location.reload()
      throw error
    }
    if (!status) {
      // Jeton inconnu (appareil retiré) : on repart de zéro
      try { localStorage.removeItem(deviceTokenKey(type)) } catch {}
      const res = await startPairing(type)
      if (res) {
        try { localStorage.setItem(deviceTokenKey(type), res.token) } catch {}
        setToken(res.token)
        setCode(res.pairingCode)
      }
      return
    }
    if (status.paired) {
      done.current = true
      onPaired({ orgId: status.orgId!, siteId: status.siteId ?? null, name: status.name ?? null, type: status.type === 'KIOSK' ? 'KIOSK' : 'TV', token })
    }
    else setCode(status.code ?? null)
  }, [token, type, onPaired])

  usePolling(check, 3000, !!token && !done.current)

  const origin = typeof window !== 'undefined' ? window.location.host : ''

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-8 text-center text-white">
      <span className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand">
        {type === 'TV' ? <Tv size={40} /> : type === 'KIOSK' ? <Tablet size={40} /> : <MonitorSmartphone size={40} />}
      </span>
      <h1 className="text-3xl font-bold">{type === 'TV' ? t('pairing.titleTv') : type === 'KIOSK' ? t('pairing.titleKiosk') : t('pairing.titleAny')}</h1>
      <p className="mt-3 max-w-xl text-lg text-white/70">{t('pairing.instructions')}</p>

      <div className="my-10 flex gap-3" aria-live="polite" aria-label={t('pairing.codeLabel')}>
        {code ? (
          code.split('').map((digit, i) => (
            <span key={i} className="flex h-24 w-16 items-center justify-center rounded-2xl bg-white/10 font-mono text-6xl font-black tabular-nums sm:h-28 sm:w-20 sm:text-7xl">
              {digit}
            </span>
          ))
        ) : (
          <Loader2 size={48} className="animate-spin text-white/50" />
        )}
      </div>

      <p className="text-sm text-white/50">{t('pairing.path')}</p>
      <p className="mt-6 text-xs text-white/30">{origin} · {t('pairing.waiting')}</p>
    </main>
  )
}

/**
 * Après l'appairage : range le jeton sous le rôle choisi par le responsable et renvoie l'adresse à ouvrir.
 * Le rôle choisi l'emporte sur le lien ouvert sur l'appareil.
 */
export function adoptDeviceRole({ orgId, type, token, siteId }: { orgId: string; type: DeviceType; token: string; siteId?: string | null }) {
  try {
    for (const key of ['TV', 'KIOSK', 'ANY'] as const) if (key !== type) localStorage.removeItem(deviceTokenKey(key))
    localStorage.setItem(deviceTokenKey(type), token)
  } catch {}
  // L'écran affiche la file de son site
  return type === 'TV' ? `/tv/${orgId}${siteId ? `?site=${siteId}` : ''}` : '/kiosk'
}
