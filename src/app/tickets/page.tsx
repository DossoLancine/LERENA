'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CalendarDays, ChevronRight, RotateCcw, Ticket, LogIn } from 'lucide-react'
import { getUserTickets } from '@/server/actions/tickets'
import { getGuestTickets } from '@/server/actions/guest'
import { cancelMyAppointment, getMyAppointments } from '@/server/actions/me'
import { getGuestTicketIds } from '@/lib/guest-tickets'
import { Card, EmptyState, TicketStatusBadge, Button, useToast } from '@/components/ui'
import { ListPageSkeleton } from '@/components/ui/skeletons'
import { ACTIVE_TICKET_STATUSES } from '@/lib/constants'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'

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

  if (tickets === null) return <ListPageSkeleton />

  const active = tickets.filter(tk => (ACTIVE_TICKET_STATUSES as string[]).includes(tk.status))
  const history = tickets.filter(tk => !(ACTIVE_TICKET_STATUSES as string[]).includes(tk.status))

  const cancel = async (id: string) => {
    haptics.tap()
    setAppointments(a => a.filter(x => x.id !== id))
    const res = await cancelMyAppointment(id)
    toast(res.success ? t('tickets.appointmentCancelled') : ('error' in res && res.error) || t('errors.generic.title'), res.success ? 'success' : 'error')
    if (!res.success) load()
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <header className="border-b border-surface-line bg-white">
        <div className="mx-auto max-w-lg px-4 py-5">
          <h1 className="text-2xl font-bold text-ink">{t('tickets.title')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('tickets.subtitle')}</p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        {/* En cours */}
        <section aria-labelledby="active-title">
          <h2 id="active-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('tickets.active')}</h2>
          {active.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Ticket size={32} />}
                title={t('tickets.noActive')}
                action={<Link href="/explore" className="btn-primary text-sm">{t('landing.find')}</Link>}
              />
            </Card>
          ) : (
            <ul className="stagger space-y-3">
              {active.map(tk => (
                <li key={tk.id} className="animate-rise-in">
                  <Link href={`/ticket/${tk.id}`} className="pressable block rounded-card border-2 border-brand-200 bg-white p-4 shadow-card">
                    <div className="mb-2 flex items-center justify-between">
                      <TicketStatusBadge status={tk.status} />
                      <ChevronRight size={18} className="text-ink-subtle" />
                    </div>
                    <p className="text-3xl font-black text-ink">{tk.displayNum}</p>
                    <p className="mt-1 text-sm text-ink-muted">{tk.orgName} · {tk.service?.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Rendez-vous à venir */}
        {appointments.length > 0 && (
          <section aria-labelledby="appt-title">
            <h2 id="appt-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('tickets.appointments')}</h2>
            <ul className="stagger space-y-3">
              {appointments.map(a => (
                <li key={a.id}>
                  <Card className="flex items-center gap-3 p-4">
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-info-soft text-info-ink">
                      <CalendarDays size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{a.organization.name}</p>
                      <p className="text-sm text-ink-muted">
                        {new Date(a.scheduledDate).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {a.service && <p className="text-xs text-ink-subtle">{a.service.name}</p>}
                      {a.code && <p className="mt-1 text-xs text-ink-muted">Code d’arrivée : <span className="font-mono font-bold tracking-widest text-ink">{a.code}</span></p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cancel(a.id)} className="text-danger">{t('common.cancel')}</Button>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Historique */}
        <section aria-labelledby="history-title">
          <h2 id="history-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{t('tickets.history')}</h2>
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('tickets.noHistory')}</p>
          ) : (
            <ul className="space-y-2">
              {history.map(tk => (
                <li key={tk.id}>
                  <Card className="flex items-center gap-3 p-3">
                    <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">{tk.displayNum}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{tk.orgName}</p>
                      <p className="text-xs text-ink-muted">
                        {tk.service?.name} · {new Date(tk.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <TicketStatusBadge status={tk.status} />
                    <Link href={`/org/${tk.orgId}`} aria-label={t('tickets.again', { org: tk.orgName })} title={t('tickets.again', { org: tk.orgName })}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <RotateCcw size={16} />
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        {sessionStatus === 'unauthenticated' && (
          <Card className="p-5 text-center">
            <p className="font-semibold text-ink">{t('tickets.guestTitle')}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('tickets.guestText')}</p>
            <Link href="/auth/register" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm"><LogIn size={16} />{t('tickets.createAccount')}</Link>
          </Card>
        )}
      </main>
    </div>
  )
}
