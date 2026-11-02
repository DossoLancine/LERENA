'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Accessibility, AlertTriangle, ArrowLeft, CalendarDays, Check, Clock, Heart, MapPin, Navigation, Phone, Share2, Sparkles, Star, Ticket, Users } from 'lucide-react'
import { DynamicIcon } from '@/lib/icons'
import { getOrganizationById } from '@/server/actions/orgs'
import { joinQueue } from '@/server/actions/tickets'
import { toggleFavorite } from '@/server/actions/favorites'
import AppointmentBookingForm from '@/components/booking/appointment-booking-form'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { GuestTicketSheet } from '@/components/booking/guest-ticket-sheet'
import { haptics } from '@/lib/haptics'
import { OrgMark } from '@/components/branding/org-mark'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type OrgDetails = NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>
type Busy = NonNullable<OrgDetails['busy']>

/** Affluence du jour : barres claires = habituellement, barres orange = aujourd'hui ; repère de l'heure actuelle. */
function BusyChart({ busy }: { busy: Busy }) {
  const max = Math.max(1, ...busy.hours.map(h => Math.max(h.usual, h.today)))
  const nowEntry = busy.hours.find(h => h.hour === busy.nowHour)
  const level = nowEntry ? (nowEntry.today >= max * 0.66 ? 'Très fréquenté' : nowEntry.today >= max * 0.33 ? 'Fréquentation moyenne' : 'Plutôt calme') : null
  return (
    <section className="rounded-[24px] bg-white p-5 shadow-card ring-1 ring-black/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Affluence aujourd’hui</h2>
          {level && <p className="text-sm text-ink-muted">En ce moment : <span className="font-semibold text-ink">{level}</span></p>}
        </div>
        {busy.bestHour != null && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-xs font-bold text-success-ink"><Sparkles size={13} /> Calme vers {busy.bestHour} h</span>
        )}
      </div>
      <div className="mt-5 flex h-28 items-end gap-1" role="img" aria-label={`Affluence par heure${busy.bestHour != null ? `, plus calme vers ${busy.bestHour} heures` : ''}`}>
        {busy.hours.map((h, i) => {
          const now = h.hour === busy.nowHour
          return (
            <div key={h.hour} className="relative flex h-full flex-1 flex-col items-center justify-end">
              {now && <span className="absolute -top-1 rounded bg-ink px-1 text-[9px] font-bold text-white">Maint.</span>}
              <div className="relative flex h-[84%] w-full items-end justify-center">
                <span className="absolute bottom-0 w-full origin-bottom animate-bar-grow rounded-t-[4px] bg-brand/15" style={{ height: `${Math.max(4, (h.usual / max) * 100)}%`, animationDelay: `${i * 30}ms` }} />
                {h.today > 0 && <span className={cn('relative w-1/2 origin-bottom animate-bar-grow rounded-t-[4px]', now ? 'bg-brand' : 'bg-brand/70')} style={{ height: `${(h.today / max) * 100}%`, animationDelay: `${i * 30 + 120}ms` }} />}
              </div>
              <span className={cn('mt-1 text-[10px] tabular-nums', now ? 'font-bold text-ink' : 'text-ink-subtle')}>{i % 2 === 0 || now ? `${h.hour}h` : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-ink-subtle">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand/15" /> Habituellement</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" /> Aujourd’hui</span>
      </div>
    </section>
  )
}

// Fiche préparée par le serveur (établissement + favori) : affichée immédiatement, déjà remplie
export default function OrgView({ params, initialOrg, initialIsFavorite }: {
  params: { id: string }
  initialOrg: OrgDetails | null
  initialIsFavorite: boolean
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const toast = useToast()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  // Motif de priorité (proposé seulement si l'établissement l'autorise dans l'application)
  const [priorityId, setPriorityId] = useState<string | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const org: any = initialOrg
  const [error, setError] = useState<string | null>(null)
  const [bookingType, setBookingType] = useState<'TICKET' | 'APPOINTMENT'>('TICKET')
  // Position GPS demandée dès le choix du service, pour que la prise de ticket soit immédiate
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null)
  const [showGuest, setShowGuest] = useState(false)

  const getPosition = (timeout: number) => new Promise<{ lat: number; lng: number } | null>((resolve) => {
    if (coordsRef.current) return resolve(coordsRef.current)
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        resolve(coordsRef.current)
      },
      () => resolve(null),
      { maximumAge: 5 * 60 * 1000, timeout }
    )
  })

  const selectService = (id: string) => {
    haptics.tap()
    setSelectedService(id)
    setError(null)
    if (!coordsRef.current) getPosition(8000)
  }

  // Partage : feuille de partage du téléphone (WhatsApp, SMS…), sinon copie du lien
  const handleShare = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: org.name, text: `File d'attente — ${org.name}`, url })
      else { await navigator.clipboard.writeText(url); toast('Lien copié') }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast('Partage impossible', 'error')
    }
  }

  const handleFavoriteClick = async () => {
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/org/${params.id}`)
      return
    }
    // Mise à jour immédiate, annulée en cas d'échec
    haptics.tap()
    setIsFavorite(!isFavorite)
    const res = await toggleFavorite(params.id)
    if (!res.success) setIsFavorite(isFavorite)
  }

  const handleJoinQueue = async () => {
    if (!selectedService) return
    if (!session?.user) {
      haptics.tap()
      setShowGuest(true)
      return
    }
    setIsJoining(true)
    setError(null)
    haptics.tap()

    // Position déjà connue (demandée au choix du service) ; sinon on ne l'attend que si elle est exigée
    const coords = coordsRef.current ?? (org?.requireGps ? await getPosition(6000) : null)
    const res = await joinQueue(selectedService, params.id, priorityId, coords?.lat, coords?.lng)

    if (res.success && res.ticketId) {
      haptics.success()
      router.push(`/ticket/${res.ticketId}?new=1`)
      return
    }
    if (res.error === "SESSION_EXPIRED") {
      setError("Votre session a expiré. Reconnexion en cours…")
      setTimeout(() => { signOut({ callbackUrl: `/auth/login?callbackUrl=/org/${params.id}` }) }, 1500)
      return
    }
    if (res.error === "GPS_REQUIRED") {
      setError("Cet établissement demande votre position pour éviter les tickets à distance. Autorisez la localisation, puis réessayez.")
    } else if (res.error === "OUT_OF_BOUNDS") {
      setError(`Vous êtes trop loin : cet établissement accepte les tickets à moins de ${org?.maxRadiusKm || 10} km. Rapprochez-vous puis réessayez.`)
    } else {
      setError(res.error || "Une erreur est survenue")
    }
    setIsJoining(false)
  }

  if (!org) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken p-6 text-center">
        <AlertTriangle size={56} className="mb-4 text-ink-subtle" />
        <h2 className="font-display text-2xl font-bold text-ink">Établissement introuvable</h2>
        <p className="mt-1 text-sm text-ink-muted">Il n’existe pas ou n’est plus disponible.</p>
        <Link href="/explore" className="pressable mt-6 rounded-full bg-brand px-6 py-3 font-semibold text-white">Explorer</Link>
      </div>
    )
  }

  // Attente réelle calculée par le serveur (personnes en file × durée du service)
  const totalWait = org.waitMin || 0
  // Plusieurs sites : le visiteur choisit le sien (sites ouverts ayant des services)
  const sites = (org.branches || []).filter((b: any) => b.isActive !== false && b.services?.some((sv: any) => sv.isActive))
  const site = sites.find((b: any) => b.id === siteId) ?? sites[0]
  const services = (site?.services || []).filter((sv: any) => sv.isActive)
  const service = services.find((s: any) => s.id === selectedService)
  const hex = org.brandColor ?? '#c2410c'
  const showTickets = !(bookingType === 'APPOINTMENT' || org.bookingMode === 'APPOINTMENT_ONLY')
  const mapsUrl = org.lat && org.lng ? `https://www.google.com/maps/dir/?api=1&destination=${org.lat},${org.lng}` : org.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${org.name} ${org.address}`)}` : null

  const roundAction = 'flex flex-col items-center gap-1.5 text-[11px] font-semibold text-ink-muted'
  const roundIcon = 'flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand ring-1 ring-brand/15 transition-transform active:scale-95'

  return (
    <div className="min-h-screen bg-surface-sunken">
      {/* Couverture : couleur et logo de l'établissement */}
      <div className="relative h-[240px] overflow-hidden" style={{ background: `linear-gradient(150deg, ${hex}cc 0%, ${hex} 55%, #7c2d12 130%)` }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-20 190 C 80 110, 170 250, 270 140 S 430 70, 450 120" fill="none" stroke="white" strokeWidth="2" />
          <path d="M-20 215 C 90 140, 180 270, 280 170 S 430 110, 450 150" fill="none" stroke="white" strokeWidth="1" />
        </svg>
        <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative mx-auto flex h-full max-w-lg items-center justify-center pb-6">
          {org.logo
            ? <OrgMark name={org.name} logo={org.logo} size={104} className="animate-pop-in shadow-xl" />
            : <span className="flex h-24 w-24 animate-pop-in items-center justify-center rounded-[28px] bg-white/20 text-white ring-1 ring-white/30 backdrop-blur"><DynamicIcon name={org.sectorIcon} size={46} /></span>}
        </div>
        <div className="absolute inset-x-0 top-0 mx-auto flex max-w-lg items-center justify-between px-4 pt-4">
          <button onClick={() => router.back()} aria-label="Retour" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow backdrop-blur"><ArrowLeft size={19} /></button>
          <div className="flex gap-2">
            <button onClick={handleFavoriteClick} aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={isFavorite} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow backdrop-blur">
              <Heart size={18} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-ink'} />
            </button>
            <button onClick={handleShare} aria-label="Partager" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow backdrop-blur"><Share2 size={18} /></button>
          </div>
        </div>
      </div>

      <div className="relative mx-auto -mt-8 max-w-lg space-y-4 px-4 pb-36">
        {/* Fiche */}
        <section className="animate-rise-in rounded-[28px] bg-white p-5 shadow-card ring-1 ring-black/[0.03]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-ink">{org.name}</h1>
              <p className="text-sm text-ink-muted">{org.category}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-semibold text-ink">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              {org.rating > 0 ? <>{org.rating.toLocaleString('fr-FR')} <span className="text-xs font-normal text-ink-subtle">({org.reviewCount})</span></> : 'Nouveau'}
            </span>
          </div>
          {(org.address || org.distance) && <p className="mt-2 flex items-start gap-1.5 text-sm text-ink-muted"><MapPin size={14} className="mt-0.5 shrink-0 text-ink-subtle" />{[org.address, org.distance].filter(Boolean).join(' · ')}</p>}

          {/* En direct */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className={cn('rounded-2xl p-3', org.isOpen ? 'bg-success-soft' : 'bg-danger-soft')}>
              <p className={cn('flex items-center gap-1.5 text-sm font-bold', org.isOpen ? 'text-success-ink' : 'text-danger-ink')}>
                <span className={cn('h-2 w-2 rounded-full', org.isOpen ? 'animate-pulse bg-success' : 'bg-danger')} />{org.isOpen ? 'Ouvert' : 'Fermé'}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{org.isOpen ? (org.closeTime ? `jusqu’à ${org.closeTime}` : 'en ce moment') : org.openTime ? `ouvre à ${org.openTime}` : 'pour le moment'}</p>
            </div>
            <div className="rounded-2xl bg-brand-50 p-3">
              <p className="flex items-center gap-1 text-sm font-bold text-brand-700"><Clock size={14} />{totalWait > 0 ? `~${totalWait} min` : 'Sans attente'}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">d’attente</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="flex items-center gap-1 text-sm font-bold text-ink"><Users size={14} />{org.waitingCount || 0}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">en file</p>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="mt-5 flex justify-around border-t border-surface-line pt-4">
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={roundAction}><span className={roundIcon}><Navigation size={19} /></span>Itinéraire</a>}
            {org.phone && <a href={`tel:${org.phone}`} className={roundAction}><span className={roundIcon}><Phone size={19} /></span>Appeler</a>}
            <button type="button" onClick={handleShare} className={roundAction}><span className={roundIcon}><Share2 size={19} /></span>Partager</button>
            <button type="button" onClick={handleFavoriteClick} className={roundAction}><span className={roundIcon}><Heart size={19} className={isFavorite ? 'fill-current' : ''} /></span>{isFavorite ? 'Favori' : 'Suivre'}</button>
          </div>
        </section>

        {org.busy && <BusyChart busy={org.busy} />}

        {org.description && <p className="px-1 text-sm leading-relaxed text-ink-muted">{org.description}</p>}

        {/* Ticket ou rendez-vous */}
        {org.bookingMode === 'HYBRID' && (
          <div className="flex rounded-2xl bg-white p-1 shadow-card ring-1 ring-black/[0.03]" role="tablist" aria-label="Type de passage">
            {([['TICKET', Ticket, 'Ticket immédiat'], ['APPOINTMENT', CalendarDays, 'Rendez-vous']] as const).map(([key, Icon, label]) => (
              <button key={key} type="button" role="tab" aria-selected={bookingType === key} onClick={() => { haptics.tap(); setBookingType(key) }}
                className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all', bookingType === key ? 'bg-gradient-to-br from-[#fb923c] to-brand text-white shadow-md' : 'text-ink-muted')}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        )}

        {sites.length > 1 && (
          <section>
            <h2 className="mb-2 px-1 font-display text-lg font-bold text-ink">Votre site</h2>
            <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Site">
              {sites.map((b: any) => (
                <button key={b.id} type="button" role="radio" aria-checked={b.id === site?.id} onClick={() => { haptics.tap(); setSiteId(b.id); setSelectedService(null) }}
                  className={cn('shrink-0 rounded-2xl px-4 py-2.5 text-left text-sm shadow-card ring-1 transition-all', b.id === site?.id ? 'bg-brand-50 ring-2 ring-brand' : 'bg-white ring-black/[0.03]')}>
                  <span className="block font-semibold text-ink">{b.name}</span>
                  {(b.address || b.city) && <span className="block text-xs text-ink-subtle">{[b.address, b.city].filter(Boolean).join(', ')}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Le service se choisit dans les deux modes : ticket immédiat ou rendez-vous */}
        <section>
          <h2 className="mb-2 px-1 font-display text-lg font-bold text-ink">{showTickets ? 'Pour quel service ?' : 'Rendez-vous pour quel service ?'}</h2>
          <div className="stagger space-y-2.5" role="radiogroup" aria-label="Service">
            {services.map((svc: any) => {
              const selected = selectedService === svc.id
              return (
                <button key={svc.id} type="button" role="radio" aria-checked={selected} onClick={() => selectService(svc.id)} disabled={!org.isActive}
                  className={cn('flex w-full items-center gap-3 rounded-[22px] bg-white p-3.5 text-left shadow-card transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50',
                    selected ? 'ring-2 ring-brand shadow-[0_10px_28px_-14px_rgba(194,65,12,0.55)]' : 'ring-1 ring-black/[0.03]')}>
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-colors', selected ? 'bg-brand text-white' : 'bg-brand-50 text-brand')}>
                    {selected ? <Check size={20} strokeWidth={3} className="animate-pop-in" /> : <DynamicIcon name={svc.icon ?? org.sectorIcon} size={20} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{svc.name}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                      <span className="flex items-center gap-1"><Users size={11} />{svc.waitingCount || 0} en attente</span>
                      <span aria-hidden="true">·</span>
                      <span>~{svc.avgDurationMin} min / passage</span>
                    </span>
                  </span>
                  {showTickets && <span className={cn('shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold', svc.waitMin ? 'bg-brand-50 text-brand-700' : 'bg-success-soft text-success-ink')}>{svc.waitMin ? `~${svc.waitMin} min` : 'Libre'}</span>}
                </button>
              )
            })}
          </div>
        </section>

        {!showTickets ? (
          <AppointmentBookingForm orgId={org.id} serviceId={selectedService} orgName={org.name} />
        ) : (
          <>

            {org.priorities.length > 0 ? (
              /* L'établissement autorise le choix d'une priorité dans l'application */
              <section className="rounded-[22px] bg-white p-4 shadow-card ring-1 ring-black/[0.03]">
                <label htmlFor="priority" className="flex items-center gap-2 font-semibold text-ink"><Accessibility size={17} className="text-info" /> Besoin d’une priorité ?</label>
                <select id="priority" value={priorityId ?? ''} onChange={(e) => setPriorityId(e.target.value || null)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-ink">
                  <option value="">Non, attente classique</option>
                  {org.priorities.map((p: { id: string; label: string }) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <p className="mt-2 text-xs text-ink-subtle">L’accueil peut vous demander un justificatif.</p>
              </section>
            ) : (
              /* Sinon, la priorité s'attribue à l'accueil, sur place */
              <p className="flex items-start gap-2 px-1 text-sm text-ink-muted">
                <Accessibility size={17} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
                <span>Besoin d’une priorité (handicap, grossesse, âge) ? L’accueil l’ajoutera à votre ticket sur place.</span>
              </p>
            )}
          </>
        )}
      </div>

      {/* Bouton principal, toujours à portée du pouce */}
      {showTickets && org.isActive && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-line bg-white/90 p-4 backdrop-blur-lg safe-bottom">
          <div className="mx-auto max-w-lg">
            {error && <p role="alert" className="mb-3 animate-rise-in rounded-xl bg-danger-soft p-3 text-center text-sm text-danger-ink">{error}</p>}
            <button onClick={handleJoinQueue} disabled={!selectedService || isJoining}
              className={cn('pressable flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold transition-all',
                selectedService ? 'bg-gradient-to-br from-[#fb923c] to-brand text-white shadow-[0_12px_30px_-12px_rgba(194,65,12,0.7)]' : 'bg-gray-100 text-ink-subtle')}>
              <Ticket size={20} />
              {selectedService && service
                ? <span key={service.id} className="animate-rise-in truncate">Prendre un ticket · {service.name}{service.waitMin ? ` · ~${service.waitMin} min` : ''}</span>
                : 'Choisissez un service'}
            </button>
          </div>
        </div>
      )}

      {selectedService && (
        <GuestTicketSheet open={showGuest} onClose={() => setShowGuest(false)} orgId={params.id} serviceId={selectedService} serviceName={service?.name} priorityId={priorityId}
          getPosition={() => (org?.requireGps ? getPosition(6000) : Promise.resolve(coordsRef.current))} />
      )}

      {/* Création du ticket : le ticket à encoches se prépare */}
      <BottomSheet open={isJoining} onClose={() => {}} dismissible={false}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="ticket-shadow mb-6 animate-pop-in">
            <div className="ticket-notch flex h-28 w-48 items-center justify-center rounded-3xl bg-gradient-to-br from-[#fb923c] to-brand text-white" style={{ ['--notch-y' as string]: '50%' }}>
              <Ticket size={44} className="animate-pulse" />
            </div>
          </div>
          <p className="font-display text-xl font-extrabold text-ink">Préparation de votre ticket…</p>
          <p className="mt-1 text-sm text-ink-muted">{service?.name ?? org?.name}</p>
        </div>
      </BottomSheet>
    </div>
  )
}
