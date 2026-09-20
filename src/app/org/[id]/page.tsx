'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, Clock, Users, Star, ChevronRight, Heart, Share2, CheckCircle2, PlusSquare, Scissors, Utensils, Building2, Ticket, MousePointer2, AlertTriangle, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getOrganizationById } from '../../actions/orgs'
import { joinQueue } from '../../actions/tickets'
import { useSession } from 'next-auth/react'

export default function OrgPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priorityLevel, setPriorityLevel] = useState<string>('STANDARD')

  useEffect(() => {
    fetchOrg()
  }, [params.id])

  const fetchOrg = async () => {
    const data = await getOrganizationById(params.id)
    setOrg(data)
    setLoading(false)
  }

  const handleJoinQueue = async () => {
    if (!selectedService) return
    
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/org/${params.id}`)
      return
    }

    setIsJoining(true)
    setError(null)
    
    const res = await joinQueue(selectedService, params.id, priorityLevel)
    if (res.success && res.ticketId) {
      router.push(`/ticket/${res.ticketId}`)
    } else {
      setError(res.error || "Une erreur est survenue")
      setIsJoining(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Établissement introuvable</h2>
        <p className="text-gray-500 mb-6">Cet établissement n&apos;existe pas ou n&apos;est plus disponible.</p>
        <Link href="/explore">
          <button className="btn-primary py-3 px-6 rounded-full">Retour à l&apos;exploration</button>
        </Link>
      </div>
    )
  }

  // Calculate approximate wait based on queues if any exist
  const totalWait = org.branches?.[0]?.queues?.reduce((acc: number, q: any) => acc + (q.currentNum * 15), 0) || 0;
  const emoji = org.category === 'Pharmacie' ? <PlusSquare size={48} className="text-white opacity-90" /> : 
               org.category === 'Beauté' ? <Scissors size={48} className="text-white opacity-90" /> : 
               org.category === 'Restauration' ? <Utensils size={48} className="text-white opacity-90" /> : 
               org.category === 'Banque' ? <Building2 size={48} className="text-white opacity-90" /> : 
               <PlusSquare size={48} className="text-white opacity-90" />;
  const services = org.branches?.[0]?.services || [];

  const service = services.find((s: any) => s.id === selectedService)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative bg-white">
        <div className="h-48 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
          {org.emoji}
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>

        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow"
          >
            <Heart size={16} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'} />
          </button>
          <button className="w-9 h-9 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow">
            <Share2 size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-4 pb-32">
        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{org.category}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-amber-50 px-2 py-1 rounded-lg">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span className="text-sm font-semibold text-gray-800">{org.rating}</span>
              <span className="text-xs text-gray-500">({org.reviewCount})</span>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-2">
            <MapPin size={13} className="text-gray-400" />
            <p className="text-sm text-gray-500">{org.address} · {org.distance}</p>
          </div>

          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{org.description}</p>

          {/* Status + wait */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              {org.isOpen ? (
                <>
                  <span className="badge-open mx-auto mb-1">Ouvert</span>
                  <p className="text-xs text-gray-500">Ferme à {org.closeTime}</p>
                </>
              ) : (
                <>
                  <span className="badge-closed mx-auto mb-1">Fermé</span>
                  <p className="text-xs text-gray-500">Ouvre à {org.openTime}</p>
                </>
              )}
            </div>
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                <Clock size={14} />
                <span className="text-lg font-bold">{totalWait > 0 ? `${totalWait}-${totalWait + 10}` : "0-10"}</span>
              </div>
              <p className="text-xs text-gray-500">minutes d&apos;attente</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users size={14} className="text-gray-600" />
                <span className="text-lg font-bold text-gray-800">{org.branches?.[0]?.queues?.reduce((acc: number, q: any) => acc + q.currentNum, 0) || 0}</span>
              </div>
              <p className="text-xs text-gray-500">en file</p>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Choisissez un service</h2>
          <div className="space-y-2">
            {services.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedService(svc.id)
                }}
                disabled={!org.isActive}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                  selectedService === svc.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div>
                  <p className="font-medium text-gray-900 text-sm">{svc.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={11} />
                      ~{svc.avgDurationMin} min par passage
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Users size={11} />
                      {org.branches?.[0]?.queues?.reduce((acc: number, q: any) => acc + q.currentNum, 0) || 0} en attente
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-sm font-semibold text-orange-500">~{totalWait > 0 ? totalWait : 10} min</span>
                  {selectedService === svc.id && (
                    <CheckCircle2 size={16} className="text-orange-500 mt-1 ml-auto" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Options de file d'attente (EPIC 4 VIP) */}
      <div className="max-w-lg mx-auto px-4 pb-32">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Besoin spécifique ?</h2>
          <select 
            value={priorityLevel}
            onChange={(e) => setPriorityLevel(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-orange-500 focus:border-orange-500 block p-3"
          >
            <option value="STANDARD">Non, attente classique</option>
            <option value="PRIORITY">PMR / Personne âgée / Enceinte (Prioritaire)</option>
            <option value="VIP">Client VIP / Urgence</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">
            Les tickets prioritaires passent automatiquement devant les autres.
          </p>
        </div>
      </div>

      {/* CTA */}
      {org.isActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom z-30">
          <div className="max-w-lg mx-auto">
            {selectedService && service ? (
              <div className="mb-3 p-3 bg-orange-50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Service sélectionné</p>
                  <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Attente estimée</p>
                  <p className="text-sm font-bold text-orange-500">~{totalWait > 0 ? totalWait : 10} min</p>
                </div>
              </div>
            ) : null}
            {error && (
              <div className="mb-3 p-2 bg-red-50 text-red-600 text-sm text-center rounded-lg border border-red-100">
                {error}
              </div>
            )}
            <button
              onClick={handleJoinQueue}
              disabled={!selectedService || isJoining}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isJoining ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Patientez...
                </>
              ) : (
                <>
                  {selectedService ? (
                    session?.user ? (
                      <><Ticket size={20} /> Prendre mon ticket</>
                    ) : (
                      <><UserIcon size={20} /> Se connecter pour continuer</>
                    )
                  ) : (
                    <>
                      <MousePointer2 size={20} /> Sélectionnez un service
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
