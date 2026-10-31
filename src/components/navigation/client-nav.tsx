'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Compass, Ticket, Heart, User as UserIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'

const ITEMS: { href: string; label: MessageKey; icon: typeof Home }[] = [
  { href: '/home', label: 'nav.home', icon: Home },
  { href: '/explore', label: 'nav.explore', icon: Compass },
  { href: '/tickets', label: 'nav.tickets', icon: Ticket },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/profile', label: 'nav.profile', icon: UserIcon },
]

/** Barre de navigation du bas pour l'espace usager : une seule définition pour toutes les pages. */
export function ClientNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-line bg-white/95 backdrop-blur safe-bottom" aria-label="Navigation principale">
      <ul className="mx-auto flex max-w-lg items-center justify-around px-2 py-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-touch min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-3 transition-colors active:scale-95',
                  active ? 'text-brand' : 'text-ink-subtle hover:text-ink-muted'
                )}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[11px] font-medium">{t(label)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
