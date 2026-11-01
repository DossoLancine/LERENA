'use client'

import { useState, useRef } from 'react'
import { Accessibility, ArrowLeft, MapPin, Clock, Users, Star, ChevronRight, Heart, Share2, CheckCircle2, PlusSquare, Scissors, Utensils, Building2, Ticket, MousePointer2, AlertTriangle, User as UserIcon, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import { DynamicIcon } from '@/lib/icons'
import { useRouter } from 'next/navigation'
import { getOrganizationById } from '@/server/actions/orgs'
import { joinQueue } from '@/server/actions/tickets'
import { toggleFavorite } from '@/server/actions/favorites'
import { useSession, signOut } from 'next-auth/react'
import AppointmentBookingForm from '@/components/booking/appointment-booking-form'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { GuestTicketSheet } from '@/components/booking/guest-ticket-sheet'
import { haptics } from '@/lib/haptics'

type OrgDetails = NonNullable<Awaited<ReturnType<typeof getOrganizationById>>>

// Fiche préparée par le serveur (établissement + favori) : affichée immédiatement, déjà remplie
export default function OrgView({ params, initialOrg, initialIsFavorite }: {
  params: { id: string }
  initialOrg: OrgDetails | null
  initialIsFavorite: boolean
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  // Motif de priorité (proposé seulement si l'établissement l'autorise dans l'application)
  const [priorityId, setPriorityId] = useState<string | null>(null)
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

  const handleFavoriteClick = async () => {
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/org/${params.id}`)
      return
    }
    // Mise à jour immédiate, annulée en cas d'échec
    haptics.tap()
    setIsFavorite(!isFavorite)
    const res = await toggleFavorite(params.id)
    if (!res.success) {
      // Revert if error
      setIsFavorite(isFavorite)
    }
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
      router.push(`/ticket/${res.ticketId}`)
      return
    }
    if (res.error === "SESSION_EXPIRED") {
      setError("Votre session est expirée suite à une mise à jour système. Reconnexion en cours...")
      setTimeout(() => {
        signOut({ callbackUrl: `/auth/login?callbackUrl=/org/${params.id}` })
      }, 1500)
      return
    }
    if (res.error === "GPS_REQUIRED") {
      setError("Cet établissement exige votre position GPS pour éviter les abus. Veuillez autoriser la localisation.")
    } else if (res.error === "OUT_OF_BOUNDS") {
      setError(`Vous êtes trop loin ! Cet établissement n'autorise la prise de ticket qu'à proximité (max ${org?.maxRadiusKm || 10} km) pour éviter les retards. Rapprochez-vous !`)
    } else {
      setError(res.error || "Une erreur est survenue")
    }
    setIsJoining(false)
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

  // Attente réelle calculée par le serveur (personnes en file × durée du service)
  const totalWait = org.waitMin || 0
  const emoji = <DynamicIcon name={org.sectorIcon} size={48} className="text-white opacity-90" />
  const services = org.branches?.[0]?.services || [];

  const service = services.find((s: any) => s.id === selectedService)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative bg-white">
        <div className="h-48 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
          {emoji}
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
            onClick={handleFavoriteClick}
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
              <span className="text-sm font-semibold text-gray-800">
                {org.rating > 0 ? org.rating : 'Nouveau'}
              </span>
              {org.reviewCount > 0 && (
                <span className="text-xs text-gray-500">({org.reviewCount})</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 mt-2">
            <MapPin size={13} className="text-gray-400" />
            <p className="text-sm text-gray-500">{[org.address, org.distance].filter(Boolean).join(' · ')}</p>
          </div>

          <p className="text-sm text-gray-600 mt-3 leading-relaxed">{org.description}</p>

          {/* Status + wait */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              {org.isOpen ? (
                <>
                  <span className="badge-open mx-auto mb-1">Ouvert</span>
                  {org.closeTime && <p className="text-xs text-gray-500">Ferme à {org.closeTime}</p>}
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
                <span className="text-lg font-bold text-gray-800">{org.waitingCount || 0}</span>
              </div>
              <p className="text-xs text-gray-500">en file</p>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Choisissez un service</h2>
          <div className="stagger space-y-2">
            {services.map((svc: any) => (
              <button
                key={svc.id}
                onClick={() => {
                  selectService(svc.id)
                }}
                disabled={!org.isActive}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                  selectedService === svc.id
                    ? 'border-brand bg-orange-50 shadow-[0_6px_20px_-10px_rgba(194,65,12,0.45)]'
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
                      {svc.waitingCount || 0} en attente
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-sm font-semibold text-orange-500">~{svc.waitMin || 0} min</span>
                  {selectedService === svc.id && (
                    <CheckCircle2 size={16} className="text-brand mt-1 ml-auto animate-pop-in" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mode Switcher (Hybrid) */}
      {(org.bookingMode === 'HYBRID' || org.bookingMode === 'APPOINTMENT_ONLY') && (
        <div className="max-w-lg mx-auto px-4 mb-4 mt-2">
          {org.bookingMode === 'HYBRID' && (
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
              <button 
                onClick={() => setBookingType('TICKET')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${bookingType === 'TICKET' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Ticket size={16} /> Ticket immédiat
              </button>
              <button 
                onClick={() => setBookingType('APPOINTMENT')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${bookingType === 'APPOINTMENT' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <CalendarDays size={16} /> Rendez-vous
              </button>
            </div>
          )}
        </div>
      )}

      {/* Appointment Form */}
      {(bookingType === 'APPOINTMENT' || org.bookingMode === 'APPOINTMENT_ONLY') ? (
        <div className="max-w-lg mx-auto px-4 pb-32">
          <AppointmentBookingForm orgId={org.id} serviceId={selectedService} orgName={org.name} />
        </div>
      ) : (
        <>
          <div className="max-w-lg mx-auto px-4 pb-32">
            {org.priorities.length > 0 ? (
              /* L'établissement autorise le choix d'une priorité dans l'application */
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <h2 className="font-semibold text-gray-900 mb-3">Besoin spécifique ?</h2>
                <select
                  aria-label="Besoin spécifique"
                  value={priorityId ?? ''}
                  onChange={(e) => setPriorityId(e.target.value || null)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-orange-500 focus:border-orange-500 block p-3"
                >
                  <option value="">Non, attente classique</option>
                  {org.priorities.map((p: { id: string; label: string }) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-2">L’accueil peut vous demander un justificatif.</p>
              </div>
            ) : (
              /* Sinon, la priorité s'attribue à l'accueil, sur place */
              <p className="flex items-start gap-2 rounded-2xl bg-white border border-gray-100 p-4 text-sm text-gray-600">
                <Accessibility size={18} className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
                <span>Besoin d’une priorité (handicap, grossesse, âge…) ? Présentez-vous à l’accueil : l’agent l’ajoutera à votre ticket.</span>
              </p>
            )}
          </div>

          {/* CTA TICKET */}
          {org.isActive && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom z-30">
              <div className="max-w-lg mx-auto">
                {selectedService && service ? (
                  <div key={service.id} className="mb-3 p-3 bg-orange-50 rounded-xl flex items-center justify-between animate-rise-in">
                    <div>
                      <p className="text-xs text-gray-500">Service sélectionné</p>
                      <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Attente estimée</p>
                      <p className="text-sm font-bold text-orange-500">~{service.waitMin || 0} min</p>
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
                          <><Ticket size={20} /> Prendre mon ticket</>
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
        </>
      )}
      {selectedService && (
        <GuestTicketSheet
          open={showGuest}
          onClose={() => setShowGuest(false)}
          orgId={params.id}
          serviceId={selectedService}
          serviceName={service?.name}
          priorityId={priorityId}
          getPosition={() => (org?.requireGps ? getPosition(6000) : Promise.resolve(coordsRef.current))}
        />
      )}
      <BottomSheet open={isJoining} onClose={() => {}} dismissible={false}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="relative mb-6 flex h-28 w-48 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-xl shadow-orange-200 animate-pop-in">
            <Ticket size={44} />
            <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
            <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white" />
          </div>
          <p className="text-lg font-bold text-gray-900">Création de votre ticket…</p>
          <p className="mt-1 text-sm text-gray-500">{service?.name ?? org?.name}</p>
        </div>
      </BottomSheet>
    </div>
  )
}
