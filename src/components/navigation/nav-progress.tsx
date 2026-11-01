'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type Phase = 'idle' | 'loading' | 'done'

/**
 * Fine barre de progression en haut de l'écran : elle part dès qu'on touche un lien interne
 * et se termine à l'arrivée de la page. L'utilisateur sait tout de suite que son geste est pris en compte.
 */
export function NavProgress() {
  const pathname = usePathname()
  const [phase, setPhase] = useState<Phase>('idle')

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as HTMLElement).closest('a')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin || url.pathname === location.pathname) return
      setPhase('loading')
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // La nouvelle page est là : la barre se remplit puis s'efface
  useEffect(() => {
    setPhase(p => (p === 'loading' ? 'done' : p))
  }, [pathname])

  useEffect(() => {
    if (phase === 'done') {
      const t = setTimeout(() => setPhase('idle'), 400)
      return () => clearTimeout(t)
    }
    if (phase === 'loading') {
      // Garde-fou : jamais de barre bloquée si la navigation a été annulée
      const t = setTimeout(() => setPhase('idle'), 10_000)
      return () => clearTimeout(t)
    }
  }, [phase])

  if (phase === 'idle') return null
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className={phase === 'loading' ? 'nav-progress h-full bg-brand' : 'h-full bg-brand transition-[transform,opacity] duration-300'}
        style={phase === 'done' ? { transform: 'scaleX(1)', transformOrigin: 'left', opacity: 0 } : undefined}
      />
    </div>
  )
}
