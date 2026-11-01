'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DynamicIcon, sectorColor } from '@/lib/icons'
import { Search, Compass, Ticket, Heart, User as UserIcon, Home as HomeIcon, MapPin, Clock, Users, ChevronRight } from 'lucide-react'
import { getOrganizations } from '@/server/actions/orgs'
import { ClientNav } from '@/components/navigation/client-nav'

type Org = Awaited<ReturnType<typeof getOrganizations>>[number]

// Données préparées par le serveur ; le navigateur ne recharge que pour trier par distance
export default function HomeView({ userName, activeTicket, initialOrgs, sectors }: {
  userName: string | null
  sectors: { slug: string; name: string; icon: string; color: string }[]
  activeTicket: any
  initialOrgs: Org[]
}) {
  const [popularOrgs, setPopularOrgs] = useState<Org[]>(initialOrgs.slice(0, 3))

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const orgs = await getOrganizations(undefined, position.coords.latitude, position.coords.longitude)
        setPopularOrgs(orgs.slice(0, 3))
      },
      (error) => console.error("Erreur GPS:", error),
      { maximumAge: 5 * 60 * 1000, timeout: 8000 }
    )
  }, [])

  const firstName = userName?.split(' ')[0] || 'Client'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 pt-8 pb-5 px-4 rounded-b-3xl shadow-sm relative z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm mb-0.5">Bonjour,</p>
            <h1 className="text-2xl font-black text-gray-900">{firstName} 👋</h1>
          </div>
          <Link href="/profile">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
              <UserIcon size={20} />
            </div>
          </Link>
        </div>
        
        {/* Search Bar Shortcut */}
        <div className="max-w-lg mx-auto mt-6">
          <Link href="/explore">
            <div className="w-full bg-gray-100 rounded-2xl p-3 flex items-center gap-3 text-gray-400">
              <Search size={18} />
              <span className="text-sm">Rechercher un établissement...</span>
            </div>
          </Link>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8 pb-24">
        
        {/* Active Ticket Widget */}
        {activeTicket && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
              En cours
            </h2>
            <Link href={`/ticket/${activeTicket.id}`}>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/30 flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-xs uppercase tracking-wider font-bold mb-1">Votre Ticket</p>
                  <p className="text-xl font-black">{activeTicket.orgName}</p>
                  <p className="text-orange-100 text-sm mt-0.5">{activeTicket.serviceName}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-xl p-3 text-center min-w-[70px]">
                  <p className="text-xs text-orange-100 font-medium">N°</p>
                  <p className="text-2xl font-black">{activeTicket.displayNum}</p>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Categories */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-3">Catégories</h2>
          <div className="grid grid-cols-4 gap-3">
            {sectors.slice(0, 3).map(sec => (
              <Link key={sec.slug} href={`/explore?cat=${sec.slug}`} className="flex flex-col items-center gap-2">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-opacity hover:opacity-80 ${sectorColor(sec.color).soft}`}>
                  <DynamicIcon name={sec.icon} size={24} />
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight line-clamp-2">{sec.name}</span>
              </Link>
            ))}
            <Link href="/explore" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <Search size={24} />
              </div>
              <span className="text-xs font-medium text-gray-700">Tout</span>
            </Link>
          </div>
        </section>

        {/* Recommandations */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">À proximité</h2>
            <Link href="/explore" className="text-sm font-semibold text-orange-500">Voir tout</Link>
          </div>
          <div className="space-y-3">
            {popularOrgs.map((org) => (
              <Link key={org.id} href={`/org/${org.id}`}>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${org.color}`}>
                    <DynamicIcon name={org.icon} size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{org.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><MapPin size={10} />{org.distance}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-orange-500 font-medium"><Clock size={10} />{org.waitRange}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
      
      <ClientNav />
    </div>
  )
}
