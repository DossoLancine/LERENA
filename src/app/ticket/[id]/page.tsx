'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Clock, Gift, Megaphone, Share2, Sun, LogOut } from 'lucide-react'
import { TicketSkeleton } from '@/components/ui/skeletons'
import { AnimatedNumber, useToast } from '@/components/ui'
import { TicketRoute } from '@/components/ticket/ticket-route'
import { TicketStub } from '@/components/ticket/ticket-stub'
import { QueueLine } from '@/components/ticket/queue-line'
import { getTicketById, leaveQueue } from '@/server/actions/tickets'
import { getPromotionsByOrg } from '@/server/actions/marketing'
import { YourTurnOverlay } from '@/components/ticket/your-turn-overlay'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { haptics, playChime, unlockAudio } from '@/lib/haptics'
import { counterLabel } from '@/lib/constants'
import { PushOptIn } from '@/components/ticket/push-opt-in'
import { ConsentOptIn } from '@/components/ticket/consent-opt-in'
import { LeaveNowCard, SpeakPositionButton } from '@/components/ticket/leave-now-card'
import { NPSWidget, PromoCarousel } from '@/components/marketing/marketing-widgets'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { cn } from '@/lib/cn'

const PILL: Record<string, [string, string]> = {
  WAITING: ['En file', 'bg-amber-100 text-amber-800'],
  CALLED: ['Appelé', 'bg-brand text-white'],
  SERVING: ['Au guichet', 'bg-info-soft text-info-ink'],
  COMPLETED: ['Terminé', 'bg-success-soft text-success-ink'],
  CANCELLED: ['Annulé', 'bg-gray-100 text-ink-muted'],
  ABSENT: ['Absent', 'bg-danger-soft text-danger-ink']
}

// Quatre étapes lisibles d'un coup d'œil (au lieu d'une longue frise)
const STEPS = [
  { label: 'Pris', done: ['WAITING', 'CALLED', 'SERVING', 'COMPLETED'] },
  { label: 'En file', done: ['CALLED', 'SERVING', 'COMPLETED'] },
  { label: 'Appelé', done: ['SERVING', 'COMPLETED'] },
  { label: 'Servi', done: ['COMPLETED'] }
]
const SUN_KEY = 'lerena:sun-mode'

/** Suivi d'un ticket en direct : le ticket à encoches, la file qui avance, l'action du moment. */
export default function TicketPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const toast = useToast()
  const [ticket, setTicket] = useState<any>(null)
  const [promotions, setPromotions] = useState<any[]>([])
  const [secondsAgo, setSecondsAgo] = useState(0)
  const [showLeaveDialog, setShowLeaveDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showTurn, setShowTurn] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [sun, setSun] = useState(false)
  const prevStatus = useRef<string | null>(null)
  const prevPosition = useRef<number | null>(null)
  const promosLoaded = useRef(false)
  // Le bloc de notation reste affiché après la 1re étoile (motif et commentaire), malgré le rafraîchissement du ticket
  const [rating, setRating] = useState(false)

  const fetchTicket = useCallback(async () => {
    const data = await getTicketById(params.id)
    if (data) {
      setTicket(data)
      if (!promosLoaded.current) {
        promosLoaded.current = true
        const orgId = data.queue?.branch?.organizationId
        if (orgId) getPromotionsByOrg(orgId).then(setPromotions)
      }
      // Ticket appelé : alerte plein écran, vibration longue et carillon
      if (prevStatus.current === 'WAITING' && data.status === 'CALLED') {
        setShowTurn(true)
        haptics.alert()
        playChime()
      }
      // Le tour approche : petite vibration quand on passe à 2 personnes ou moins
      const pos = data.position ?? 0
      if (data.status === 'WAITING' && prevPosition.current !== null && prevPosition.current > 2 && pos <= 2) haptics.nudge()
      prevStatus.current = data.status
      prevPosition.current = pos
    }
    setLoading(false)
    setSecondsAgo(0)
  }, [params.id])

  const live = useOrgRealtime(ticket?.queue?.branch?.organizationId, fetchTicket)
  usePolling(fetchTicket, live ? 30000 : 5000)

  // Écran maintenu allumé quand le tour approche ou que le ticket est appelé
  useWakeLock(!!ticket && (ticket.status === 'CALLED' || (ticket.status === 'WAITING' && (ticket.position ?? 99) <= 3)))

  useEffect(() => {
    // Le carillon ne peut sonner qu'après un premier geste de l'utilisateur
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    const timer = setInterval(() => setSecondsAgo(s => s + 1), 1000)
    try { setSun(localStorage.getItem(SUN_KEY) === '1') } catch {}
    // Ticket tout juste pris : il « sort de la fente »
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') === '1') {
      setPrinted(true)
      haptics.success()
      url.searchParams.delete('new')
      window.history.replaceState(null, '', url.pathname + url.search)
    }
    return () => { window.removeEventListener('pointerdown', unlockAudio); clearInterval(timer) }
  }, [])

  if (loading) return <TicketSkeleton />

  if (!ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken p-6 text-center">
        <AlertTriangle size={56} className="mb-4 text-ink-subtle" />
        <h2 className="font-display text-2xl font-bold text-ink">Ticket introuvable</h2>
        <p className="mt-1 text-sm text-ink-muted">Il a peut-être été annulé ou le lien est incomplet.</p>
        <Link href="/tickets" className="pressable mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-white">Voir mes tickets</Link>
      </div>
    )
  }

  const status: string = ticket.status
  const position = ticket.position || 0
  const ahead = Math.max(0, position - 1)
  const counterName = counterLabel(ticket.counterName)
  const avg = ticket.service?.avgDurationMin || 15
  const waitMin = Math.max(0, ahead * avg)
  const waitLabel = ahead === 0 ? 'Préparez-vous' : `${waitMin}–${waitMin + 10} min`
  const initialPosition = ticket.initialPosition || position || 1
  const progress = status === 'WAITING' ? Math.max(6, Math.round(((initialPosition - position) / initialPosition) * 100)) : 100
  const active = ['WAITING', 'CALLED', 'SERVING'].includes(status)
  const org = ticket.queue?.branch?.organization
  const [pillLabel, pillClass] = PILL[status] ?? PILL.WAITING
  const spokenText = status === 'CALLED'
    ? `Ticket ${ticket.displayNum}. C'est votre tour. Présentez-vous au ${counterName}.`
    : status === 'WAITING'
      ? `Ticket ${ticket.displayNum}. ${ahead === 0 ? 'Vous êtes le prochain.' : `${ahead} personne${ahead > 1 ? 's' : ''} devant vous.`} Attente estimée : ${waitLabel}.`
      : `Ticket ${ticket.displayNum}.`

  const toggleSun = () => {
    haptics.tap()
    setSun(s => { try { localStorage.setItem(SUN_KEY, s ? '0' : '1') } catch {} return !s })
  }

  const handleShare = async () => {
    haptics.tap()
    const url = window.location.href
    try {
      if (navigator.share) return void (await navigator.share({ title: 'Mon ticket Lerena', text: `Mon ticket ${ticket.displayNum} chez ${ticket.orgName} : suivez ma place en direct`, url }))
      await navigator.clipboard.writeText(url)
      toast('Lien du ticket copié')
    } catch { /* partage annulé */ }
  }

  return (
    <div className={cn('min-h-screen pb-32 transition-colors duration-500', sun ? 'bg-white' : 'bg-surface-sunken')}>
      <YourTurnOverlay open={showTurn} ticketNumber={ticket.displayNum} counter={counterName} onDismiss={() => setShowTurn(false)} />

      {/* En-tête dans le dégradé de la marque */}
      <div className={cn(!sun && 'bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] to-surface-sunken')}>
        <div className="mx-auto max-w-lg px-5 pb-2 pt-5">
          <div className="flex items-center justify-between">
            <button onClick={() => router.back()} aria-label="Retour" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-black/5"><ArrowLeft size={19} /></button>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              {active && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>}
              {active ? (live ? 'En direct' : `Actualisé il y a ${secondsAgo} s`) : 'Ticket'}
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleSun} aria-pressed={sun} aria-label="Mode plein soleil" title="Mode plein soleil" className={cn('flex h-10 w-10 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5', sun ? 'bg-amber-400 text-black' : 'bg-white text-ink')}><Sun size={18} /></button>
              <SpeakPositionButton text={spokenText} />
            </div>
          </div>

          <div className="mt-5">
            <TicketStub number={ticket.displayNum} orgName={ticket.orgName} serviceName={ticket.serviceName} logo={ticket.orgLogo} color={ticket.orgColor} printed={printed} sun={sun}
              status={<span className={cn('rounded-full px-3 py-1 text-xs font-bold', pillClass)}>{pillLabel}</span>}
              footer={<>
                <TicketRoute route={ticket.route} current={ticket.serviceName} className="mt-3" />
                <p className={cn('mt-2 text-xs', sun ? 'text-black' : 'text-ink-subtle')}>Pris à {new Date(ticket.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
              </>} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-5 pt-4">
        {/* L'action du moment */}
        {status === 'WAITING' && (
          <section className={cn('rounded-[26px] p-5 shadow-card ring-1', ahead === 0 ? 'bg-brand text-white ring-brand' : 'bg-white ring-black/[0.03]')} aria-live="polite">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className={cn('text-xs font-semibold uppercase tracking-wider', ahead === 0 ? 'text-white/80' : 'text-ink-subtle')}>{ahead === 0 ? 'Vous êtes le prochain' : 'Devant vous'}</p>
                {ahead === 0
                  ? <p className="font-display text-4xl font-extrabold leading-tight">Approchez-vous du guichet</p>
                  : <p className="font-display text-6xl font-extrabold leading-none tabular-nums text-ink"><AnimatedNumber value={ahead} /> <span className="font-sans text-base font-semibold text-ink-muted">personne{ahead > 1 ? 's' : ''}</span></p>}
              </div>
              {ahead > 0 && (
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Attente</p>
                  <p className="flex items-center justify-end gap-1 text-lg font-bold text-brand"><Clock size={16} />{waitLabel}</p>
                </div>
              )}
            </div>
            {ahead > 0 && <>
              <QueueLine ahead={ahead} className="mt-5" />
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression dans la file">
                <div className="h-full rounded-full bg-gradient-to-r from-[#fb923c] to-brand transition-[width] duration-1000 ease-spring" style={{ width: `${progress}%` }} />
              </div>
              {position <= 3 && <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand"><Megaphone size={16} /> Votre tour approche : restez à proximité.</p>}
            </>}
          </section>
        )}

        {status === 'CALLED' && (
          <button onClick={() => setShowTurn(true)} className="w-full animate-pop-in rounded-[26px] bg-gradient-to-br from-[#fb923c] via-brand to-brand-700 p-6 text-left text-white shadow-[0_18px_40px_-18px_rgba(194,65,12,0.7)]">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/85"><Megaphone size={16} /> C’est votre tour</p>
            <p className="mt-1 font-display text-4xl font-extrabold leading-tight">Allez au {counterName}</p>
            <p className="mt-1 text-sm text-white/85">Votre numéro vient d’être appelé.</p>
          </button>
        )}

        {status === 'SERVING' && (
          <section className="rounded-[26px] bg-info-soft p-5 text-info-ink">
            <p className="text-xs font-bold uppercase tracking-wider">Prise en charge</p>
            <p className="mt-1 font-display text-3xl font-extrabold">Au {counterName}</p>
          </section>
        )}

        {status === 'COMPLETED' && (
          <section className="animate-rise-in rounded-[26px] bg-white p-5 text-center shadow-card">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><Check size={28} strokeWidth={3} /></span>
            <p className="mt-3 font-display text-2xl font-extrabold text-ink">Merci de votre visite</p>
            <p className="text-sm text-ink-muted">Votre avis aide {ticket.orgName} à mieux vous accueillir.</p>
          </section>
        )}

        {(status === 'CANCELLED' || status === 'ABSENT') && (
          <section className="rounded-[26px] bg-white p-5 text-center shadow-card">
            <p className="font-display text-2xl font-extrabold text-ink">{status === 'ABSENT' ? 'Vous avez été appelé en votre absence' : 'Ticket annulé'}</p>
            <p className="mt-1 text-sm text-ink-muted">Ce ticket n’est plus dans la file.</p>
            {org?.id && <Link href={`/org/${org.id}`} className="pressable mt-4 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Reprendre un ticket</Link>}
          </section>
        )}

        {/* Étapes */}
        <ol className="flex items-center rounded-[22px] bg-white px-4 py-3.5 shadow-card ring-1 ring-black/[0.03]" aria-label="Étapes du ticket">
          {STEPS.map((s, i) => {
            const done = s.done.includes(status)
            const current = !done && (i === 0 || STEPS[i - 1].done.includes(status)) && active
            return (
              <li key={s.label} className="flex flex-1 items-center last:flex-none">
                <span className="flex flex-col items-center gap-1">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-500 ease-spring',
                    done ? 'bg-brand text-white' : current ? 'bg-brand-50 text-brand ring-2 ring-brand' : 'bg-gray-100 text-ink-subtle')}>
                    {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={cn('text-[11px] font-semibold', done || current ? 'text-ink' : 'text-ink-subtle')}>{s.label}</span>
                </span>
                {i < STEPS.length - 1 && <span className={cn('mx-1.5 mb-4 h-0.5 flex-1 rounded-full transition-colors duration-700', done ? 'bg-brand' : 'bg-gray-200')} aria-hidden="true" />}
              </li>
            )
          })}
        </ol>

        {status === 'WAITING' && <PushOptIn ticketId={ticket.id} />}
        {status === 'WAITING' && position > 0 && <LeaveNowCard orgLat={org?.lat ?? null} orgLng={org?.lng ?? null} waitMin={waitMin} />}

        {ticket.claimedPromoTitle && (
          <div className="flex items-center justify-between gap-3 rounded-[22px] bg-success-soft p-4 text-success-ink">
            <span className="flex items-center gap-2.5">
              <Gift size={22} />
              <span>
                <span className="block text-xs font-bold uppercase tracking-wider">Offre réservée</span>
                <span className="block text-sm font-bold text-ink">{ticket.claimedPromoTitle}</span>
                <span className="block text-[11px]">À régler au guichet lors de votre passage</span>
              </span>
            </span>
            {ticket.claimedPromoPrice && <span className="rounded-full bg-success px-2.5 py-1 text-xs font-black text-white">{ticket.claimedPromoPrice}</span>}
          </div>
        )}

        {active && promotions.length > 0 && (
          <PromoCarousel promotions={promotions} ticketId={ticket.id} claimedPromoTitle={ticket.claimedPromoTitle} claimedPromoPrice={ticket.claimedPromoPrice}
            onPromoClaimed={(title, price) => setTicket((prev: any) => ({ ...prev, claimedPromoTitle: title, claimedPromoPrice: price }))} />
        )}

        {status === 'COMPLETED' && (!ticket.npsScore || rating) && <NPSWidget ticketId={ticket.id} onRated={() => setRating(true)} />}
        {(status === 'WAITING' || status === 'COMPLETED') && <ConsentOptIn ticketId={ticket.id} />}

        {/* Détails repliés */}
        <details className="group rounded-[22px] bg-white shadow-card ring-1 ring-black/[0.03]">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-ink">
            Détails du ticket <ChevronDown size={17} className="text-ink-subtle transition-transform group-open:rotate-180" />
          </summary>
          <dl className="space-y-2 border-t border-surface-line px-4 py-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Établissement</dt><dd className="text-right font-medium text-ink">{ticket.orgName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Service</dt><dd className="text-right font-medium text-ink">{ticket.serviceName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-ink-muted">Référence</dt><dd className="font-mono text-xs text-ink">{ticket.id.slice(-8).toUpperCase()}</dd></div>
          </dl>
        </details>
      </div>

      {/* Actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-surface-line bg-white/90 p-4 backdrop-blur-lg safe-bottom">
        <div className="mx-auto flex max-w-lg gap-3">
          {['WAITING', 'CALLED'].includes(status) && (
            <button onClick={() => { haptics.tap(); setShowLeaveDialog(true) }} className="pressable flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3.5 text-sm font-semibold text-ink-muted ring-1 ring-gray-200 hover:text-danger">
              <LogOut size={16} /> Quitter
            </button>
          )}
          <button onClick={handleShare} className="pressable flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#fb923c] to-brand py-3.5 text-sm font-bold text-white shadow-md">
            <Share2 size={16} /> Partager mon ticket
          </button>
        </div>
      </div>

      <BottomSheet open={showLeaveDialog} onClose={() => setShowLeaveDialog(false)}>
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"><LogOut size={26} /></span>
          <h3 className="mt-3 font-display text-2xl font-extrabold text-ink">Quitter la file ?</h3>
          <p className="mt-1 text-sm text-ink-muted">Le ticket {ticket.displayNum} sera annulé et vous perdrez votre place.</p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setShowLeaveDialog(false)} className="pressable flex-1 rounded-2xl bg-gray-100 py-3.5 font-semibold text-ink">Rester</button>
            <button onClick={async () => { setShowLeaveDialog(false); await leaveQueue(ticket.id); router.push('/') }} className="pressable flex-1 rounded-2xl bg-danger py-3.5 font-semibold text-white">Quitter</button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
