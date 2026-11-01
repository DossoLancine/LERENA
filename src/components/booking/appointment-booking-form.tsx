'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Calendar, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { createAppointment, createGuestAppointment, getAvailableSlots, getBookingDays } from '@/server/actions/appointments'
import { Button, Card, TextInput } from '@/components/ui'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'

/** Réservation sur les créneaux réels : horaires de l'agence, durée du service, rendez-vous déjà pris. */
export default function AppointmentBookingForm({ orgId, serviceId, orgName }: { orgId: string; serviceId: string | null; orgName: string }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [days, setDays] = useState<string[] | null>(null)
  const [day, setDay] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean }[] | null>(null)
  const [time, setTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Réservation faite : code d'arrivée et lien pour reporter ou annuler
  const [success, setSuccess] = useState<{ code: string; manageUrl: string; when: string } | null>(null)
  // Sans compte : prénom et téléphone
  const [guest, setGuest] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDays(null); setDay(''); setSlots(null); setTime('')
    if (serviceId) getBookingDays(orgId, serviceId).then(setDays)
  }, [orgId, serviceId])

  useEffect(() => {
    setSlots(null); setTime('')
    if (serviceId && day) getAvailableSlots(orgId, serviceId, day).then(setSlots)
  }, [orgId, serviceId, day])

  const book = async () => {
    if (!serviceId || !day || !time) return
    if (!session?.user && !guest) {
      setGuest(true)
      return
    }
    haptics.tap()
    setSubmitting(true)
    setError(null)
    const when = new Date(`${day}T${time}:00Z`)
    const res = session?.user
      ? await createAppointment(orgId, serviceId, when)
      : await createGuestAppointment({ orgId, serviceId, scheduledDate: when, name: guestName, phone: guestPhone })
    if (res.success) {
      haptics.success()
      setSuccess({ code: res.appointment.code, manageUrl: res.appointment.manageUrl, when: when.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) })
      return
    }
    setError(res.error === 'CODE_INVALID' ? 'Vérification par SMS requise : créez un compte ou contactez l’établissement.' : res.error ?? t('errors.generic.title'))
    setSubmitting(false)
    // Le créneau a pu être pris entre-temps : on rafraîchit la liste
    getAvailableSlots(orgId, serviceId, day).then(setSlots)
  }

  if (success) {
    return (
      <Card className="mb-4 p-6 text-center animate-pop-in">
        <CheckCircle2 size={48} className="mx-auto mb-3 text-success" />
        <h3 className="mb-1 text-lg font-bold text-ink">{t('booking.confirmed')}</h3>
        <p className="text-sm text-ink-muted">{orgName} · {success.when}</p>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">Code d’arrivée</p>
        <p className="text-4xl font-black tracking-[0.3em] text-ink">{success.code}</p>
        <p className="mt-2 text-xs text-ink-muted">Donnez-le à l’accueil ou tapez-le à la borne en arrivant : vous serez appelé à l’heure de votre rendez-vous.</p>
        <div className="mt-4 flex flex-col gap-2">
          <a href={new URL(success.manageUrl).pathname} className="rounded-control bg-gray-900 py-3 text-sm font-bold text-white">Voir, reporter ou annuler</a>
          {session?.user && <Link href="/tickets" className="text-sm font-semibold text-brand">Mes rendez-vous</Link>}
        </div>
      </Card>
    )
  }

  if (!serviceId) {
    return <Card className="mb-4 p-4 text-sm text-ink-muted">{t('booking.pickService')}</Card>
  }

  return (
    <Card className="mb-4 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink"><Calendar size={18} className="text-brand" />{t('booking.pickDay')}</h2>

      {days === null ? (
        <div className="mb-4 flex gap-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 w-[70px] animate-pulse rounded-xl bg-gray-200/80" />)}</div>
      ) : days.length === 0 ? (
        <p className="mb-4 text-sm text-ink-muted">{t('booking.noDays')}</p>
      ) : (
        <div className="hide-scrollbar mb-4 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label={t('booking.pickDay')}>
          {days.map(d => {
            const date = new Date(`${d}T12:00:00Z`)
            const active = day === d
            return (
              <button key={d} role="radio" aria-checked={active} onClick={() => { haptics.tap(); setDay(d) }}
                className={cn('flex min-w-[70px] flex-col items-center justify-center rounded-xl border-2 p-3 transition-all',
                  active ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted hover:border-gray-200')}>
                <span className="text-xs font-medium uppercase">{date.toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })}</span>
                <span className="text-xl font-bold">{date.getUTCDate()}</span>
                <span className="text-[10px]">{date.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' })}</span>
              </button>
            )
          })}
        </div>
      )}

      {day && (
        <>
          <h2 className="mb-3 mt-2 flex items-center gap-2 font-semibold text-ink"><Clock size={18} className="text-brand" />{t('booking.pickTime')}</h2>
          {slots === null ? (
            <div className="mb-4 grid grid-cols-4 gap-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-200/80" />)}</div>
          ) : slots.every(s => !s.available) ? (
            <p className="mb-4 text-sm text-ink-muted">{t('booking.dayFull')}</p>
          ) : (
            <div className="mb-4 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('booking.pickTime')}>
              {slots.map(s => (
                <button key={s.time} role="radio" aria-checked={time === s.time} disabled={!s.available}
                  onClick={() => { haptics.tap(); setTime(s.time) }}
                  className={cn('min-h-[44px] rounded-lg border-2 px-1 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:border-transparent disabled:bg-gray-50 disabled:text-gray-300 disabled:line-through',
                    time === s.time ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-gray-700 hover:border-gray-200')}>
                  {s.time}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {guest && !session?.user && (
        <div className="mb-4 space-y-3 rounded-2xl bg-surface-sunken p-3 animate-rise-in">
          <TextInput label="Votre prénom" value={guestName} onChange={e => setGuestName(e.target.value)} autoComplete="given-name" />
          <TextInput label="Votre téléphone" type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} autoComplete="tel" hint="Pour la confirmation et le rappel par SMS" />
        </div>
      )}

      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-center text-sm text-danger-ink">{error}</p>}

      <Button variant="dark" size="lg" fullWidth loading={submitting} disabled={!day || !time} onClick={book}>
        {session?.user || guest ? t('booking.confirm') : 'Réserver sans compte'} <ChevronRight size={16} />
      </Button>
      {!session?.user && (
        <p className="mt-3 text-center text-xs text-ink-muted">
          Déjà inscrit ? <Link href={`/auth/login?callbackUrl=/org/${orgId}`} className="font-semibold text-brand">Se connecter</Link>
        </p>
      )}
    </Card>
  )
}
