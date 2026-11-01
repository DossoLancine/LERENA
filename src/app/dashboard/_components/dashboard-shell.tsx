'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Settings, User as UserIcon, LogOut } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { Button, Dialog, IconButton, DashboardSkeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'
import { useDashboard } from './dashboard-context'

const TABS: { href: string; label: MessageKey }[] = [
  { href: '/dashboard', label: 'dashboard.tabs.overview' },
  { href: '/dashboard/queue', label: 'dashboard.tabs.queue' },
  { href: '/dashboard/agenda', label: 'dashboard.tabs.agenda' },
  { href: '/dashboard/services', label: 'dashboard.tabs.services' },
  { href: '/dashboard/counters', label: 'dashboard.tabs.counters' },
  { href: '/dashboard/planning', label: 'dashboard.tabs.planning' },
  { href: '/dashboard/analytics', label: 'dashboard.tabs.analytics' },
  { href: '/dashboard/promotions', label: 'dashboard.tabs.promotions' },
  { href: '/dashboard/settings', label: 'dashboard.tabs.settings' },
]

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href)
}

/** En-tête et onglets du tableau de bord, communs à toutes ses pages. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { stats, loading, toggleOpen } = useDashboard()
  const [showProfile, setShowProfile] = useState(false)

  if (loading && !stats) return <DashboardSkeleton />

  const isOpen = !!stats?.isOpen

  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="border-b border-surface-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted">{t('dashboard.eyebrow')}</p>
            <h1 className="truncate text-lg font-bold text-ink">{stats?.orgName ?? '—'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleOpen}
              aria-pressed={isOpen}
              aria-label={t('dashboard.toggleOpen')}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
                isOpen ? 'border-green-200 bg-success-soft text-success-ink' : 'border-red-200 bg-danger-soft text-danger-ink'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', isOpen ? 'bg-success' : 'bg-danger')} />
              {isOpen ? t('common.open') : t('common.closed')}
            </button>
            <Link href="/dashboard/settings" aria-label={t('dashboard.settingsShortcut')} title={t('dashboard.settingsShortcut')}
              className={cn('inline-flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-95',
                pathname.startsWith('/dashboard/settings') ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
              <Settings size={18} />
            </Link>
            <IconButton label={t('dashboard.myProfile')} tone="brand" onClick={() => setShowProfile(true)}>
              <UserIcon size={18} />
            </IconButton>
          </div>
        </div>

        <nav className="hide-scrollbar mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3" aria-label={t('dashboard.eyebrow')}>
          {TABS.map(tab => {
            const active = isActive(pathname, tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  active ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-gray-100'
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
          <Button variant="secondary" fullWidth icon={<LogOut size={16} />} onClick={() => signOut()} className="text-danger">
            {t('common.logout')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
