'use client'

import { useEffect } from 'react'

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID
const CHECK_MS = 60_000
// Délai sans interaction avant de recharger : on ne coupe jamais quelqu'un en pleine saisie
const IDLE_MS = 20_000

/**
 * Après une mise en ligne, une page restée ouverte (TV, borne, poste agent…) ne peut plus appeler
 * le serveur. On compare régulièrement la version en ligne ; si elle a changé, la page se recharge
 * dès que personne ne s'en sert, ou au prochain lien touché.
 */
export function DeploymentWatcher() {
  useEffect(() => {
    if (!CURRENT || process.env.NODE_ENV !== 'production') return
    let stale = false
    let lastInput = Date.now()

    const busy = () => {
      const el = document.activeElement
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)
    }
    const reloadIfIdle = () => {
      if (stale && Date.now() - lastInput > IDLE_MS && !busy() && !document.querySelector('[role="dialog"]')) location.reload()
    }

    const check = async () => {
      if (stale || document.hidden) return
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        const { version } = await res.json()
        if (version && version !== CURRENT) stale = true
      } catch {
        // Hors ligne : on réessaiera
      }
      reloadIfIdle()
    }

    const onInput = () => { lastInput = Date.now() }
    // Version périmée : le prochain lien interne ouvre la page en entier, avec la nouvelle version
    const onClick = (e: MouseEvent) => {
      if (!stale || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const link = (e.target as HTMLElement).closest('a')
      if (!link || link.target === '_blank') return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin) return
      e.preventDefault()
      location.href = url.href
    }

    const timer = setInterval(() => { check() }, CHECK_MS)
    const idleTimer = setInterval(reloadIfIdle, 5_000)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('click', onClick, true)
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, onInput, { passive: true })

    return () => {
      clearInterval(timer)
      clearInterval(idleTimer)
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('click', onClick, true)
      for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.removeEventListener(ev, onInput)
    }
  }, [])

  return null
}
