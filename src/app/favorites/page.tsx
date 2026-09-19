'use client'
import Link from 'next/link'
import { Heart, ChevronRight, Clock, Users, PlusSquare, Scissors, Home, Compass, Ticket, User } from 'lucide-react'

const FAVS = [
  { id: 'org-1', name: 'Clinique Horizon',   emoji: <PlusSquare size={24} className="text-blue-500" />, waitMin: 18, queueCount: 12, isOpen: true },
  { id: 'org-3', name: 'Salon Beauté+',      emoji: <Scissors size={24} className="text-pink-500" />, waitMin: 35, queueCount: 8,  isOpen: true },
  { id: 'org-2', name: 'Pharmacie Centrale', emoji: <PlusSquare size={24} className="text-green-500" />, waitMin: 8,  queueCount: 5,  isOpen: true },
]

export default function FavoritesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Mes favoris</h1>
          <p className="text-sm text-gray-500 mt-1">Accédez rapidement à vos établissements</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3 pb-24">
        {FAVS.map((org) => (
          <Link key={org.id} href={`/org/${org.id}`}>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl">{org.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{org.name}</p>
                  <Heart size={16} className="fill-red-400 text-red-400" />
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {org.isOpen ? (
                    <>
                      <span className="badge-open">Ouvert</span>
                      <span className="flex items-center gap-1 text-xs text-orange-500 font-semibold">
                        <Clock size={11} />{org.waitMin} min
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Users size={11} />{org.queueCount}
                      </span>
                    </>
                  ) : (
                    <span className="badge-closed">Fermé</span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          </Link>
        ))}
      </div>
      <BottomNav active="favorites" />
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
