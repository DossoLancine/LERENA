'use client'

import { useEffect, useState } from 'react'
import { getReceptionBoard } from '@/server/actions/reception'
import { createAppointmentByReception, getAvailableSlots, getBookingDays } from '@/server/actions/appointments'
import { bookSeriesForCustomer, type Recurrence } from '@/server/actions/customers'
import { Button, Dialog, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Rendez-vous pris par l'équipe pour un visiteur de la fiche (au téléphone, au comptoir). */
const REPEAT: { id: Recurrence | 'ONCE'; label: string }[] = [
  { id: 'ONCE', label: 'Une fois' }, { id: 'WEEK', label: 'Chaque semaine' }, { id: 'TWO_WEEKS', label: 'Toutes les 2 semaines' }, { id: 'MONTH', label: 'Chaque mois' }
]

export function BookForVisitor({ open, onClose, orgId, customerId, name, phone, onBooked }: {
  open: boolean
  customerId: string
  onClose: () => void
  orgId: string
  name: string
  phone: string
  onBooked: () => void
}) {
  const toast = useToast()
  const [services, setServices] = useState<{ id: string; name: string }[]>([])
  const [serviceId, setServiceId] = useState('')
  const [days, setDays] = useState<string[]>([])
  const [day, setDay] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([])
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [repeat, setRepeat] = useState<Recurrence | 'ONCE'>('ONCE')
  const [count, setCount] = useState(6)
  const [skipped, setSkipped] = useState<{ date: string; reason: string }[]>([])

  useEffect(() => {
    if (open && services.length === 0) getReceptionBoard().then(b => b && setServices(b.services))
  }, [open, services.length])
  useEffect(() => {
    setDays([]); setDay(''); setSlots([]); setTime('')
    if (serviceId) getBookingDays(orgId, serviceId).then(d => { setDays(d); setDay(d[0] ?? '') })
  }, [orgId, serviceId])
  useEffect(() => { if (open) { setSkipped([]); setRepeat('ONCE') } }, [open])
  useEffect(() => {
    setSlots([]); setTime('')
    if (serviceId && day) getAvailableSlots(orgId, serviceId, day).then(setSlots)
  }, [orgId, serviceId, day])

  const book = async () => {
    setBusy(true)
    if (repeat !== 'ONCE') {
      const res = await bookSeriesForCustomer(customerId, { serviceId, first: `${day}T${time}:00Z`, every: repeat, count })
      setBusy(false)
      if (!res.success) return toast(res.error, 'error')
      toast(`${res.booked.length} rendez-vous réservés, confirmation envoyée par SMS`, 'success')
      onBooked()
      if (res.skipped.length) return setSkipped(res.skipped)
      return onClose()
    }
    const res = await createAppointmentByReception({ serviceId, scheduledDate: new Date(`${day}T${time}:00Z`), name, phone })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast(`Rendez-vous confirmé, code ${res.appointment.code} envoyé par SMS`, 'success')
    onBooked()
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Rendez-vous pour ${name}`}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Service</p>
          <div className="flex flex-wrap gap-2">
            {services.map(s => (
              <button key={s.id} onClick={() => setServiceId(s.id)} aria-pressed={serviceId === s.id}
                className={cn('rounded-xl border px-3 py-2 text-sm font-semibold', serviceId === s.id ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted hover:text-ink')}>
                {s.name}
              </button>
            ))}
            {services.length === 0 && <span className="text-sm text-ink-subtle">Chargement…</span>}
          </div>
        </div>
        {serviceId && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Jour</p>
            {days.length === 0 ? <p className="text-sm text-ink-subtle">Ce service ne prend pas de rendez-vous pour le moment.</p> : (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {days.slice(0, 21).map(d => (
                  <button key={d} onClick={() => setDay(d)} aria-pressed={day === d}
                    className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold capitalize', day === d ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted')}>
                    {dayLabel(d)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {day && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Heure</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slots.map(s => (
                <button key={s.time} disabled={!s.available} onClick={() => setTime(s.time)} aria-pressed={time === s.time}
                  className={cn('rounded-lg border py-2 text-sm font-semibold tabular-nums disabled:cursor-not-allowed disabled:opacity-35 disabled:line-through',
                    time === s.time ? 'border-brand bg-brand text-white' : 'border-surface-line text-ink')}>
                  {s.time}
                </button>
              ))}
            </div>
          </div>
        )}
        {time && (
          <div className="rounded-2xl bg-surface-sunken p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Répéter</p>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT.map(r => (
                <button key={r.id} onClick={() => setRepeat(r.id)} aria-pressed={repeat === r.id}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', repeat === r.id ? 'border-ink bg-ink text-white' : 'border-surface-line bg-white text-ink-muted')}>{r.label}</button>
              ))}
            </div>
            {repeat !== 'ONCE' && (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                <input type="number" min={2} max={24} value={count} onChange={e => setCount(Number(e.target.value))} className="h-9 w-16 rounded-lg border border-gray-200 px-2 text-center tabular-nums" />
                rendez-vous à {time}, à partir du {dayLabel(day)}
              </label>
            )}
          </div>
        )}
        {skipped.length > 0 && (
          <div role="status" className="rounded-2xl bg-warning-soft p-3 text-sm text-warning-ink">
            <p className="font-semibold">Non réservés ({skipped.length}) :</p>
            <ul className="mt-1 space-y-0.5 text-xs">{skipped.map(s => <li key={s.date}>{dayLabel(s.date.slice(0, 10))} : {s.reason}</li>)}</ul>
          </div>
        )}
        <Button fullWidth loading={busy} disabled={!time} onClick={book}>{repeat === 'ONCE' ? 'Confirmer le rendez-vous' : `Réserver les ${count} rendez-vous`}</Button>
        <p className="text-center text-xs text-ink-subtle">Le visiteur reçoit son code d’arrivée par SMS au {phone}.</p>
      </div>
    </Dialog>
  )
}
