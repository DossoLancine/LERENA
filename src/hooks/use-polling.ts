'use client'

import { useEffect, useRef } from 'react'

/**
 * Rafraîchit des données à intervalle régulier, sans jamais empiler les requêtes :
 * l'appel suivant n'est programmé qu'une fois le précédent terminé.
 * Les actions serveur Next.js s'exécutant une par une, un setInterval classique
 * crée une file qui grossit dès que le réseau ralentit et bloque toute l'interface.
 * Le rafraîchissement se met en pause quand l'onglet est masqué et reprend au retour.
 */
export function usePolling(fn: () => Promise<unknown> | void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return

    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    let running = false

    const tick = async () => {
      if (cancelled || running) return
      if (typeof document !== 'undefined' && document.hidden) return
      running = true
      try {
        await fnRef.current()
      } catch (e) {
        console.error('Polling error:', e)
      } finally {
        running = false
        if (!cancelled) timer = setTimeout(tick, intervalMs)
      }
    }

    const onVisibility = () => {
      if (!document.hidden && !running) {
        clearTimeout(timer)
        tick()
      }
    }

    tick()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}
