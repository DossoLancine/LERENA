'use client'

import { useState, useEffect, useCallback } from 'react'
import { TicketSkeleton } from '@/components/ui/skeletons'
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

import { getTicketById, leaveQueue } from '@/server/actions/tickets'
import { getPromotionsByOrg } from '@/server/actions/marketing'
import { ProgressRing } from '@/components/ticket/progress-ring'
import { YourTurnOverlay } from '@/components/ticket/your-turn-overlay'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { haptics, playChime, unlockAudio } from '@/lib/haptics'
import { counterLabel } from '@/lib/constants'
import { PushOptIn } from '@/components/ticket/push-opt-in'
import { LeaveNowCard, SpeakPositionButton } from '@/components/ticket/leave-now-card'
import { NPSWidget, PromoCarousel } from '@/components/marketing/marketing-widgets'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { useRef } from 'react'

export default function TicketPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [ticket, setTicket] = useState<any>(null)
  const [promotions, setPromotions] = useState<any[]>([])
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  
  const [showTurn, setShowTurn] = useState(false)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const prevStatus = useRef<string | null>(null)
  const prevPosition = useRef<number | null>(null)

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
      
      // Ticket appelé : alerte plein écran, vibration longue et carillon
      if (prevStatus.current === 'WAITING' && data.status === 'CALLED') {
        setShowTurn(true)
        haptics.alert()
        playChime()
      }
      // Le tour approche : petite vibration quand on passe à 2 personnes ou moins
      const pos = data.position ?? 0
      if (data.status === 'WAITING' && prevPosition.current !== null && prevPosition.current > 2 && pos <= 2) {
        haptics.nudge()
      }

      prevStatus.current = data.status
      prevPosition.current = pos
    }
    setLoading(false)
    setSecondsAgo(0)
  }, [params.id, ticket])

  // Initial fetch and Real-time polling
  // La position change dès qu'un autre ticket de l'établissement bouge
  const live = useOrgRealtime(ticket?.queue?.branch?.organizationId, fetchTicket)
  usePolling(fetchTicket, live ? 30000 : 5000)

  // Écran maintenu allumé quand le tour approche ou que le ticket est appelé
  useWakeLock(!!ticket && (ticket.status === 'CALLED' || (ticket.status === 'WAITING' && (ticket.position ?? 99) <= 3)))

  // Le carillon ne peut sonner qu'après un premier geste de l'utilisateur
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setSecondsAgo(s => s + 1)
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  if (loading) {
    return <TicketSkeleton />
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
  
  const counterName = counterLabel(ticket.counterName)
  const waitMin = Math.max(0, position * (ticket.service?.avgDurationMin || 15))
  const waitLabel = position === 0 ? 'Maintenant' : `${waitMin}–${waitMin + 10} min`
  const ahead = Math.max(0, position - 1)
  const spokenText = ticket.status === 'CALLED'
    ? `Ticket ${ticket.displayNum}. C'est votre tour. Présentez-vous au ${counterName}.`
    : ticket.status === 'WAITING'
      ? `Ticket ${ticket.displayNum}. ${ahead === 0 ? 'Vous êtes le prochain.' : `${ahead} personne${ahead > 1 ? 's' : ''} devant vous.`} Attente estimée : ${waitLabel}.`
      : `Ticket ${ticket.displayNum}.`
  const org = ticket.queue?.branch?.organization

  const handleShare = async () => {
    haptics.tap()
    const url = window.location.href
    const text = `Mon ticket ${ticket.displayNum} chez ${ticket.orgName} : suivez ma position en direct`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mon ticket ATTENDS', text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareMsg('Lien copié')
      setTimeout(() => setShareMsg(null), 2000)
    } catch {}
  }

  let progressPercent = 100
  if (ticket.status === 'WAITING') {
    progressPercent = Math.max(5, Math.round(((initialPosition - position) / initialPosition) * 100))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <YourTurnOverlay open={showTurn} ticketNumber={ticket.displayNum} counter={counterName} onDismiss={() => setShowTurn(false)} />
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} aria-label="Retour" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Mon ticket</h1>
          <SpeakPositionButton text={spokenText} />
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
              {live ? 'En direct' : `Mis à jour il y a ${secondsAgo}s`}
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

            {/* Position dans la file */}
            {ticket.status === 'WAITING' ? (
              <ProgressRing position={Math.max(0, position - 1)} progress={progressPercent} waitLabel={waitLabel} />
            ) : (
              <div className="rounded-2xl bg-gray-50 p-4 text-center text-sm font-medium text-gray-600">
                {ticket.status === 'CALLED' && `Présentez-vous au ${counterName}`}
                {ticket.status === 'SERVING' && `Prise en charge au ${counterName}`}
                {ticket.status === 'COMPLETED' && 'Merci de votre visite !'}
                {(ticket.status === 'CANCELLED' || ticket.status === 'ABSENT') && "Ce ticket n'est plus dans la file."}
              </div>
            )}
          </div>
        </div>

        {/* Alertes push : prévenu même téléphone verrouillé */}
        {ticket.status === 'WAITING' && <PushOptIn ticketId={ticket.id} />}

        {/* Partez au bon moment : trajet comparé à l'attente restante */}
        {ticket.status === 'WAITING' && position > 0 && (
          <LeaveNowCard orgLat={org?.lat ?? null} orgLng={org?.lng ?? null} waitMin={waitMin} />
        )}

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
                {`Présentez-vous au ${counterName}`}
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
                {`Au ${counterName}`}
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
            onClick={() => { haptics.tap(); setShowLeaveDialog(true) }}
            disabled={!['WAITING', 'CALLED'].includes(ticket.status)}
            className="pressable flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-red-200 hover:text-red-500 transition-all disabled:opacity-40"
          >
            Quitter la file
          </button>
          <button onClick={handleShare} className="flex-1 btn-primary text-sm">
            {shareMsg ?? 'Partager mon ticket'}
          </button>
        </div>
      </div>

      {/* Leave dialog */}
      <BottomSheet open={showLeaveDialog} onClose={() => setShowLeaveDialog(false)}>
          <div>
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
                onClick={async () => {
                  setShowLeaveDialog(false)
                  await leaveQueue(ticket.id)
                  router.push('/')
                }}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all"
              >
                Quitter
              </button>
            </div>
          </div>
      </BottomSheet>
    </div>
  )
}
