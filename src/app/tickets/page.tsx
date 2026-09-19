'use client'
import Link from 'next/link'

import { Clock, Home, Compass, Ticket, Heart, User } from 'lucide-react'

import { useEffect, useState } from 'react'
import { getUserTickets } from '../actions/tickets'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  
  useEffect(() => {
    getUserTickets().then(data => setTickets(data))
  }, [])

  const activeTickets = tickets.filter(t => ['WAITING', 'CALLED', 'SERVING'].includes(t.status))
  const historyTickets = tickets.filter(t => !['WAITING', 'CALLED', 'SERVING'].includes(t.status))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-2xl font-bold text-gray-900">Mes tickets</h1>
          <p className="text-sm text-gray-500 mt-1">Vos files d&apos;attente actives et historique</p>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Active ticket */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Actifs</p>
        {activeTickets.length === 0 && <p className="text-sm text-gray-500 mb-6">Aucun ticket actif.</p>}
        {activeTickets.map(t => (
          <div key={t.id} className="mb-4">
            <Link href={`/ticket/${t.id}`}>
              <div className="bg-white rounded-2xl border-2 border-orange-200 p-4 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className={`badge-waiting flex items-center gap-1 ${t.status === 'CALLED' ? 'bg-orange-100 text-orange-600' : ''}`}>
                    <Clock size={12} /> {t.status === 'CALLED' ? 'Appelé' : 'En attente'}
                  </span>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-3xl font-black text-gray-900">{t.displayNum}</p>
                    <p className="text-sm text-gray-600 mt-1">{t.queue?.branch?.organization?.name} · {t.service?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-orange-500">{t.status === 'WAITING' ? `~${Math.max(0, (t.position || 0) * (t.service?.avgDurationMin || 15))}m` : 'Maintenant'}</p>
                    <p className="text-xs text-gray-500">{t.status === 'WAITING' ? 'estimé' : 'à votre tour'}</p>
                    <p className="text-xs text-gray-400 mt-1">{t.position} devant</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}

        {/* History */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">Historique</p>
        {historyTickets.length === 0 && <p className="text-sm text-gray-500">Aucun historique.</p>}
        <div className="space-y-2">
          {historyTickets.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  {t.displayNum}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{t.queue?.branch?.organization?.name}</p>
                  <p className="text-xs text-gray-500">{t.service?.name}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>{t.status === 'COMPLETED' ? 'Terminé' : 'Annulé'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="tickets" />
    </div>
  )
}

function BottomNav({ active }: { active: string }) {
  const items = [
    { id: 'home',      label: 'Accueil',   href: '/',         icon: <Home size={20} /> },
    { id: 'explore',   label: 'Explorer',  href: '/explore',  icon: <Compass size={20} /> },
    { id: 'tickets',   label: 'Tickets',   href: '/tickets',  icon: <Ticket size={20} /> },
    { id: 'favorites', label: 'Favoris',   href: '/favorites',icon: <Heart size={20} /> },
    { id: 'profile',   label: 'Profil',    href: '/profile',  icon: <User size={20} /> },
  ]
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {items.map((item) => (
          <Link key={item.id} href={item.href}>
            <div className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${active === item.id ? 'text-orange-500' : 'text-gray-400'}`}>
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
