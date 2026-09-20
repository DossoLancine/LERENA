'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Compass, Ticket, Heart, User as UserIcon, Home as HomeIcon, MapPin, Clock, Users, PlusSquare, Scissors, Utensils, Building2, ChevronRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getOrganizations } from '../actions/orgs'
import { getUserTickets } from '../actions/tickets'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTicket, setActiveTicket] = useState<any>(null)
  const [popularOrgs, setPopularOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
      return
    }
    if (status === 'authenticated') {
      fetchDashboardData()
    }
  }, [status, router])

  const fetchDashboardData = async () => {
    try {
      // Fetch active tickets
      const tickets = await getUserTickets()
      const active = tickets.find((t: any) => t.status === 'WAITING' || t.status === 'CALLED' || t.status === 'SERVING')
      setActiveTicket(active || null)

      // Fetch popular orgs
      const orgs = await getOrganizations()
      setPopularOrgs(orgs.slice(0, 3)) // Show top 3

      setLoading(false)
    } catch (error) {
      console.error(error)
      setLoading(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-24">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'Client'

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
              <span className="text-sm">Rechercher une clinique, pharmacie...</span>
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
            <Link href="/explore?cat=sante" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 hover:bg-blue-100 transition-colors">
                <PlusSquare size={24} />
              </div>
              <span className="text-xs font-medium text-gray-700">Santé</span>
            </Link>
            <Link href="/explore?cat=beaute" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center text-pink-500 hover:bg-pink-100 transition-colors">
                <Scissors size={24} />
              </div>
              <span className="text-xs font-medium text-gray-700">Beauté</span>
            </Link>
            <Link href="/explore?cat=resto" className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 hover:bg-orange-100 transition-colors">
                <Utensils size={24} />
              </div>
              <span className="text-xs font-medium text-gray-700">Resto</span>
            </Link>
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
                    {org.category === 'Pharmacie' ? <PlusSquare size={24} /> : 
                     org.category === 'Beauté' ? <Scissors size={24} /> : 
                     org.category === 'Restauration' ? <Utensils size={24} /> : 
                     org.category === 'Banque' ? <Building2 size={24} /> : 
                     <PlusSquare size={24} />}
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
      
      <BottomNav active="home" />
    </div>
  )
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home', label: 'Accueil', href: '/home', icon: <HomeIcon size={20} /> },
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
