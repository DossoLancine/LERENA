'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/**
 * Position de la pastille qui glisse sous l'onglet actif d'une barre d'onglets.
 * L'onglet actif est repéré par aria-current="page" ; la pastille suit aussi les redimensionnements.
 * Au premier affichage elle se place sans animation, ensuite elle glisse.
 */
export function useSlidingIndicator(containerRef: RefObject<HTMLElement>, key: string): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })
  const first = useRef(true)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const place = () => {
      const active = container.querySelector<HTMLElement>('[aria-current="page"]')
      if (!active) return setStyle({ opacity: 0 })
      setStyle({
        opacity: 1,
        width: active.offsetWidth,
        height: active.offsetHeight,
        transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`,
        transition: first.current ? 'none' : undefined
      })
      first.current = false
    }

    place()
    // Ramène l'onglet actif dans la zone visible quand la barre défile (téléphone)
    container.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })

    const observer = new ResizeObserver(place)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, key])

  return style
}
