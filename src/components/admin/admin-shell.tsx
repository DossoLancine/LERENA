'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useSlidingIndicator } from '@/hooks/use-sliding-indicator'

export interface AdminTab { href: string; label: string; exact?: boolean }

/** En-tête et onglets communs aux espaces réseau (/org-admin) et plateforme (/admin). */
export function AdminShell({ eyebrow, title, badge, tabs, children }: {
  eyebrow: string
  title: string
  badge?: string
  tabs: AdminTab[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)
  const indicator = useSlidingIndicator(navRef, pathname)
  return (
    <div className="min-h-screen bg-surface-sunken print:bg-white">
      <header className="border-b border-surface-line bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted">{eyebrow}</p>
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-ink">{title}</h1>
              {badge && <Badge tone="info">{badge}</Badge>}
            </div>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/pro/login' })}
            className="inline-flex min-h-touch items-center gap-2 rounded-control px-3 text-sm font-semibold text-ink-muted hover:bg-gray-100">
            <LogOut size={16} aria-hidden="true" /> Déconnexion
          </button>
        </div>
        <nav ref={navRef} aria-label={eyebrow} className="hide-scrollbar relative mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-xl bg-brand shadow-sm transition-[transform,width,opacity] duration-500 ease-spring" style={indicator} />
          {tabs.map(tab => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
            return (
              <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}
                className={cn('relative z-10 shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-ink-muted hover:bg-gray-100')}>
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4 pb-10">{children}</main>
    </div>
  )
}
