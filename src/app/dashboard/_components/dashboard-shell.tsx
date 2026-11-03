'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { LogOut, ShieldCheck, Headset, ConciergeBell, CreditCard } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { Button, Dialog, DashboardSkeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'
import { useDashboard } from './dashboard-context'
import { SiteSwitcher } from '@/components/sites/site-switcher'
import { SidebarShell, type SidebarGroup } from '@/components/layout/sidebar-shell'
import { getBillingBanner } from '@/server/actions/billing'
import { getNewAppointmentsCount } from '@/server/actions/appointments'
import { getDueFollowUpsCount } from '@/server/actions/customers'
import { usePathname } from 'next/navigation'
import { usePolling } from '@/hooks/use-polling'

const GROUPS: SidebarGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { href: '/dashboard', label: t('dashboard.tabs.overview'), icon: 'LayoutDashboard', exact: true },
      { href: '/dashboard/queue', label: t('dashboard.tabs.queue'), icon: 'ListOrdered' },
      { href: '/dashboard/agenda', label: t('dashboard.tabs.agenda'), icon: 'CalendarDays' },
      { href: '/dashboard/visitors', label: 'Visiteurs', icon: 'Contact' },
      { href: '/dashboard/followups', label: 'À faire', icon: 'ClipboardList' },
      { href: '/dashboard/campaigns', label: 'Campagnes', icon: 'MessageSquare' },
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
  const [banner, setBanner] = useState<Awaited<ReturnType<typeof getBillingBanner>>>(null)
  useEffect(() => { getBillingBanner().then(setBanner).catch(() => null) }, [])

  // Nouveaux rendez-vous depuis la dernière ouverture de l'Agenda (pastille du menu)
  const pathname = usePathname()
  const [newAppts, setNewAppts] = useState(0)
  const seenKey = 'lerena:agenda-seen'
  const checkAppts = useCallback(async () => {
    let since: string | null = null
    try { since = localStorage.getItem(seenKey) } catch {}
    if (!since) { since = new Date().toISOString(); try { localStorage.setItem(seenKey, since) } catch {} }
    setNewAppts(await getNewAppointmentsCount(since).catch(() => 0))
  }, [])
  useEffect(() => {
    if (!pathname.startsWith('/dashboard/agenda')) return
    try { localStorage.setItem(seenKey, new Date().toISOString()) } catch {}
    setNewAppts(0)
  }, [pathname])
  usePolling(checkAppts, 60_000, !pathname.startsWith('/dashboard/agenda'))
  // Suivis en retard ou du jour (pastille « À faire »), relus à chaque page
  const [dueFollowUps, setDueFollowUps] = useState(0)
  useEffect(() => { getDueFollowUpsCount().then(setDueFollowUps).catch(() => null) }, [pathname])
  const counts: Record<string, number> = { '/dashboard/agenda': newAppts, '/dashboard/followups': dueFollowUps }
  const groups = GROUPS.map(g => ({ ...g, items: g.items.map(i => (i.href in counts ? { ...i, count: counts[i.href] } : i)) }))

  if (loading && !stats) return <DashboardSkeleton />
  const isOpen = !!stats?.isOpen

  return (
    <SidebarShell
      eyebrow={t('dashboard.eyebrow')}
      title={stats?.orgName ?? '—'}
      groups={groups}
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
      {banner && <BillingBanner {...banner} />}
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

/** Rappel d'abonnement en haut de chaque page : essai bientôt terminé, paiement en retard, service suspendu. */
function BillingBanner({ state, daysLeft, until }: NonNullable<Awaited<ReturnType<typeof getBillingBanner>>>) {
  const day = until ? new Date(until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : ''
  const urgent = state === 'SUSPENDED' || state === 'CANCELLED'
  const text = state === 'TRIAL' ? `Votre essai gratuit se termine dans ${daysLeft} jour${daysLeft === 1 ? '' : 's'}. Choisissez votre forfait pour continuer sans interruption.`
    : state === 'GRACE' ? `Paiement en retard : le service en ligne sera suspendu le ${day}.`
    : state === 'CANCELLED' ? 'Abonnement résilié : les visiteurs ne peuvent plus prendre de ticket en ligne.'
    : 'Service en ligne suspendu : les visiteurs ne peuvent plus prendre de ticket. Réglez votre facture pour le rétablir.'
  return (
    <div role={urgent ? 'alert' : 'status'} className={cn('flex animate-rise-in flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm',
      urgent ? 'bg-danger-soft text-danger-ink' : state === 'GRACE' ? 'bg-warning-soft text-warning-ink' : 'bg-info-soft text-info-ink')}>
      <p className="flex items-center gap-2 font-medium"><CreditCard size={18} aria-hidden="true" />{text}</p>
      <Link href="/dashboard/billing" className="rounded-lg bg-white/70 px-3 py-1.5 font-semibold hover:bg-white">{state === 'TRIAL' ? 'Voir les forfaits' : 'Régler'}</Link>
    </div>
  )
}
