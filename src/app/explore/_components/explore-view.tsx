'use client'
import { useState, useEffect } from 'react'
import { Search, Filter, MapPin, Clock, Users, Star, ChevronRight, Home, Compass, Ticket, Heart, User as UserIcon, Map as MapIcon, List as ListIcon, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { DynamicIcon } from '@/lib/icons'
import { getOrganizations } from '@/server/actions/orgs'
import dynamic from 'next/dynamic'

// Dynamic import for Leaflet (SSR disabled)
const ExploreMap = dynamic(() => import('@/components/maps/explore-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-gray-100 animate-pulse rounded-t-3xl">
      <MapIcon size={32} className="text-gray-300" />
    </div>
  )
})

type Org = Awaited<ReturnType<typeof getOrganizations>>[number]

// Liste déjà remplie par le serveur ; le navigateur ne la recharge que pour trier par distance
export default function ExploreView({ initialOrgs, sectors, defaultCenter }: { initialOrgs: Org[]; sectors: { slug: string; name: string }[]; defaultCenter: [number, number] | null }) {
  const [search, setSearch] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [maxDist, setMaxDist] = useState<number | null>(null)
  
  const [dbOrgs, setDbOrgs] = useState<Org[]>(initialOrgs)
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null)
  const [isMapView, setIsMapView] = useState(false)

  const categories = [{ slug: null as string | null, name: 'Tout' }, ...sectors]
  const distances = [{label: 'Toutes distances', val: null}, {label: '< 5 km', val: 5}, {label: '< 10 km', val: 10}]

  useEffect(() => {
    // Secteur présélectionné depuis l'accueil (/explore?cat=<slug>)
    const params = new URLSearchParams(window.location.search)
    const cat = params.get('cat')
    // Recherche tapée sur l'accueil (/explore?q=…)
    const q = params.get('q')
    if (q) setSearch(q)
    if (cat && sectors.some(s => s.slug === cat)) setSelectedCat(cat)
  }, [sectors])

  useEffect(() => {
    // Tri par distance dès que la position arrive
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
          setLocation(coords)
          fetchOrgs(coords.lat, coords.lng)
        },
        () => {}, // position refusée ou indisponible : la liste s'affiche sans les distances
        { maximumAge: 5 * 60 * 1000, timeout: 8000 }
      )
    }
  }, [])

  const fetchOrgs = (lat?: number, lng?: number) => {
    getOrganizations(undefined, lat, lng).then(setDbOrgs)
  }

  const filtered = dbOrgs.filter((o) => {
    const matchSearch = search === '' || o.name.toLowerCase().includes(search.toLowerCase())
    const matchOpen = !onlyOpen || o.isOpen
    const matchCat = selectedCat === null || o.sectorSlug === selectedCat
    const matchDist = maxDist === null || (o.distanceNum && o.distanceNum <= maxDist)
    return matchSearch && matchOpen && matchCat && matchDist
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 z-20">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Explorer</h1>
            <button 
              onClick={() => setIsMapView(!isMapView)}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            >
              {isMapView ? <><ListIcon size={16} /> Liste</> : <><MapIcon size={16} /> Carte</>}
            </button>
          </div>
          <div className="relative mb-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" aria-label="Rechercher un établissement" placeholder="Rechercher un établissement..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all" />
          </div>
          
          {/* Scrollable Filters */}
          <div className="flex flex-col gap-2 mb-1">
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              <button onClick={() => setOnlyOpen(!onlyOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all shrink-0 ${onlyOpen ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                Ouvert
              </button>
              {categories.map(cat => (
                <button key={cat.slug ?? 'all'} onClick={() => setSelectedCat(cat.slug)} aria-pressed={selectedCat === cat.slug}
                  className={`px-4 py-1.5 rounded-full whitespace-nowrap text-sm font-semibold transition-colors shrink-0 ${selectedCat === cat.slug ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {distances.map(d => (
                <button key={d.label} onClick={() => setMaxDist(d.val)} 
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold transition-colors shrink-0 ${maxDist === d.val ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {isMapView ? (
          <ExploreMap orgs={filtered} userLocation={location} defaultCenter={defaultCenter} />
        ) : (
          <div className="stagger max-w-lg mx-auto px-4 py-4 space-y-3 pb-24">
        <p className="text-sm text-gray-500">{filtered.length} établissement{filtered.length > 1 ? 's' : ''}</p>
        {filtered.map((org) => (
          <Link key={org.id} href={`/org/${org.id}`}>
            <div className={`bg-white rounded-2xl border p-4 lift flex items-center gap-3 ${org.featured ? 'border-amber-200 ring-1 ring-amber-100 bg-gradient-to-r from-amber-50/60 to-white' : 'border-gray-100'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${org.color}`}>
                <DynamicIcon name={org.icon} size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{org.name}{org.featured && <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-800"><Sparkles size={10} aria-hidden="true" /> À la une</span>}</p>
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    <span className="text-xs font-medium text-gray-700">
                      {org.rating > 0 ? org.rating : 'Nouveau'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {org.isOpen ? (
                    <>
                      <span className="badge-open">Ouvert</span>
                      <span className="flex items-center gap-1 text-xs font-semibold text-orange-700"><Clock size={11} />{org.waitMin} min</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Users size={11} />{org.waitingCount}</span>
                    </>
                  ) : (
                    <span className="badge-closed">Fermé</span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-gray-400 ml-auto"><MapPin size={11} />{org.distance}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </div>
          </Link>
        ))}
          </div>
        )}
      </div>
    </div>
  )
}
