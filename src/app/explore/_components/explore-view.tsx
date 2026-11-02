'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Clock, History, LocateFixed, Map as MapIcon, MapPin, Search, Sparkles, Star, Users, X } from 'lucide-react'
import { DynamicIcon } from '@/lib/icons'
import { getOrganizations } from '@/server/actions/orgs'
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/cn'

// Carte Leaflet chargée seulement dans le navigateur
const ExploreMap = dynamic(() => import('@/components/maps/explore-map'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-[#eef1f4]"><MapIcon size={32} className="text-ink-subtle/40" /></div>
})

type Org = Awaited<ReturnType<typeof getOrganizations>>[number]
type Snap = 'peek' | 'half' | 'full'
const RECENT_KEY = 'lerena:recent-searches'
// Hauteur visible de la liste selon sa position (la barre de navigation fait ~68 px)
const SNAP_VH: Record<Snap, number> = { peek: 22, half: 52, full: 86 }

/** Explorer : carte plein écran, recherche et filtres flottants, liste dans une feuille qui glisse. */
export default function ExploreView({ initialOrgs, sectors, defaultCenter }: { initialOrgs: Org[]; sectors: { slug: string; name: string }[]; defaultCenter: [number, number] | null }) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState<string[]>([])
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [quick, setQuick] = useState(false)
  const [near, setNear] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [dbOrgs, setDbOrgs] = useState<Org[]>(initialOrgs)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [snap, setSnap] = useState<Snap>('half')
  const [mapPick, setMapPick] = useState(false)
  const drag = useRef<{ startY: number; startH: number } | null>(null)
  const [dragH, setDragH] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // Secteur ou recherche transmis par l'accueil (/explore?cat=… ou ?q=…)
    const cat = params.get('cat')
    if (cat && sectors.some(s => s.slug === cat)) setSelectedCat(cat)
    const q = params.get('q')
    if (q) setSearch(q)
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch {}
    // Tri par distance dès que la position arrive
    navigator.geolocation?.getCurrentPosition(
      p => { const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setLocation(c); getOrganizations(undefined, c.lat, c.lng).then(setDbOrgs) },
      () => {}, // position refusée : liste sans distances
      { maximumAge: 5 * 60 * 1000, timeout: 8000 }
    )
  }, [sectors])

  const remember = (q: string) => {
    const v = q.trim()
    if (v.length < 2) return
    const next = [v, ...recent.filter(r => r.toLowerCase() !== v.toLowerCase())].slice(0, 5)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch {}
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dbOrgs.filter(o =>
      (!q || [o.name, o.category, o.address].some(v => v?.toLowerCase().includes(q))) &&
      (!onlyOpen || o.isOpen) &&
      (!quick || (o.isOpen && o.waitMin < 15)) &&
      (!near || (o.distanceNum != null && o.distanceNum <= 5)) &&
      (selectedCat === null || o.sectorSlug === selectedCat))
  }, [dbOrgs, search, onlyOpen, quick, near, selectedCat])

  // Glisser la poignée : la feuille suit le doigt, puis se cale sur la position la plus proche
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startY: e.clientY, startH: (SNAP_VH[snap] / 100) * window.innerHeight }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    setDragH(Math.max(100, Math.min(window.innerHeight * 0.9, drag.current.startH + (drag.current.startY - e.clientY))))
  }
  const onPointerUp = () => {
    if (!drag.current) return
    const h = dragH
    drag.current = null
    setDragH(null)
    if (h == null) return setSnap(s => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek')) // simple toucher : position suivante
    const vh = (h / window.innerHeight) * 100
    const next = (Object.keys(SNAP_VH) as Snap[]).reduce((a, b) => (Math.abs(SNAP_VH[b] - vh) < Math.abs(SNAP_VH[a] - vh) ? b : a))
    haptics.tap()
    setSnap(next)
  }

  const chips: { key: string; label: string; on: boolean; toggle: () => void; icon?: React.ReactNode }[] = [
    { key: 'open', label: 'Ouvert', on: onlyOpen, toggle: () => setOnlyOpen(v => !v), icon: <span className="h-1.5 w-1.5 rounded-full bg-current" /> },
    { key: 'quick', label: 'Moins de 15 min', on: quick, toggle: () => setQuick(v => !v), icon: <Clock size={13} /> },
    ...(location ? [{ key: 'near', label: 'À moins de 5 km', on: near, toggle: () => setNear(v => !v), icon: <LocateFixed size={13} /> }] : [])
  ]
  const sheetHeight = mapPick ? 0 : dragH ?? undefined

  return (
    <div className="fixed inset-0 overflow-hidden bg-surface-sunken">
      {/* Carte plein écran */}
      <div className="absolute inset-0">
        <ExploreMap orgs={filtered} userLocation={location} defaultCenter={defaultCenter} className="relative z-0 h-full w-full overflow-hidden" onActiveChange={org => setMapPick(!!org)} />
      </div>

      {/* Recherche et filtres flottants */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] bg-gradient-to-b from-white/90 via-white/60 to-transparent pb-6">
        <div className="pointer-events-auto mx-auto max-w-lg px-4 pt-4">
          <form onSubmit={e => { e.preventDefault(); remember(search); (document.activeElement as HTMLElement)?.blur() }}
            className="flex items-center gap-2 rounded-2xl bg-white p-1.5 pl-4 shadow-[0_10px_30px_-12px_rgba(17,24,39,0.35)] ring-1 ring-black/5">
            <Search size={19} className="shrink-0 text-ink-subtle" aria-hidden="true" />
            <input type="search" aria-label="Rechercher un établissement" placeholder="Hôpital, mairie, banque…" value={search}
              onChange={e => setSearch(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
              className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-subtle" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Effacer" className="rounded-full p-2 text-ink-subtle hover:bg-gray-100"><X size={16} /></button>}
          </form>
          {focused && !search && recent.length > 0 && (
            <ul className="mt-2 animate-rise-in overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
              {recent.map(r => (
                <li key={r}><button type="button" onMouseDown={() => setSearch(r)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink hover:bg-gray-50"><History size={15} className="text-ink-subtle" />{r}</button></li>
              ))}
            </ul>
          )}
          <div className="hide-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {chips.map(c => (
              <button key={c.key} type="button" aria-pressed={c.on} onClick={() => { haptics.tap(); c.toggle() }}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm ring-1 transition-all', c.on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-muted ring-black/5')}>
                {c.icon}{c.label}
              </button>
            ))}
            <span className="w-px shrink-0 bg-black/10" aria-hidden="true" />
            {[{ slug: null as string | null, name: 'Tous' }, ...sectors].map(cat => (
              <button key={cat.slug ?? 'all'} type="button" aria-pressed={selectedCat === cat.slug} onClick={() => { haptics.tap(); setSelectedCat(cat.slug) }}
                className={cn('shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold shadow-sm ring-1 transition-all',
                  selectedCat === cat.slug ? 'bg-gradient-to-br from-[#fb923c] to-brand text-white ring-brand' : 'bg-white text-ink-muted ring-black/5')}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste : feuille glissante à trois hauteurs */}
      <section aria-label="Établissements"
        className={cn('absolute inset-x-0 bottom-[68px] z-[600] mx-auto flex max-w-lg flex-col rounded-t-[28px] bg-white shadow-[0_-12px_40px_-12px_rgba(17,24,39,0.25)]',
          dragH == null && 'transition-[height] duration-500 ease-spring')}
        style={{ height: sheetHeight ?? `${SNAP_VH[snap]}vh` }}>
        <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          className="flex shrink-0 cursor-grab touch-none flex-col items-center px-5 pb-2 pt-2.5 active:cursor-grabbing" role="button" tabIndex={0} aria-label="Agrandir ou réduire la liste"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSnap(s => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek')) }}>
          <span className="h-1.5 w-11 rounded-full bg-gray-300" />
          <p className="mt-2 w-full text-sm font-semibold text-ink">{filtered.length} établissement{filtered.length > 1 ? 's' : ''}{location ? ' autour de vous' : ''}</p>
        </div>
        <ul className="stagger min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-4 pb-6">
          {filtered.length === 0 && (
            <li className="py-10 text-center text-sm text-ink-muted">Aucun établissement ne correspond. <button type="button" onClick={() => { setSearch(''); setOnlyOpen(false); setQuick(false); setNear(false); setSelectedCat(null) }} className="font-semibold text-brand">Tout afficher</button></li>
          )}
          {filtered.map(org => (
            <li key={org.id}>
              <Link href={`/org/${org.id}`} onClick={() => remember(search)} className={cn('lift flex items-center gap-3 rounded-[22px] p-2.5 ring-1', org.featured ? 'bg-gradient-to-r from-amber-50 to-white ring-amber-200' : 'bg-white ring-black/[0.05]')}>
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[16px]" style={{ background: `linear-gradient(140deg, ${(org.brandColor ?? org.colorHex)}1f, ${(org.brandColor ?? org.colorHex)}47)` }}>
                  {org.logoUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={org.logoUrl} alt="" loading="lazy" className="h-11 w-11 rounded-xl bg-white object-contain p-1" />
                    : <span style={{ color: org.brandColor ?? org.colorHex }}><DynamicIcon name={org.icon} size={26} /></span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-ink">{org.name}</span>
                    {org.featured && <Sparkles size={13} className="shrink-0 text-amber-500" aria-label="À la une" />}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                    <span className="flex items-center gap-0.5"><Star size={11} className="fill-amber-400 text-amber-400" />{org.rating > 0 ? org.rating.toLocaleString('fr-FR') : 'Nouveau'}</span>
                    <span className="flex items-center gap-0.5"><Users size={11} />{org.waitingCount}</span>
                    {org.distance && <span className="flex items-center gap-0.5 truncate"><MapPin size={11} />{org.distance}</span>}
                  </span>
                </span>
                <span className={cn('shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-bold', !org.isOpen ? 'bg-gray-100 text-ink-subtle' : org.waitMin < 10 ? 'bg-success-soft text-success-ink' : org.waitMin < 30 ? 'bg-brand-50 text-brand-700' : 'bg-danger-soft text-danger-ink')}>
                  {!org.isOpen ? 'Fermé' : org.waitMin ? `~${org.waitMin} min` : 'Libre'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
