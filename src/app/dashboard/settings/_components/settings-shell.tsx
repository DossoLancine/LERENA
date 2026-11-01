'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, QrCode, Tv, Users, Database, AlertCircle, MapPin, MonitorSmartphone, BookOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'
import { useSettings } from './settings-provider'

const SECTIONS: { slug: string; label: MessageKey; icon: ReactNode }[] = [
  { slug: 'site', label: 'settings.sections.site', icon: <Building2 size={15} /> },
  { slug: 'location', label: 'settings.sections.location', icon: <MapPin size={15} /> },
  { slug: 'poster', label: 'settings.sections.poster', icon: <QrCode size={15} /> },
  { slug: 'devices', label: 'settings.sections.devices', icon: <MonitorSmartphone size={15} /> },
  { slug: 'tv', label: 'settings.sections.tv', icon: <Tv size={15} /> },
  { slug: 'team', label: 'settings.sections.team', icon: <Users size={15} /> },
  { slug: 'data', label: 'settings.sections.data', icon: <Database size={15} /> },
  { slug: 'guide', label: 'settings.sections.guide', icon: <BookOpen size={15} /> },
]

/** Sous-navigation des Paramètres : chaque section a sa propre adresse. */
export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { loading, errorMsg, org } = useSettings()

  return (
    <div className="space-y-6">
      <nav className="hide-scrollbar flex items-center gap-2 overflow-x-auto border-b border-surface-line pb-2" aria-label={t('settings.title')}>
        {SECTIONS.map(s => {
          const href = `/dashboard/settings/${s.slug}`
          const active = pathname === href
          return (
            <Link
              key={s.slug}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition-all',
                active ? 'bg-brand text-white shadow-sm' : 'border border-surface-line bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {s.icon}
              {t(s.label)}
              {s.slug === 'team' && org?.members ? ` (${org.members.length})` : ''}
            </Link>
          )
        })}
      </nav>

      {errorMsg && (
        <div role="alert" className="flex items-center gap-3 rounded-card border border-red-200 bg-danger-soft p-4 text-sm font-medium text-danger-ink">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="h-12 w-1/2 animate-pulse rounded-card bg-gray-200/80" />
          <div className="h-80 animate-pulse rounded-card bg-gray-200/80" />
        </div>
      ) : (
        children
      )}
    </div>
  )
}
