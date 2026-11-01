'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Calendar, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import { createAppointment, getAvailableSlots, getBookingDays } from '@/server/actions/appointments'
import { Button, Card } from '@/components/ui'
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
  const [success, setSuccess] = useState(false)
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
    if (!session?.user) {
      router.push(`/auth/login?callbackUrl=/org/${orgId}`)
      return
    }
    haptics.tap()
    setSubmitting(true)
    setError(null)
    const res = await createAppointment(orgId, serviceId, new Date(`${day}T${time}:00Z`))
    if (res.success) {
      haptics.success()
      setSuccess(true)
      setTimeout(() => router.push('/tickets'), 1800)
      return
    }
    setError(res.error ?? t('errors.generic.title'))
    setSubmitting(false)
    // Le créneau a pu être pris entre-temps : on rafraîchit la liste
    getAvailableSlots(orgId, serviceId, day).then(setSlots)
  }

  if (success) {
    return (
      <Card className="mb-4 p-6 text-center animate-pop-in">
        <CheckCircle2 size={48} className="mx-auto mb-3 text-success" />
        <h3 className="mb-1 text-lg font-bold text-ink">{t('booking.confirmed')}</h3>
        <p className="text-sm text-ink-muted">{t('booking.confirmedText', { org: orgName })}</p>
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

      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-center text-sm text-danger-ink">{error}</p>}

      <Button variant="dark" size="lg" fullWidth loading={submitting} disabled={!day || !time} onClick={book}>
        {session?.user ? t('booking.confirm') : t('booking.loginToBook')} <ChevronRight size={16} />
      </Button>
      {!session?.user && (
        <p className="mt-3 text-center text-xs text-ink-muted">
          {t('booking.accountNeeded')} <Link href="/auth/register" className="font-semibold text-brand">{t('tickets.createAccount')}</Link>
        </p>
      )}
    </Card>
  )
}
