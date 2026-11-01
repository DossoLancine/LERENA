'use client'

import { useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import { getSitesOverview, setActiveSite } from '@/server/actions/sites'
import { cn } from '@/lib/cn'

type Overview = NonNullable<Awaited<ReturnType<typeof getSitesOverview>>>

/**
 * Choix du site sur lequel on travaille (tableau de bord, accueil).
 * N'apparaît qu'à partir de deux sites ; « Tous les sites » donne la vue consolidée.
 */
export function SiteSwitcher({ allowAll = true, className, dark = false }: { allowAll?: boolean; className?: string; dark?: boolean }) {
  const [data, setData] = useState<Overview | null>(null)
  useEffect(() => { getSitesOverview().then(setData).catch(() => {}) }, [])
  if (!data || data.sites.length < 2) return null

  const change = async (value: string) => {
    await setActiveSite(value)
    // Toutes les données de l'écran dépendent du site : rechargement complet
    window.location.reload()
  }

  return (
    <label className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', dark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-surface-line bg-white text-ink', className)}>
      <MapPin size={13} className="shrink-0 text-brand" aria-hidden="true" />
      <span className="sr-only">Site</span>
      <select value={data.activeId ?? 'all'} onChange={e => change(e.target.value)} className="max-w-[180px] cursor-pointer bg-transparent outline-none">
        {data.sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.isActive ? '' : ' (fermé)'}</option>)}
        {allowAll && <option value="all">Tous les sites</option>}
      </select>
    </label>
  )
}
