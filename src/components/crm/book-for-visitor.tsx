'use client'

import { useEffect, useState } from 'react'
import { getReceptionBoard } from '@/server/actions/reception'
import { createAppointmentByReception, getAvailableSlots, getBookingDays } from '@/server/actions/appointments'
import { Button, Dialog, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Rendez-vous pris par l'équipe pour un visiteur de la fiche (au téléphone, au comptoir). */
export function BookForVisitor({ open, onClose, orgId, name, phone, onBooked }: {
  open: boolean
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

  useEffect(() => {
    if (open && services.length === 0) getReceptionBoard().then(b => b && setServices(b.services))
  }, [open, services.length])
  useEffect(() => {
    setDays([]); setDay(''); setSlots([]); setTime('')
    if (serviceId) getBookingDays(orgId, serviceId).then(d => { setDays(d); setDay(d[0] ?? '') })
  }, [orgId, serviceId])
  useEffect(() => {
    setSlots([]); setTime('')
    if (serviceId && day) getAvailableSlots(orgId, serviceId, day).then(setSlots)
  }, [orgId, serviceId, day])

  const book = async () => {
    setBusy(true)
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
        <Button fullWidth loading={busy} disabled={!time} onClick={book}>Confirmer le rendez-vous</Button>
        <p className="text-center text-xs text-ink-subtle">Le visiteur reçoit son code d’arrivée par SMS au {phone}.</p>
      </div>
    </Dialog>
  )
}
