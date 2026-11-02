'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, Compass, LogIn, RotateCcw, Ticket } from 'lucide-react'
import { getUserTickets } from '@/server/actions/tickets'
import { getGuestTickets } from '@/server/actions/guest'
import { cancelMyAppointment, getMyAppointments } from '@/server/actions/me'
import { getGuestTicketIds } from '@/lib/guest-tickets'
import { useToast } from '@/components/ui'
import { ListPageSkeleton } from '@/components/ui/skeletons'
import { ACTIVE_TICKET_STATUSES } from '@/lib/constants'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/cn'

interface TicketRow {
  id: string
  displayNum: string
  status: string
  createdAt: Date
  service: { name: string } | null
  orgId: string
  orgName: string
}

type Appointment = Awaited<ReturnType<typeof getMyAppointments>>[number]

const PILL: Record<string, [string, string]> = {
  WAITING: ['En file', 'bg-amber-100 text-amber-800'],
  CALLED: ['Appelé', 'bg-brand text-white'],
  SERVING: ['Au guichet', 'bg-info-soft text-info-ink'],
  ON_HOLD: ['En pause', 'bg-gray-100 text-ink-muted'],
  COMPLETED: ['Servi', 'bg-success-soft text-success-ink'],
  CANCELLED: ['Annulé', 'bg-gray-100 text-ink-muted'],
  ABSENT: ['Absent', 'bg-danger-soft text-danger-ink']
}
const Pill = ({ status }: { status: string }) => {
  const [label, cls] = PILL[status] ?? [status, 'bg-gray-100 text-ink-muted']
  return <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold', cls)}>{label}</span>
}

const dayLabel = (d: Date) => {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day) / 86400_000)
  return diff === 0 ? 'Aujourd’hui' : diff === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Compte à rebours lisible jusqu'à un rendez-vous. */
const countdown = (iso: string | Date) => {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms < 0) return 'maintenant'
  const h = Math.round(ms / 3600_000)
  if (h < 1) return `dans ${Math.max(1, Math.round(ms / 60_000))} min`
  if (h < 24) return `dans ${h} h`
  return `dans ${Math.round(h / 24)} j`
}

/** Mes tickets : en cours (tickets à encoches), rendez-vous à venir, historique par jour. */
export default function TicketsPage() {
  const { status: sessionStatus } = useSession()
  const toast = useToast()
  const [tickets, setTickets] = useState<TicketRow[] | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const load = useCallback(async () => {
    const loggedIn = sessionStatus === 'authenticated'
    const [mine, guests, appts] = await Promise.all([
      loggedIn ? getUserTickets() : Promise.resolve([]),
      getGuestTickets(getGuestTicketIds()),
      loggedIn ? getMyAppointments() : Promise.resolve([])
    ])
    const rows: TicketRow[] = [
      ...mine.map(tk => ({ id: tk.id, displayNum: tk.displayNum, status: tk.status, createdAt: tk.createdAt, service: tk.service, orgId: tk.queue.branch.organization.id, orgName: tk.queue.branch.organization.name })),
      ...guests.map(tk => ({ id: tk.id, displayNum: tk.displayNum, status: tk.status, createdAt: tk.createdAt, service: tk.service, orgId: tk.queue.branch.organization.id, orgName: tk.queue.branch.organization.name }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setTickets(rows)
    setAppointments(appts)
  }, [sessionStatus])

  useEffect(() => {
    if (sessionStatus !== 'loading') load()
  }, [sessionStatus, load])

  const groups = useMemo(() => {
    const history = (tickets ?? []).filter(tk => !(ACTIVE_TICKET_STATUSES as string[]).includes(tk.status))
    const map = new Map<string, TicketRow[]>()
    for (const tk of history) {
      const key = dayLabel(new Date(tk.createdAt))
      map.set(key, [...(map.get(key) ?? []), tk])
    }
    return Array.from(map.entries())
  }, [tickets])

  if (tickets === null) return <ListPageSkeleton />
  const active = tickets.filter(tk => (ACTIVE_TICKET_STATUSES as string[]).includes(tk.status))

  const cancel = async (id: string) => {
    haptics.tap()
    setAppointments(a => a.filter(x => x.id !== id))
    const res = await cancelMyAppointment(id)
    toast(res.success ? t('tickets.appointmentCancelled') : ('error' in res && res.error) || t('errors.generic.title'), res.success ? 'success' : 'error')
    if (!res.success) load()
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-28">
      <header className="bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] to-surface-sunken">
        <div className="mx-auto max-w-lg px-5 pb-3 pt-7">
          <h1 className="font-display text-[30px] font-extrabold tracking-tight text-ink">Mes tickets</h1>
          <p className="text-sm text-ink-muted">{active.length ? `${active.length} en cours · ` : ''}{appointments.length ? `${appointments.length} rendez-vous à venir` : 'Vos passages récents'}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-7 px-5 pt-2">
        {/* En cours : tickets à encoches */}
        {active.length > 0 && (
          <section aria-label="En cours" className="stagger space-y-3">
            {active.map(tk => (
              <Link key={tk.id} href={`/ticket/${tk.id}`} className="ticket-shadow block transition-transform active:scale-[0.98]">
                <div className="ticket-notch flex items-stretch overflow-hidden rounded-[24px] bg-white" style={{ ['--notch-y' as string]: '50%' }}>
                  <div className="flex w-[118px] shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#fb923c] to-brand px-3 py-4 text-white">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">N°</span>
                    <span className="font-display text-[34px] font-extrabold leading-none tabular-nums">{tk.displayNum}</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 border-l-2 border-dashed border-brand/20 px-4 py-3">
                    <Pill status={tk.status} />
                    <p className="truncate font-semibold text-ink">{tk.orgName}</p>
                    <p className="truncate text-xs text-ink-subtle">{tk.service?.name}</p>
                  </div>
                  <span className="flex items-center pr-4 text-brand"><ArrowRight size={20} /></span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {/* Rendez-vous à venir */}
        {appointments.length > 0 && (
          <section aria-labelledby="appt-title">
            <h2 id="appt-title" className="mb-3 font-display text-xl font-bold text-ink">Rendez-vous</h2>
            <ul className="stagger space-y-3">
              {appointments.map(a => {
                const d = new Date(a.scheduledDate)
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-[22px] bg-white p-3 shadow-card ring-1 ring-black/[0.03]">
                    <span className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-info-soft text-info-ink">
                      <span className="text-[10px] font-bold uppercase">{d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
                      <span className="font-display text-2xl font-extrabold leading-none">{d.getDate()}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{a.organization.name}</p>
                      <p className="text-xs text-ink-muted">{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{a.service ? ` · ${a.service.name}` : ''} · <span className="font-semibold text-info-ink">{countdown(a.scheduledDate)}</span></p>
                      {a.code && <p className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-0.5 text-xs text-ink-muted">Code d’arrivée <span className="font-mono font-bold tracking-widest text-ink">{a.code}</span></p>}
                    </div>
                    <button type="button" onClick={() => cancel(a.id)} className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-subtle hover:bg-danger-soft hover:text-danger">Annuler</button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Rien en cours : invitation à agir */}
        {active.length === 0 && (
          <section className="flex flex-col items-center rounded-[26px] bg-white px-6 py-8 text-center shadow-card ring-1 ring-black/[0.03]">
            <div className="ticket-shadow">
              <div className="ticket-notch flex h-20 w-32 -rotate-6 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-white text-brand" style={{ ['--notch-y' as string]: '50%' }}>
                <Ticket size={34} />
              </div>
            </div>
            <p className="mt-5 font-display text-xl font-bold text-ink">Aucun ticket en cours</p>
            <p className="mt-1 text-sm text-ink-muted">Trouvez un établissement et prenez votre place sans faire la queue.</p>
            <Link href="/explore" className="pressable mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#fb923c] to-brand px-5 py-3 text-sm font-bold text-white shadow-md"><Compass size={17} /> Explorer</Link>
          </section>
        )}

        {/* Historique, jour par jour */}
        {groups.length > 0 && (
          <section aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 font-display text-xl font-bold text-ink">Historique</h2>
            <div className="space-y-5">
              {groups.map(([day, rows]) => (
                <div key={day}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle first-letter:uppercase">{day}</p>
                  <ol className="relative space-y-2 border-l-2 border-dashed border-brand/20 pl-4">
                    {rows.map(tk => (
                      <li key={tk.id} className="relative">
                        <span className="absolute -left-[23px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-brand/40" aria-hidden="true" />
                        <div className="flex items-center gap-3 rounded-[18px] bg-white p-2.5 shadow-card ring-1 ring-black/[0.03]">
                          <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 font-display text-sm font-extrabold text-ink tabular-nums">{tk.displayNum}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">{tk.orgName}</p>
                            <p className="flex items-center gap-1.5 truncate text-xs text-ink-subtle">{new Date(tk.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {tk.service?.name}</p>
                          </div>
                          <Pill status={tk.status} />
                          <Link href={`/org/${tk.orgId}`} aria-label={t('tickets.again', { org: tk.orgName })} title="Reprendre un ticket"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand ring-1 ring-brand/15"><RotateCcw size={15} /></Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {sessionStatus === 'unauthenticated' && (
          <section className="flex items-center gap-3 rounded-[22px] bg-ink p-4 text-white">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10"><LogIn size={19} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Gardez vos tickets sur tous vos appareils</p>
              <p className="text-xs text-white/70">Un compte avec votre numéro, et c’est tout.</p>
            </div>
            <Link href="/auth/register" className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-bold text-ink">Créer</Link>
          </section>
        )}
      </main>
    </div>
  )
}
