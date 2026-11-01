'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Ticket, Heart, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'
import { InstallBanner } from '@/components/pwa/install'

const ITEMS: { href: string; label: MessageKey; icon: typeof Home }[] = [
  { href: '/home', label: 'nav.home', icon: Home },
  { href: '/explore', label: 'nav.explore', icon: Compass },
  { href: '/tickets', label: 'nav.tickets', icon: Ticket },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/profile', label: 'nav.profile', icon: UserIcon },
]

/**
 * Barre de navigation du bas de l'espace usager, posée une seule fois dans la mise en page racine :
 * elle reste à l'écran d'un onglet à l'autre (même pendant les chargements), comme dans une app native.
 * Une pastille glisse sous l'onglet actif et son icône rebondit. Elle n'apparaît que sur ses 5 onglets.
 */
export function ClientNav() {
  const pathname = usePathname()
  const activeIndex = ITEMS.findIndex(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
  const previous = useRef(activeIndex)
  const changed = previous.current !== activeIndex && previous.current >= 0

  useEffect(() => {
    previous.current = activeIndex
  }, [activeIndex])

  if (activeIndex < 0) return null

  return (
    <>
    <InstallBanner />
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-line bg-white/90 backdrop-blur-lg safe-bottom print:hidden" aria-label="Navigation principale">
      <ul className="relative mx-auto grid max-w-lg grid-cols-5 px-2 py-1.5">
        <li aria-hidden="true" className="pointer-events-none absolute inset-y-1.5 left-2 w-[calc((100%-1rem)/5)] transition-transform duration-500 ease-spring"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}>
          <span className="mx-auto block h-full w-[64px] rounded-2xl bg-brand-50" />
        </li>
        {ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = i === activeIndex
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch flex-col items-center justify-center gap-0.5 rounded-xl px-1',
                  active ? 'text-brand' : 'text-ink-subtle hover:text-ink-muted'
                )}
              >
                {/* La clé change à chaque sélection : l'icône rebondit une fois */}
                <Icon key={active && changed ? pathname : href} size={21} strokeWidth={active ? 2.4 : 2}
                  className={active && changed ? 'animate-icon-bounce' : undefined} aria-hidden="true" />
                <span className={cn('text-[11px] transition-colors', active ? 'font-semibold' : 'font-medium')}>{t(label)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
    </>
  )
}
