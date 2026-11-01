'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  BarChart3, BookOpen, Building2, CalendarClock, CalendarDays, ChevronsLeft, ClipboardList, CreditCard, FileText,
  Gauge, Headset, LayoutDashboard, Layers, ListOrdered, LogOut, Megaphone, Menu, MessageSquare, MonitorSmartphone,
  Network, Package, Receipt, Settings, ShieldCheck, Sparkles, Store, Tags, Users, Wallet, X, type LucideIcon
} from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { useSlidingIndicator } from '@/hooks/use-sliding-indicator'

// Icônes désignées par leur nom : les mises en page serveur ne peuvent pas transmettre de composants
const ICONS = {
  BarChart3, BookOpen, Building2, CalendarClock, CalendarDays, ClipboardList, CreditCard, FileText, Gauge, Headset,
  LayoutDashboard, Layers, ListOrdered, Megaphone, MessageSquare, MonitorSmartphone, Network, Package, Receipt,
  Settings, ShieldCheck, Sparkles, Store, Tags, Users, Wallet
} satisfies Record<string, LucideIcon>
export type SidebarIcon = keyof typeof ICONS

export interface SidebarItem {
  href: string
  label: string
  icon: SidebarIcon
  /** Actif seulement sur l'adresse exacte (page d'accueil d'un espace). */
  exact?: boolean
  /** Adresse ouverte au clic quand elle diffère de la section (ex. Paramètres → 1re page). */
  to?: string
  /** Petit compteur à droite (ex. factures en retard). */
  count?: number
}
export interface SidebarGroup { label?: string; items: SidebarItem[] }

const COLLAPSED_KEY = 'attends:sidebar-collapsed'

const isActive = (pathname: string, item: SidebarItem) =>
  item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)

/**
 * Mise en page des espaces de gestion (établissement, réseau, plateforme) :
 * barre latérale fixe sur ordinateur (repliable en icônes), tiroir animé sur téléphone.
 */
export function SidebarShell({ eyebrow, title, badge, groups, header, footer, onProfile, children }: {
  eyebrow: string
  title: string
  badge?: string
  groups: SidebarGroup[]
  /** Contenu sous le titre (choix du site, ouverture…). */
  header?: ReactNode
  /** Contenu au-dessus du compte (raccourcis). */
  footer?: ReactNode
  /** Ouvre la fiche profil ; sinon le bouton mène à « Sécurité du compte ». */
  onProfile?: () => void
  children: ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const indicator = useSlidingIndicator(navRef, `${pathname}:${collapsed}:${drawer}`)

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1') } catch {} }, [])
  const toggleCollapsed = () => setCollapsed(c => {
    try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch {}
    return !c
  })

  // Le tiroir se referme à chaque navigation et avec Échap
  useEffect(() => { setDrawer(false) }, [pathname])
  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [drawer])

  const current = groups.flatMap(g => g.items).find(i => isActive(pathname, i))
  const narrow = collapsed && !drawer

  const panel = (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-start gap-2 px-4 pb-3 pt-5', narrow && 'justify-center px-2')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-sm font-black text-white shadow-sm" aria-hidden="true">
          {title.trim().charAt(0).toUpperCase() || 'A'}
        </span>
        {!narrow && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{eyebrow}</p>
            <p className="flex items-center gap-1.5">
              <span className="truncate text-sm font-bold text-ink" title={title}>{title}</span>
              {badge && <Badge tone="info">{badge}</Badge>}
            </p>
          </div>
        )}
        <button type="button" onClick={() => setDrawer(false)} aria-label="Fermer le menu" className="-mr-1 rounded-lg p-1.5 text-ink-muted hover:bg-gray-100 lg:hidden">
          <X size={18} />
        </button>
      </div>
      {header && !narrow && <div className="space-y-2 px-4 pb-3">{header}</div>}

      <nav ref={navRef} aria-label={eyebrow} className="hide-scrollbar relative flex-1 overflow-y-auto px-3 pb-4">
        <span aria-hidden="true" className="pointer-events-none absolute left-0 top-0 rounded-xl bg-brand shadow-md shadow-brand/20 transition-[transform,width,height,opacity] duration-500 ease-spring" style={indicator} />
        <div className={cn(drawer && 'stagger')}>
          {groups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && 'mt-4')}>
              {group.label && (narrow
                ? <hr className="mx-2 mb-2 border-surface-line" />
                : <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{group.label}</p>)}
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = ICONS[item.icon]
                  const active = isActive(pathname, item)
                  return (
                    <li key={item.href}>
                      <Link href={item.to ?? item.href} aria-current={active ? 'page' : undefined} title={narrow ? item.label : undefined}
                        className={cn('group relative z-10 flex min-h-[40px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200',
                          narrow && 'justify-center px-0',
                          active ? 'text-white' : 'text-ink-muted hover:bg-gray-100 hover:text-ink')}>
                        <Icon size={18} aria-hidden="true" className={cn('shrink-0 transition-transform duration-300 ease-spring group-hover:scale-110', active && 'scale-110')} />
                        {!narrow && <span className="truncate">{item.label}</span>}
                        {!!item.count && (narrow
                          ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" aria-label={`${item.count}`} />
                          : <span className={cn('ml-auto rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-white/25 text-white' : 'bg-danger-soft text-danger-ink')}>{item.count}</span>)}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className={cn('space-y-1 border-t border-surface-line p-3', narrow && 'px-2')}>
        {!narrow && footer}
        <div className={cn('flex items-center gap-1', narrow && 'flex-col')}>
          {onProfile ? (
            <button type="button" onClick={onProfile} title="Mon profil" className={cn('flex min-h-[40px] flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-gray-100 hover:text-ink', narrow && 'justify-center px-0')}>
              <Users size={18} aria-hidden="true" />{!narrow && 'Mon profil'}
            </button>
          ) : (
            <Link href="/account/security" title="Sécurité du compte" className={cn('flex min-h-[40px] flex-1 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-gray-100 hover:text-ink', narrow && 'justify-center px-0')}>
              <ShieldCheck size={18} aria-hidden="true" />{!narrow && 'Mon compte'}
            </Link>
          )}
          <button type="button" onClick={() => signOut({ callbackUrl: '/pro/login' })} aria-label="Déconnexion" title="Déconnexion"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-muted hover:bg-danger-soft hover:text-danger">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={toggleCollapsed} aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'} title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          className={cn('hidden min-h-[36px] w-full items-center gap-3 rounded-xl px-3 text-xs font-medium text-ink-subtle hover:bg-gray-100 lg:flex', narrow && 'justify-center px-0')}>
          <ChevronsLeft size={16} aria-hidden="true" className={cn('transition-transform duration-500 ease-spring', collapsed && 'rotate-180')} />
          {!narrow && 'Replier'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-sunken print:bg-white">
      {/* Ordinateur : barre fixe */}
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden border-r border-surface-line bg-white transition-[width] duration-500 ease-spring print:hidden lg:block',
        collapsed ? 'w-[76px]' : 'w-64')}>
        {!drawer && panel}
      </aside>

      {/* Téléphone et tablette : barre du haut + tiroir */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-surface-line bg-white/90 px-4 py-3 backdrop-blur print:hidden lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" aria-expanded={drawer} className="-ml-1 rounded-xl p-2 text-ink hover:bg-gray-100">
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-ink-subtle">{title}</p>
          <p key={current?.href} className="animate-rise-in truncate text-sm font-bold text-ink">{current?.label ?? eyebrow}</p>
        </div>
      </header>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" onClick={() => setDrawer(false)} className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" />
          <aside className="animate-drawer-in absolute inset-y-0 left-0 w-[84%] max-w-[300px] bg-white shadow-2xl">{panel}</aside>
        </div>
      )}

      <div className={cn('transition-[padding] duration-500 ease-spring', collapsed ? 'lg:pl-[76px]' : 'lg:pl-64')}>
        <main key={pathname.split('/').slice(0, 3).join('/')} className="mx-auto max-w-6xl animate-page-in space-y-4 px-4 py-5 pb-10 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  )
}
