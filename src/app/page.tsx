'use client'

import { useState, useEffect } from 'react'
import { Search, MapPin, Clock, Users, ChevronRight, Star, Bell, PlusSquare, Scissors, Utensils, Building2, Home, Compass, Ticket, Heart, User } from 'lucide-react'
import Link from 'next/link'
import { getOrganizations } from './actions/orgs'

const CATEGORIES = ['Tous', 'Santé', 'Pharmacie', 'Beauté', 'Restauration', 'Banque']

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('Tous')
  const [dbOrgs, setDbOrgs] = useState<any[]>([])

  useEffect(() => {
    getOrganizations().then(data => {
      setDbOrgs(data)
    })
  }, [])

  const filtered = dbOrgs.filter((org) => {
    const matchSearch =
      search === '' ||
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.category.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'Tous' || org.category === activeCategory
    return matchSearch && matchCat
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Bienvenue sur</p>
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-orange-500">ATTENDS</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <Bell size={18} className="text-gray-600" />
              </button>
              <Link href="/login">
                <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">M</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Clinique, pharmacie, salon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-4 pb-24">
        {/* Hero banner */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 mb-6 text-white">
          <p className="text-sm font-medium opacity-90 mb-1">Ne perdez plus votre temps</p>
          <h2 className="text-2xl font-bold mb-3">Rejoignez une file<br />depuis votre téléphone</h2>
          <div className="flex items-center gap-4 text-sm opacity-90">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>1 247 tickets aujourd&apos;hui</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>~18 min en moyenne</span>
            </div>
          </div>
        </div>

        {/* Nearby section */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">
            {search ? `${filtered.length} résultat${filtered.length > 1 ? 's' : ''}` : 'Établissements proches'}
          </h3>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin size={12} />
            <span>Dakar</span>
          </div>
        </div>

        {/* Org cards */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <Search size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Aucun établissement trouvé</p>
              <p className="text-gray-400 text-sm mt-1">Essayez un autre terme de recherche</p>
            </div>
          )}

          {filtered.map((org) => (
            <Link key={org.id} href={`/org/${org.id}`}>
              <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${org.color}`}>
                    {org.category === 'Pharmacie' ? <PlusSquare size={24} /> : 
                     org.category === 'Beauté' ? <Scissors size={24} /> : 
                     org.category === 'Restauration' ? <Utensils size={24} /> : 
                     org.category === 'Banque' ? <Building2 size={24} /> : 
                     <PlusSquare size={24} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-sm">{org.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{org.category}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star size={11} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-700">{org.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mt-2">
                      <MapPin size={11} className="text-gray-400 shrink-0" />
                      <p className="text-xs text-gray-500 truncate">{org.address}</p>
                      <span className="text-xs text-gray-400 shrink-0">· {org.distance}</span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        {org.isOpen ? (
                          <>
                            <span className="badge-open">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Ouvert
                            </span>
                            <div className="flex items-center gap-1">
                              <Clock size={12} className="text-orange-500" />
                              <span className="text-xs font-semibold text-gray-900">
                                {org.waitMin} min
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users size={12} className="text-gray-400" />
                              <span className="text-xs text-gray-500">{org.queueCount}</span>
                            </div>
                          </>
                        ) : (
                          <span className="badge-closed">Fermé · ouvre à 08h00</span>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom nav */}
      <BottomNav active="home" />
    </div>
  )
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home', label: 'Accueil', href: '/', icon: <Home size={20} /> },
    { id: 'explore', label: 'Explorer', href: '/explore', icon: <Compass size={20} /> },
    { id: 'tickets', label: 'Tickets', href: '/tickets', icon: <Ticket size={20} /> },
    { id: 'favorites', label: 'Favoris', href: '/favorites', icon: <Heart size={20} /> },
    { id: 'profile', label: 'Profil', href: '/profile', icon: <User size={20} /> },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
              active === item.id ? 'text-orange-500' : 'text-gray-400'
            }`}>
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active === item.id && (
                <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5"></span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </nav>
  )
}
