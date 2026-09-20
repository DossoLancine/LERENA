'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Clock, Users, CheckCircle2, XCircle, AlertCircle, Share2, Phone, Megaphone, Settings, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STATUSES: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  WAITING:   { label: 'En attente',     color: 'text-amber-600',  bg: 'bg-amber-50',  icon: <Clock size={18} /> },
  CALLED:    { label: 'Appelé !',       color: 'text-orange-600', bg: 'bg-orange-50', icon: <Megaphone size={18} /> },
  SERVING:   { label: 'En service',     color: 'text-blue-600',   bg: 'bg-blue-50',   icon: <Settings size={18} /> },
  COMPLETED: { label: 'Terminé',        color: 'text-green-600',  bg: 'bg-green-50',  icon: <CheckCircle2 size={18} /> },
  CANCELLED: { label: 'Annulé',         color: 'text-red-600',    bg: 'bg-red-50',    icon: <XCircle size={18} /> },
  ABSENT:    { label: 'Absent',         color: 'text-red-600',    bg: 'bg-red-50',    icon: <AlertTriangle size={18} /> },
}

const TIMELINE_STEPS = [
  { key: 'created',     label: 'Ticket créé',          activeFor: ['WAITING', 'CALLED', 'SERVING', 'COMPLETED'] },
  { key: 'waiting',     label: 'En attente',            activeFor: ['CALLED', 'SERVING', 'COMPLETED'] },
  { key: 'approaching', label: 'Votre tour approche',  activeFor: ['CALLED', 'SERVING', 'COMPLETED'] },
  { key: 'called',      label: 'Appelé',               activeFor: ['SERVING', 'COMPLETED'] },
  { key: 'serving',     label: 'Service en cours',      activeFor: ['COMPLETED'] },
  { key: 'done',        label: 'Terminé',               activeFor: ['COMPLETED'] },
]

import { getTicketById } from '../../actions/tickets'
import { getPromotionsByOrg } from '../../actions/marketing'
import { PushNotification } from '@/components/push-notification'
import { NPSWidget, PromoCarousel } from '@/components/marketing-widgets'
import { useRef } from 'react'

export default function TicketPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [promotions, setPromotions] = useState<any[]>([])
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [showPush, setShowPush] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const prevStatus = useRef<string | null>(null)

  const fetchTicket = useCallback(async () => {
    const data = await getTicketById(params.id)
    if (data) {
      setTicket(data)
      
      // Load promotions on first fetch
      if (!ticket) {
        const orgId = data.queue?.branch?.organizationId
        if (orgId) {
          getPromotionsByOrg(orgId).then(setPromotions)
        }
      }
      
      if (prevStatus.current === 'WAITING' && data.status === 'CALLED') {
        const counterName = data.guestPhone?.startsWith('G-') ? data.guestPhone.replace('G-', '') : 'guichet'
        setPushMessage(`C'est à votre tour ! Veuillez vous présenter au ${counterName}.`)
        setShowPush(true)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
      }
      
      prevStatus.current = data.status
    }
    setLoading(false)
    setSecondsAgo(0)
  }, [params.id, ticket])

  // Initial fetch and Real-time polling
  useEffect(() => {
    fetchTicket()
    const interval = setInterval(() => {
      fetchTicket()
    }, 5000)
    
    const timeInterval = setInterval(() => {
      setSecondsAgo(s => s + 1)
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(timeInterval)
    }
  }, [fetchTicket])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle size={64} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Ticket introuvable</h2>
        <Link href="/tickets">
          <button className="btn-primary py-3 px-6 rounded-full mt-4">Voir mes tickets</button>
        </Link>
      </div>
    )
  }

  const status = STATUSES[ticket.status] || STATUSES.WAITING
  const position = ticket.position || 0
  const initialPosition = ticket.initialPosition || position || 1
  
  let progressPercent = 100
  if (ticket.status === 'WAITING') {
    progressPercent = Math.max(5, Math.round(((initialPosition - position) / initialPosition) * 100))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PushNotification message={pushMessage} isVisible={showPush} onClose={() => setShowPush(false)} />
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Mon ticket</h1>
          <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <Share2 size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">
        {/* Main ticket card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Status bar */}
          <div className={`${status.bg} px-5 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{status.icon}</span>
              <span className={`font-semibold text-sm ${status.color}`}>{status.label}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Mis à jour il y a {secondsAgo}s
            </div>
          </div>

          <div className="p-5">
            {/* Ticket number */}
            <div className="text-center mb-6">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Votre ticket</p>
              <div className="text-7xl font-black text-gray-900 tracking-tight leading-none">
                {ticket.displayNum}
              </div>
              <p className="text-sm text-gray-500 mt-2">{ticket.orgName} · {ticket.serviceName}</p>
            </div>

            {/* Position + Wait */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users size={16} className="text-gray-400" />
                </div>
                <p className="text-3xl font-black text-gray-900">{position}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {position === 0 ? "C'est votre tour !" : `personne${position > 1 ? 's' : ''} devant vous`}
                </p>
              </div>
              <div className="bg-orange-50 rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock size={16} className="text-orange-400" />
                </div>
                <p className="text-3xl font-black text-orange-500">
                  {Math.max(0, position * (ticket.service?.avgDurationMin || 15))}–{Math.max(0, position * (ticket.service?.avgDurationMin || 15)) + 10}
                </p>
                <p className="text-xs text-gray-500 mt-1">minutes estimées</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Progression</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Progression</h3>
          <div className="space-y-0">
            {TIMELINE_STEPS.map((step, i) => {
              const isDone = step.activeFor.includes(ticket.status)
              const isCurrent =
                (i === 1 && ticket.status === 'WAITING') ||
                (i === 2 && ticket.position <= 3 && ticket.status === 'WAITING') ||
                (i === 3 && ticket.status === 'CALLED') ||
                (i === 4 && ticket.status === 'SERVING')
              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-orange-500' : isCurrent ? 'bg-orange-100 border-2 border-orange-500' : 'bg-gray-100'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 size={14} className="text-white" />
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-orange-500 animate-pulse' : 'bg-gray-300'}`} />
                      )}
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-6 my-1 ${isDone ? 'bg-orange-200' : 'bg-gray-100'}`} />
                    )}
                  </div>
                  <div className={`pb-4 ${i === TIMELINE_STEPS.length - 1 ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-medium leading-none mt-0.5 ${
                      isDone ? 'text-orange-600' : isCurrent ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-gray-400 mt-1">En cours...</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Desk Call banner */}
        {ticket.status === 'CALLED' && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white flex items-center gap-4 shadow-lg shadow-orange-200 animate-pulse">
            <Megaphone size={36} className="shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider font-bold opacity-90">Appel en cours</p>
              <p className="text-xl font-black">
                {ticket.guestPhone?.startsWith('G-')
                  ? `Présentez-vous au ${ticket.guestPhone.replace('G-', '')}`
                  : "C'est à votre tour au guichet !"}
              </p>
              <p className="text-xs opacity-90 mt-0.5">Votre numéro vient d&apos;être appelé.</p>
            </div>
          </div>
        )}

        {/* Serving banner */}
        {ticket.status === 'SERVING' && (
          <div className="bg-blue-600 rounded-2xl p-4 text-white flex items-center gap-3">
            <Settings size={26} className="shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
            <div>
              <p className="font-bold text-sm">Prise en charge en cours</p>
              <p className="text-xs opacity-90">
                {ticket.guestPhone?.startsWith('G-')
                  ? `Au ${ticket.guestPhone.replace('G-', '')}`
                  : "Vous êtes actuellement au guichet."}
              </p>
            </div>
          </div>
        )}

        {/* Info banner */}
        {ticket.status === 'WAITING' && ticket.position > 0 && ticket.position <= 3 && (
          <div className="bg-orange-500 rounded-2xl p-4 text-white flex items-center gap-3">
            <Megaphone size={28} />
            <div>
              <p className="font-bold">Votre tour approche !</p>
              <p className="text-sm opacity-90">Restez disponible, encore {ticket.position} personne{ticket.position > 1 ? 's' : ''} avant vous.</p>
            </div>
          </div>
        )}

        {/* Badge Offre Réclamée */}
        {ticket.claimedPromoTitle && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-emerald-800 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Offre active sur ce ticket</p>
                <p className="text-sm font-black text-gray-900">{ticket.claimedPromoTitle}</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">À régler au guichet lors de votre passage</p>
              </div>
            </div>
            {ticket.claimedPromoPrice && (
              <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">
                {ticket.claimedPromoPrice}
              </span>
            )}
          </div>
        )}

        {/* Promotions (shown while waiting/called) */}
        {['WAITING', 'CALLED', 'SERVING'].includes(ticket.status) && promotions.length > 0 && (
          <PromoCarousel
            promotions={promotions}
            ticketId={ticket.id}
            claimedPromoTitle={ticket.claimedPromoTitle}
            claimedPromoPrice={ticket.claimedPromoPrice}
            onPromoClaimed={(title, price) => {
              setTicket((prev: any) => ({ ...prev, claimedPromoTitle: title, claimedPromoPrice: price }))
            }}
          />
        )}

        {/* NPS Rating (shown when COMPLETED) */}
        {ticket.status === 'COMPLETED' && !ticket.npsScore && (
          <NPSWidget ticketId={ticket.id} />
        )}

        {/* Infos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">Informations</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Établissement</span>
              <span className="font-medium text-gray-900">{ticket.orgName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service</span>
              <span className="font-medium text-gray-900">{ticket.serviceName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Référence</span>
              <span className="font-medium font-mono text-gray-900">{ticket.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ticket créé à</span>
              <span className="font-medium text-gray-900">
                {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom z-20">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            onClick={() => setShowLeaveDialog(true)}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-red-200 hover:text-red-500 transition-all"
          >
            Quitter la file
          </button>
          <button className="flex-1 btn-primary text-sm">
            Partager mon ticket
          </button>
        </div>
      </div>

      {/* Leave dialog */}
      {showLeaveDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6">
            <div className="text-center mb-4">
              <AlertTriangle size={48} className="mx-auto text-red-500" />
              <h3 className="text-lg font-bold text-gray-900 mt-3">Quitter la file ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Votre ticket {ticket.displayNum} sera annulé et vous perdrez votre place. Cette action est irréversible.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveDialog(false)}
                className="flex-1 btn-secondary"
              >
                Rester
              </button>
              <button
                onClick={() => { setShowLeaveDialog(false); router.push('/') }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
