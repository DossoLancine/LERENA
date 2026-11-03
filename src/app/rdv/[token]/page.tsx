'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, MapPin, Clock, CalendarPlus, XCircle, RefreshCw } from 'lucide-react'
import { cancelAppointmentByToken, getAppointmentByToken, getAvailableSlots, getBookingDays, rescheduleAppointmentByToken } from '@/server/actions/appointments'
import { Badge, Button, Card, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { ShopPanel } from '@/components/shop/shop-panel'

type Appt = NonNullable<Awaited<ReturnType<typeof getAppointmentByToken>>>
const STATUS: Record<string, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  CONFIRMED: { label: 'Confirmé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
  NO_SHOW: { label: 'Absent', tone: 'danger' },
  COMPLETED: { label: 'Terminé', tone: 'neutral' }
}

/** Gestion d'un rendez-vous depuis le lien reçu : voir, reporter, annuler, ajouter à l'agenda. */
export default function ManageAppointmentPage({ params }: { params: { token: string } }) {
  const toast = useToast()
  const [appt, setAppt] = useState<Appt | null | undefined>(undefined)
  const [moving, setMoving] = useState(false)
  const [days, setDays] = useState<string[]>([])
  const [day, setDay] = useState('')
  const [slots, setSlots] = useState<{ time: string; available: boolean }[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => getAppointmentByToken(params.token).then(setAppt), [params.token])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (moving && appt?.serviceId) getBookingDays(appt.orgId, appt.serviceId).then(setDays)
  }, [moving, appt])
  useEffect(() => {
    if (day && appt?.serviceId) getAvailableSlots(appt.orgId, appt.serviceId, day).then(setSlots)
  }, [day, appt])

  if (appt === undefined) return <main className="min-h-screen bg-surface-sunken p-6"><div className="mx-auto h-64 max-w-md rounded-card shimmer" /></main>
  if (appt === null) {
    return <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-6 text-center"><p className="text-ink-muted">Ce lien de rendez-vous n’est pas valable.</p></main>
  }

  const when = new Date(appt.scheduledDate)
  const status = STATUS[appt.status] ?? { label: appt.status, tone: 'neutral' as const }

  const cancel = async () => {
    if (!confirm('Annuler ce rendez-vous ?')) return
    setBusy(true)
    const res = await cancelAppointmentByToken(params.token)
    setBusy(false)
    if (!res.success) return toast(res.error ?? 'Annulation impossible', 'error')
    toast('Rendez-vous annulé')
    load()
  }

  const move = async (time: string) => {
    setBusy(true)
    const res = await rescheduleAppointmentByToken(params.token, new Date(`${day}T${time}:00Z`))
    setBusy(false)
    if (!res.success) return toast(res.error ?? 'Report impossible', 'error')
    toast('Rendez-vous déplacé')
    setMoving(false)
    setDay('')
    load()
  }

  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-8">
      <div className="mx-auto max-w-md space-y-4 animate-rise-in">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Rendez-vous</p>
              <h1 className="text-xl font-bold text-ink">{appt.orgName}</h1>
              <p className="text-sm text-ink-muted">{appt.serviceName}</p>
            </div>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            <li className="flex items-center gap-2"><CalendarDays size={16} className="text-brand" aria-hidden="true" />{when.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}</li>
            <li className="flex items-center gap-2"><Clock size={16} className="text-brand" aria-hidden="true" />{when.toISOString().slice(11, 16)}</li>
            <li className="flex items-center gap-2"><MapPin size={16} className="text-brand" aria-hidden="true" />{appt.siteName}{appt.address ? ` — ${appt.address}` : ''}</li>
          </ul>
          {appt.status === 'CONFIRMED' && appt.code && (
            <div className="mt-5 rounded-2xl bg-surface-sunken p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Code d’arrivée</p>
              <p className="text-4xl font-black tracking-[0.3em] text-ink">{appt.code}</p>
              <p className="mt-1 text-xs text-ink-muted">À l’accueil ou sur la borne en arrivant.</p>
            </div>
          )}
        </Card>

        <ShopPanel source={{ token: params.token }} refreshKey={appt.status} />

        {appt.status === 'CONFIRMED' && (
          <Card className="space-y-3 p-5">
            <a href={`/api/rdv/${params.token}/ics`} className="flex min-h-touch items-center justify-center gap-2 rounded-control border border-gray-200 text-sm font-semibold text-ink">
              <CalendarPlus size={16} aria-hidden="true" /> Ajouter à mon agenda
            </a>
            {appt.canModify ? (
              <>
                <Button variant="secondary" fullWidth icon={<RefreshCw size={16} />} onClick={() => setMoving(m => !m)}>Changer de créneau</Button>
                {moving && (
                  <div className="space-y-3 animate-rise-in">
                    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Jour">
                      {days.map(d => (
                        <button key={d} role="radio" aria-checked={day === d} onClick={() => setDay(d)}
                          className={cn('min-w-[64px] rounded-xl border-2 p-2 text-sm font-semibold', day === d ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted')}>
                          {new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}
                        </button>
                      ))}
                    </div>
                    {day && (
                      <div className="grid grid-cols-4 gap-2">
                        {slots.filter(s => s.available).map(s => (
                          <button key={s.time} disabled={busy} onClick={() => move(s.time)} className="min-h-[44px] rounded-lg border-2 border-surface-line text-sm font-semibold text-ink hover:border-brand">{s.time}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="ghost" fullWidth icon={<XCircle size={16} />} loading={busy} onClick={cancel} className="text-danger">Annuler le rendez-vous</Button>
              </>
            ) : (
              <p className="text-center text-xs text-ink-muted">Report et annulation en ligne possibles jusqu’à {appt.cancelHours} h avant. Au-delà, contactez l’établissement.</p>
            )}
          </Card>
        )}
      </div>
    </main>
  )
}
