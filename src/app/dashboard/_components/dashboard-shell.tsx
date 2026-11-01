'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Settings, User as UserIcon, LogOut, ShieldCheck } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { Button, Dialog, IconButton, DashboardSkeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'
import { useDashboard } from './dashboard-context'
import { useSlidingIndicator } from '@/hooks/use-sliding-indicator'
import { SiteSwitcher } from '@/components/sites/site-switcher'

// « to » : adresse ouverte au clic quand elle diffère de la section (les Paramètres ouvrent directement leur 1re page)
const TABS: { href: string; label: MessageKey; to?: string }[] = [
  { href: '/dashboard', label: 'dashboard.tabs.overview' },
  { href: '/dashboard/queue', label: 'dashboard.tabs.queue' },
  { href: '/dashboard/agenda', label: 'dashboard.tabs.agenda' },
  { href: '/dashboard/services', label: 'dashboard.tabs.services' },
  { href: '/dashboard/counters', label: 'dashboard.tabs.counters' },
  { href: '/dashboard/planning', label: 'dashboard.tabs.planning' },
  { href: '/dashboard/analytics', label: 'dashboard.tabs.analytics' },
  { href: '/dashboard/promotions', label: 'dashboard.tabs.promotions' },
  { href: '/dashboard/settings', label: 'dashboard.tabs.settings', to: '/dashboard/settings/site' },
]

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

/** En-tête et onglets du tableau de bord, communs à toutes ses pages. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { stats, loading, toggleOpen } = useDashboard()
  const [showProfile, setShowProfile] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const indicator = useSlidingIndicator(navRef, `${pathname}:${!!stats}`)

  if (loading && !stats) return <DashboardSkeleton />

  const isOpen = !!stats?.isOpen

  return (
    <div className="min-h-screen bg-surface-sunken print:bg-white">
      <header className="border-b border-surface-line bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted">{t('dashboard.eyebrow')}</p>
            <h1 className="truncate text-lg font-bold text-ink">{stats?.orgName ?? '—'}</h1>
            <SiteSwitcher className="mt-1" />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleOpen}
              aria-pressed={isOpen}
              aria-label={t('dashboard.toggleOpen')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                isOpen ? 'border-green-200 bg-success-soft text-success-ink' : 'border-red-200 bg-danger-soft text-danger-ink'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', isOpen ? 'bg-success' : 'bg-danger')} />
              {isOpen ? t('common.open') : t('common.closed')}
            </button>
            <Link href="/dashboard/settings/site" aria-label={t('dashboard.settingsShortcut')} title={t('dashboard.settingsShortcut')}
              className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full transition-all',
                pathname.startsWith('/dashboard/settings') ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
              <Settings size={18} />
            </Link>
            <IconButton label={t('dashboard.myProfile')} tone="brand" onClick={() => setShowProfile(true)}>
              <UserIcon size={18} />
            </IconButton>
          </div>
        </div>

        <nav ref={navRef} className="hide-scrollbar relative mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3" aria-label={t('dashboard.eyebrow')}>
          <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-xl bg-brand shadow-sm transition-[transform,width,opacity] duration-500 ease-spring" style={indicator} />
          {TABS.map(tab => {
            const active = isActive(pathname, tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.to ?? tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative z-10 shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-ink-muted hover:bg-gray-100'
                )}
              >
                {t(tab.label)}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4 pb-10">{children}</main>

      <Dialog open={showProfile} onClose={() => setShowProfile(false)} title={t('dashboard.myProfile')}>
        <div className="flex flex-col gap-4">
          <UserProfileForm theme="orange" />
          <Link href="/account/security" onClick={() => setShowProfile(false)} className="flex min-h-touch items-center justify-center gap-2 rounded-control border border-gray-200 text-sm font-semibold text-ink">
            <ShieldCheck size={16} aria-hidden="true" /> Sécurité du compte (mot de passe, double authentification)
          </Link>
          <Button variant="secondary" fullWidth icon={<LogOut size={16} />} onClick={() => signOut()} className="text-danger">
            {t('common.logout')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
