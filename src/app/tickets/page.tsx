'use client'
import Link from 'next/link'

import { Clock, Home, Compass, Ticket, Heart, User } from 'lucide-react'

import { useEffect, useState } from 'react'
import { getUserTickets } from '@/server/actions/tickets'
import { ClientNav } from '@/components/navigation/client-nav'

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

      <ClientNav />
    </div>
  )
}
