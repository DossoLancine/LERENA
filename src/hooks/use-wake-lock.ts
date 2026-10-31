'use client'

import { useEffect } from 'react'

/**
 * Empêche l'écran de se mettre en veille tant que active est vrai
 * (tour qui approche, ticket appelé). Ignoré si le navigateur ne le permet pas.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release()
      } catch {}
    }
    // Le verrou est perdu quand l'onglet passe en arrière-plan : on le reprend au retour
    const onVisibility = () => { if (!document.hidden && !cancelled) acquire() }

    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release().catch(() => {})
    }
  }, [active])
}
