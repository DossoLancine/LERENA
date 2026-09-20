'use client'
import { useState, useEffect } from 'react'
import { Search, Filter, MapPin, Clock, Users, Star, ChevronRight, PlusSquare, Scissors, Utensils, Building2, Home, Compass, Ticket, Heart, User as UserIcon, Map as MapIcon, List as ListIcon } from 'lucide-react'
import Link from 'next/link'
import { getOrganizations } from '../actions/orgs'
import dynamic from 'next/dynamic'

// Dynamic import for Leaflet (SSR disabled)
const ExploreMap = dynamic(() => import('@/components/ExploreMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-gray-100 animate-pulse rounded-t-3xl">
      <MapIcon size={32} className="text-gray-300" />
    </div>
  )
})

export default function ExplorePage() {
  const [search, setSearch] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [selectedCat, setSelectedCat] = useState('Tout')
  const [maxDist, setMaxDist] = useState<number | null>(null)
  
  const [dbOrgs, setDbOrgs] = useState<any[]>([])
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null)
  const [isMapView, setIsMapView] = useState(false)

  const categories = ['Tout', 'Santé', 'Pharmacie', 'Beauté', 'Restauration', 'Banque']
  const distances = [{label: 'Toutes distances', val: null}, {label: '< 5 km', val: 5}, {label: '< 10 km', val: 10}]

  useEffect(() => {
    // 1. Demander la localisation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
          setLocation(coords)
          fetchOrgs(coords.lat, coords.lng)
        },
        (error) => {
          console.error("Erreur GPS:", error)
          fetchOrgs() // Fallback sans GPS
        }
      )
    } else {
      fetchOrgs()
    }
  }, [])

  const fetchOrgs = (lat?: number, lng?: number) => {
    getOrganizations(undefined, lat, lng).then(data => {
      setDbOrgs(data)
    })
  }

  const filtered = dbOrgs.filter((o) => {
    const matchSearch = search === '' || o.name.toLowerCase().includes(search.toLowerCase())
    const matchOpen = !onlyOpen || o.isOpen
    const matchCat = selectedCat === 'Tout' || o.category === selectedCat
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
            <input type="text" placeholder="Rechercher un établissement..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                <button key={cat} onClick={() => setSelectedCat(cat)} 
                  className={`px-4 py-1.5 rounded-full whitespace-nowrap text-sm font-semibold transition-colors shrink-0 ${selectedCat === cat ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {distances.map(d => (
                <button key={d.label} onClick={() => setMaxDist(d.val)} 
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-semibold transition-colors shrink-0 ${maxDist === d.val ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {isMapView ? (
          <ExploreMap orgs={filtered} userLocation={location} />
        ) : (
          <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-24">
        <p className="text-sm text-gray-500">{filtered.length} établissement{filtered.length > 1 ? 's' : ''}</p>
        {filtered.map((org) => (
          <Link key={org.id} href={`/org/${org.id}`}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${org.color}`}>
                {org.category === 'Pharmacie' ? <PlusSquare size={24} /> : 
                 org.category === 'Beauté' ? <Scissors size={24} /> : 
                 org.category === 'Restauration' ? <Utensils size={24} /> : 
                 org.category === 'Banque' ? <Building2 size={24} /> : 
                 <PlusSquare size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm">{org.name}</p>
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
                      <span className="flex items-center gap-1 text-xs font-semibold text-orange-500"><Clock size={11} />{org.waitMin} min</span>
                      <span className="flex items-center gap-1 text-xs text-gray-400"><Users size={11} />{org.queueCount}</span>
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
      <BottomNav active="explore" />
    </div>
  )
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home', label: 'Accueil', href: '/home', icon: <Home size={20} /> },
    { id: 'explore', label: 'Explorer', href: '/explore', icon: <Compass size={20} /> },
    { id: 'tickets', label: 'Tickets', href: '/tickets', icon: <Ticket size={20} /> },
    { id: 'favorites', label: 'Favoris', href: '/favorites', icon: <Heart size={20} /> },
    { id: 'profile', label: 'Profil', href: '/profile', icon: <UserIcon size={20} /> },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${active === item.id ? 'text-orange-500' : 'text-gray-400'}`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active === item.id && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5"></span>}
            </div>
          </Link>
        ))}
      </div>
    </nav>
  )
}
