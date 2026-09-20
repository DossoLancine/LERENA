'use client'

import { useState, useEffect } from 'react'
import { Users, Clock, CheckCircle2, SkipForward, UserX, Play, Square, ChevronDown, Megaphone, PartyPopper } from 'lucide-react'

import { getAgentQueue, updateTicketStatus, getAgentStats } from '../actions/agent'
import { useSession } from 'next-auth/react'

export default function AgentPage() {
  const { data: session } = useSession()
  const [queue, setQueue] = useState<any[]>([])
  const [servedToday, setServedToday] = useState(0)
  const [avgMin, setAvgMin] = useState(15)
  const [counter, setCounter] = useState('Guichet 1')
  const [isLoading, setIsLoading] = useState(true)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const fetchQueue = async () => {
    const data = await getAgentQueue()
    setQueue(data)
    const stats = await getAgentStats()
    if (stats) {
      setServedToday(stats.servedToday)
      setAvgMin(stats.avgMin)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const current = queue.find((t) => t.status === 'SERVING' || t.status === 'CALLED')
  const waiting = queue.filter((t) => t.status === 'WAITING')

  const callNext = async () => {
    if (current || waiting.length === 0) return
    setIsLoading(true)
    const nextTicket = waiting[0]
    await updateTicketStatus(nextTicket.id, 'CALLED', counter)
    setLastAction(`${nextTicket.displayNum} appelé au ${counter}`)
    await fetchQueue()
  }

  const startService = async (ticketId: string) => {
    setIsLoading(true)
    await updateTicketStatus(ticketId, 'SERVING', counter)
    setLastAction('Service commencé')
    await fetchQueue()
  }

  const completeService = async (ticketId: string) => {
    setIsLoading(true)
    await updateTicketStatus(ticketId, 'COMPLETED', counter)
    setServedToday((n) => n + 1)
    setLastAction('Service terminé')
    await fetchQueue()
  }

  const markAbsent = async (ticketId: string) => {
    setIsLoading(true)
    await updateTicketStatus(ticketId, 'ABSENT', counter)
    setLastAction('Client marqué absent')
    await fetchQueue()
  }

  const statusColor: Record<string, string> = {
    SERVING: 'badge-serving',
    CALLED:  'badge-called',
    WAITING: 'badge-waiting',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Interface Guichetier</h1>
            <p className="text-sm text-gray-500">
              {session?.user?.name || 'Awa Traoré'} · Poste actif
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Sélecteur de Guichet */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
              <span className="text-xs font-semibold text-gray-500">Poste :</span>
              <select
                value={counter}
                onChange={(e) => setCounter(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 focus:outline-none cursor-pointer"
              >
                <option value="Guichet 1">Guichet 1</option>
                <option value="Guichet 2">Guichet 2</option>
                <option value="Guichet 3">Guichet 3</option>
                <option value="Guichet 4">Guichet 4</option>
                <option value="Caisse">Caisse</option>
                <option value="Accueil">Accueil</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-2.5 py-1.5 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-semibold">En ligne</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card text-center">
            <p className="text-2xl font-black text-orange-500">{waiting.length}</p>
            <p className="text-xs text-gray-500 mt-1">En attente</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-black text-green-500">{servedToday}</p>
            <p className="text-xs text-gray-500 mt-1">Servis aujourd&apos;hui</p>
          </div>
          <div className="stat-card text-center">
            <p className="text-2xl font-black text-blue-500">{avgMin} min</p>
            <p className="text-xs text-gray-500 mt-1">Moy. traitement</p>
          </div>
        </div>

        {/* Last action toast */}
        {lastAction && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-sm font-medium text-green-700">{lastAction}</span>
          </div>
        )}

        {/* Current ticket */}
        {current ? (
          <div className="bg-white rounded-2xl border-2 border-blue-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="badge-serving text-sm px-3 py-1.5">En service</span>
                {current.priorityScore === 3 && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-md">VIP</span>}
                {current.priorityScore === 2 && <span className="bg-amber-100 text-amber-600 text-xs font-bold px-2 py-0.5 rounded-md">PMR</span>}
              </div>
              <span className="text-2xl font-black text-gray-900">{current.displayNum}</span>
            </div>
            <div className="mb-4">
              <p className="font-semibold text-gray-900">{current.guestName || current.user?.name || 'Client'}</p>
              <p className="text-sm text-gray-500">{current.service?.name}</p>
            </div>

            {/* Alerte Offre Client Rattachée */}
            {current.claimedPromoTitle && (
              <div className="mb-4 p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-center justify-between shadow-sm animate-pulse">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Offre réservée au guichet</p>
                    <p className="text-sm font-black text-gray-900">{current.claimedPromoTitle}</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Veuillez appliquer la remise ou remettre le produit au client</p>
                  </div>
                </div>
                {current.claimedPromoPrice && (
                  <span className="bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm shrink-0">
                    {current.claimedPromoPrice}
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => markAbsent(current.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-all"
              >
                <UserX size={16} />
                Absent
              </button>
              <button
                onClick={() => current.status === 'CALLED' ? startService(current.id) : completeService(current.id)}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center gap-2 btn-primary py-2.5 text-sm"
              >
                {isLoading ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : current.status === 'CALLED' ? (
                  <>
                    <Play size={16} />
                    Démarrer
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Terminer
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* CALL NEXT button */
          <button
            onClick={callNext}
            disabled={waiting.length === 0 || isLoading}
            className="w-full py-8 rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold text-xl transition-all shadow-lg shadow-orange-200 disabled:shadow-none"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Appel en cours...
              </div>
            ) : waiting.length === 0 ? (
              <div className="flex items-center justify-center gap-2"><CheckCircle2 /> File vide</div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="flex items-center gap-2"><Megaphone size={24} /> APPELER LE SUIVANT</span>
                <span className="text-sm font-normal opacity-80">{waiting[0]?.displayNum} — {waiting[0]?.guestName || waiting[0]?.user?.name || 'Client'}</span>
              </div>
            )}
          </button>
        )}

        {/* Queue list */}
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">File d&apos;attente</h2>
            <span className="text-sm text-gray-500">{waiting.length} en attente</span>
          </div>

          {waiting.length === 0 ? (
            <div className="py-12 text-center">
              <PartyPopper size={48} className="mx-auto text-orange-300" />
              <p className="text-gray-500 font-medium mt-3">File vide !</p>
              <p className="text-gray-400 text-sm mt-1">Tous les clients ont été servis.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {waiting.map((ticket, i) => (
                <div key={ticket.id} className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{ticket.displayNum} • {ticket.guestName || ticket.user?.name || 'Client'}</p>
                        {ticket.priorityScore === 3 && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">VIP</span>}
                        {ticket.priorityScore === 2 && <span className="bg-amber-100 text-amber-600 text-[10px] font-bold px-1.5 py-0.5 rounded-md">PMR</span>}
                      </div>
                      <p className="text-xs text-gray-500">{ticket.service?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      i === 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      ~{(i + 1) * (ticket.service?.avgDurationMin || 15)} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
