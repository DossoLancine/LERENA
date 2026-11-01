'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, ShieldCheck, Headset, ConciergeBell } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { Button, Dialog, DashboardSkeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'
import { useDashboard } from './dashboard-context'
import { SiteSwitcher } from '@/components/sites/site-switcher'
import { SidebarShell, type SidebarGroup } from '@/components/layout/sidebar-shell'

const GROUPS: SidebarGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { href: '/dashboard', label: t('dashboard.tabs.overview'), icon: 'LayoutDashboard', exact: true },
      { href: '/dashboard/queue', label: t('dashboard.tabs.queue'), icon: 'ListOrdered' },
      { href: '/dashboard/agenda', label: t('dashboard.tabs.agenda'), icon: 'CalendarDays' },
      { href: '/dashboard/analytics', label: t('dashboard.tabs.analytics'), icon: 'BarChart3' }
    ]
  },
  {
    label: 'Organisation',
    items: [
      { href: '/dashboard/services', label: t('dashboard.tabs.services'), icon: 'Layers' },
      { href: '/dashboard/counters', label: t('dashboard.tabs.counters'), icon: 'Store' },
      { href: '/dashboard/planning', label: t('dashboard.tabs.planning'), icon: 'CalendarClock' },
      { href: '/dashboard/promotions', label: t('dashboard.tabs.promotions'), icon: 'Megaphone' }
    ]
  },
  {
    label: 'Compte',
    items: [
      { href: '/dashboard/billing', label: 'Abonnement', icon: 'CreditCard' },
      { href: '/dashboard/settings', label: t('dashboard.tabs.settings'), icon: 'Settings', to: '/dashboard/settings/site' }
    ]
  }
]

/** Barre latérale du tableau de bord de l'établissement, commune à toutes ses pages. */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { stats, loading, toggleOpen } = useDashboard()
  const [showProfile, setShowProfile] = useState(false)

  if (loading && !stats) return <DashboardSkeleton />
  const isOpen = !!stats?.isOpen

  return (
    <SidebarShell
      eyebrow={t('dashboard.eyebrow')}
      title={stats?.orgName ?? '—'}
      groups={GROUPS}
      onProfile={() => setShowProfile(true)}
      header={<>
        <SiteSwitcher />
        <button
          onClick={toggleOpen}
          aria-pressed={isOpen}
          aria-label={t('dashboard.toggleOpen')}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
            isOpen ? 'border-green-200 bg-success-soft text-success-ink' : 'border-red-200 bg-danger-soft text-danger-ink'
          )}
        >
          <span className={cn('h-2 w-2 rounded-full animate-pulse', isOpen ? 'bg-success' : 'bg-danger')} />
          {isOpen ? t('common.open') : t('common.closed')}
          <span className="ml-auto font-medium opacity-70">{isOpen ? 'Fermer' : 'Ouvrir'}</span>
        </button>
      </>}
      footer={<div className="grid grid-cols-2 gap-1 pb-1">
        <Link href="/agent" className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 py-2 text-xs font-semibold text-ink-muted hover:bg-gray-100 hover:text-ink">
          <Headset size={14} aria-hidden="true" /> Guichet
        </Link>
        <Link href="/reception" className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 px-2 py-2 text-xs font-semibold text-ink-muted hover:bg-gray-100 hover:text-ink">
          <ConciergeBell size={14} aria-hidden="true" /> Accueil
        </Link>
      </div>}
    >
      {children}

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
    </SidebarShell>
  )
}
