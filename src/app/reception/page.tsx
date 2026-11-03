'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import QRCode from 'qrcode'
import Link from 'next/link'
import { Printer, Plus, LogOut, Users, Clock, ChevronDown, Accessibility, Siren, UserRound, Contact } from 'lucide-react'
import { TagChip } from '@/components/crm/parts'
import { getReceptionBoard, getRecentTickets, issueReceptionTicket, setTicketPriority } from '@/server/actions/reception'
import { Button, TextInput, TicketStatusBadge, useToast } from '@/components/ui'
import PhoneInput from '@/components/ui/phone-input'
import { DashboardSkeleton } from '@/components/ui/skeletons'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { SiteSwitcher } from '@/components/sites/site-switcher'
import { TodayAppointments } from '@/components/booking/today-appointments'
import { t, type MessageKey } from '@/lib/i18n'

type Board = NonNullable<Awaited<ReturnType<typeof getReceptionBoard>>>
type Recent = Awaited<ReturnType<typeof getRecentTickets>>
type Issued = Extract<Awaited<ReturnType<typeof issueReceptionTicket>>, { success: true }>['ticket']


// Délai avant de revenir à l'écran d'émission après un ticket
const AUTO_RESET_MS = 25_000

export default function ReceptionPage() {
  const { data: session } = useSession()
  const toast = useToast()
  const [board, setBoard] = useState<Board | null>(null)
  const [recent, setRecent] = useState<Recent>([])
  // Motif de priorité choisi (null = sans priorité) parmi ceux définis par l'établissement
  const [priorityId, setPriorityId] = useState<string | null>(null)
  const [showContact, setShowContact] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busyService, setBusyService] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [qr, setQr] = useState('')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async () => {
    const [b, r] = await Promise.all([getReceptionBoard(), getRecentTickets()])
    if (b) setBoard(b)
    setRecent(r)
  }, [])

  const live = useOrgRealtime(board?.org.id, load)
  usePolling(load, live ? 30000 : 5000)

  const reset = useCallback(() => {
    clearTimeout(resetTimer.current)
    setIssued(null)
    setPriorityId(null)
    setName('')
    setPhone('')
    setShowContact(false)
  }, [])

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  const issue = async (serviceId: string) => {
    if (busyService) return
    haptics.tap()
    setBusyService(serviceId)
    const res = await issueReceptionTicket({ serviceId, priorityId, name: name || undefined, phone: phone || undefined })
    setBusyService(null)
    if (!res.success) return toast(res.error, 'error')

    haptics.success()
    setIssued(res.ticket)
    setQr(await QRCode.toDataURL(`${window.location.origin}/ticket/${res.ticket.id}`, { width: 240, margin: 1 }))
    resetTimer.current = setTimeout(reset, AUTO_RESET_MS)
    load()
  }

  const changePriority = async (ticketId: string, value: string | null) => {
    const res = await setTicketPriority(ticketId, value)
    toast(res.success ? t('reception.priorityChanged') : t('agent.actionFailed'), res.success ? 'success' : 'error')
    load()
  }

  if (!board) return <DashboardSkeleton />

  // Le service le moins chargé est mis en avant pour orienter les personnes
  const quietest = board.services.reduce<string | null>((best, s) => {
    const b = board.services.find(x => x.id === best)
    return !b || s.waitMin < b.waitMin ? s.id : best
  }, null)

  return (
    <div className="min-h-screen bg-surface-sunken">
      {/* Ticket imprimable (seul élément visible à l'impression, format ticket 80 mm) */}
      {issued && (
        <div id="print-ticket" className="hidden print:block">
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{issued.orgName}</p>
          <p style={{ fontSize: 48, fontWeight: 900, textAlign: 'center', margin: '8px 0' }}>{issued.displayNum}</p>
          <p style={{ fontSize: 13, textAlign: 'center' }}>{issued.serviceName}</p>
          <p style={{ fontSize: 12, textAlign: 'center', margin: '6px 0' }}>
            {t('reception.aheadPrint', { count: issued.ahead })} · ~{issued.waitMin} min
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="" style={{ width: 140, height: 140, display: 'block', margin: '8px auto' }} />}
          <p style={{ fontSize: 11, textAlign: 'center' }}>{t('reception.scanToFollow')}</p>
          <p style={{ fontSize: 10, textAlign: 'center', marginTop: 6 }}>{new Date(issued.issuedAt).toLocaleString('fr-FR')}</p>
        </div>
      )}

      <div className="mx-auto max-w-6xl p-4 print:hidden">
        <header className="mb-4 flex items-center justify-between rounded-card border border-surface-line bg-white px-5 py-3 shadow-card">
          <div>
            <p className="text-xs text-ink-muted">{t('reception.title')} · {session?.user?.name}</p>
            <h1 className="text-lg font-bold text-ink">{board.org.name}</h1>
            <SiteSwitcher allowAll={false} className="mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', live ? 'text-success' : 'text-ink-subtle')}>
              <span className={cn('h-2 w-2 rounded-full', live ? 'bg-success animate-pulse' : 'bg-gray-400')} />
              {live ? t('reception.live') : t('reception.offline')}
            </span>
            <Link href="/reception/visitors" className="inline-flex items-center gap-1.5 rounded-xl border border-surface-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand">
              <Contact size={15} /> Visiteurs
            </Link>
            <Button variant="ghost" size="sm" icon={<LogOut size={15} />} onClick={() => signOut({ callbackUrl: '/pro/login' })}>{t('common.logout')}</Button>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <main className="space-y-4">
            {issued ? (
              /* Ticket émis : grand affichage, impression, retour automatique */
              <section className="rounded-card border border-surface-line bg-white p-8 text-center shadow-card animate-pop-in" aria-live="assertive">
                <p className="text-sm font-semibold uppercase tracking-wider text-ink-muted">{issued.serviceName}</p>
                <p className="my-3 text-8xl font-black tracking-tight text-ink">{issued.displayNum}</p>
                <p className="text-ink-muted">{t('reception.ahead', { count: issued.ahead, minutes: issued.waitMin })}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr && <img src={qr} alt={t('reception.scanToFollow')} className="mx-auto my-5 h-40 w-40" />}
                <div className="mx-auto flex max-w-md gap-3">
                  <Button size="lg" fullWidth icon={<Printer size={20} />} onClick={() => window.print()}>{t('reception.print')}</Button>
                  <Button size="lg" variant="secondary" fullWidth icon={<Plus size={20} />} onClick={reset}>{t('reception.next')}</Button>
                </div>
              </section>
            ) : (
              <>
                {/* 1. Priorité */}
                <section className="rounded-card border border-surface-line bg-white p-4 shadow-card">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">1. {t('reception.priority')}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t('reception.priority')}>
                    {[{ id: null as string | null, label: t('reception.prioStandard'), level: 1 }, ...board.priorities].map(p => {
                      const selected = priorityId === p.id
                      return (
                        <button key={p.id ?? 'none'} role="radio" aria-checked={selected} onClick={() => { haptics.tap(); setPriorityId(p.id) }}
                          className={cn('flex min-h-touch items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm font-bold transition-all',
                            selected
                              ? p.level >= 3 ? 'border-danger bg-danger-soft text-danger-ink' : p.level === 2 ? 'border-info bg-info-soft text-info-ink' : 'border-brand bg-brand-50 text-brand-700'
                              : 'border-surface-line text-ink-muted')}>
                          {p.level >= 3 ? <Siren size={18} /> : p.level === 2 ? <Accessibility size={18} /> : <UserRound size={18} />} {p.label}
                        </button>
                      )
                    })}
                  </div>
                  <button onClick={() => setShowContact(v => !v)} className="mt-3 flex items-center gap-1 text-sm font-medium text-ink-muted">
                    <ChevronDown size={16} className={cn('transition-transform', showContact && 'rotate-180')} /> {t('reception.addContact')}
                  </button>
                  {showContact && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 animate-rise-in">
                      <TextInput label={t('guest.firstName')} value={name} onChange={e => setName(e.target.value)} />
                      <div className="space-y-1.5">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('guest.phone')}</span>
                        <PhoneInput value={phone} onChange={setPhone} />
                      </div>
                    </div>
                  )}
                </section>

                {/* 2. Service : un appui émet le ticket */}
                <section>
                  <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">2. {t('reception.service')}</p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {board.services.map(s => (
                      <button key={s.id} onClick={() => issue(s.id)} disabled={!!busyService}
                        className={cn('relative flex min-h-[120px] flex-col justify-between rounded-card border-2 bg-white p-5 text-left shadow-card transition-all hover:border-brand disabled:opacity-60',
                          s.id === quietest && board.services.length > 1 ? 'border-green-300' : 'border-surface-line')}>
                        {s.id === quietest && board.services.length > 1 && (
                          <span className="absolute right-3 top-3 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success-ink">{t('reception.quietest')}</span>
                        )}
                        <span className="pr-16 text-lg font-bold text-ink">{s.name}</span>
                        <span className="mt-3 flex items-center gap-4 text-sm text-ink-muted">
                          <span className="flex items-center gap-1"><Users size={14} />{s.waiting}</span>
                          <span className="flex items-center gap-1"><Clock size={14} />~{s.waitMin} min</span>
                        </span>
                        {busyService === s.id && <span className="absolute inset-0 animate-pulse rounded-card bg-white/60" />}
                      </button>
                    ))}
                  </div>
                </section>
              </>
            )}
          </main>

          <div className="space-y-4">
          {/* Rendez-vous du jour : arrivée → ticket placé à l'heure du rendez-vous */}
          <TodayAppointments onIssued={() => load()} />
          {/* Derniers tickets : retrouver et corriger une priorité */}
          <aside className="rounded-card border border-surface-line bg-white shadow-card">
            <p className="border-b border-surface-line px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">{t('reception.recent')}</p>
            <ul className="max-h-[70vh] divide-y divide-surface-line overflow-y-auto">
              {recent.length === 0 && <li className="p-6 text-center text-sm text-ink-subtle">{t('reception.noRecent')}</li>}
              {recent.map(tk => (
                <li key={tk.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm"><span className="font-mono font-bold text-ink">{tk.displayNum}</span> <span className="text-ink-muted">{tk.guestName || tk.user?.name}</span></p>
                    <p className="truncate text-xs text-ink-subtle">{tk.service.name} · {new Date(tk.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                    {tk.customer && tk.customer.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">{tk.customer.tags.map(l => <TagChip key={l.tag.id} tag={l.tag} small />)}</p>
                    )}
                  </div>
                  {tk.status === 'WAITING' ? (
                    <select aria-label={t('reception.priority')} value={board.priorities.find(p => p.label === tk.priorityReason)?.id ?? ''}
                      onChange={e => changePriority(tk.id, e.target.value || null)}
                      className="max-w-[150px] rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs">
                      <option value="">{t('reception.prioStandard')}</option>
                      {board.priorities.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  ) : (
                    <TicketStatusBadge status={tk.status} />
                  )}
                </li>
              ))}
            </ul>
          </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
