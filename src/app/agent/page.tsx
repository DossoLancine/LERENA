'use client'

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  Monitor, Megaphone, Play, CheckCircle2, UserX, Pause, ArrowRightLeft, StickyNote,
  Moon, Sun, PanelLeftClose, PanelLeftOpen, User as UserIcon, LogOut, Keyboard, Clock, Users
} from 'lucide-react'
import {
  getAgentQueue, getAgentStats, getAgentCounters, updateTicketStatus,
  recallTicket, resumeTicket, transferTicket, addTicketNote
} from '@/server/actions/agent'
import UserProfileForm from '@/components/profile/user-profile-form'
import { Button, Dialog, TextArea, TextInput, Badge, useToast } from '@/components/ui'
import { DashboardSkeleton } from '@/components/ui/skeletons'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { haptics } from '@/lib/haptics'
import type { TicketStatus } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { TagChip } from '@/components/crm/parts'
import { priorityText } from '@/lib/priority-text'
import { t } from '@/lib/i18n'

type QueueTicket = Awaited<ReturnType<typeof getAgentQueue>>[number]
type CounterChoice = { id: string | null; name: string }

const COUNTER_KEY = 'attends_counter'
const UI_KEY = 'attends_agent_ui'

function elapsed(from: Date | string | null | undefined, now: number) {
  if (!from) return '00:00'
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function AgentPage() {
  const { data: session } = useSession()
  const toast = useToast()

  const [queue, setQueue] = useState<QueueTicket[]>([])
  const [stats, setStats] = useState({ servedToday: 0, avgMin: 12, orgId: null as string | null })
  const [counters, setCounters] = useState<{ id: string; name: string; serviceIds: string[]; branchId: string; siteName: string | null }[]>([])
  const [services, setServices] = useState<{ id: string; name: string; branchId: string }[]>([])
  const [counter, setCounter] = useState<CounterChoice | null>(null)
  // Guichet courant lu par le rafraîchissement (la file dépend de son site)
  const counterIdRef = useRef<string | null>(null)
  counterIdRef.current = counter?.id ?? null
  const [loading, setLoading] = useState(true)
  const [ui, setUi] = useState({ dark: false, compact: false })
  const [now, setNow] = useState(Date.now())
  const [freeName, setFreeName] = useState('')
  const [showProfile, setShowProfile] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [lastAction, setLastAction] = useState<string | null>(null)

  // Guichet et préférences d'affichage gardés sur cet ordinateur
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COUNTER_KEY)
      if (saved) setCounter(JSON.parse(saved))
      // Ancien réglage (texte libre) repris automatiquement
      const legacy = localStorage.getItem('attends_desk_name')
      if (!saved && legacy) setCounter({ id: null, name: legacy })
      const savedUi = localStorage.getItem(UI_KEY)
      if (savedUi) setUi(JSON.parse(savedUi))
    } catch {}
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const saveUi = (next: typeof ui) => {
    setUi(next)
    try { localStorage.setItem(UI_KEY, JSON.stringify(next)) } catch {}
  }

  const chooseCounter = (c: CounterChoice) => {
    haptics.tap()
    setCounter(c)
    try { localStorage.setItem(COUNTER_KEY, JSON.stringify(c)) } catch {}
  }

  const fetchAll = useCallback(async () => {
    // File du site du guichet choisi
    const [q, s, c] = await Promise.all([getAgentQueue(counterIdRef.current), getAgentStats(), getAgentCounters()])
    setQueue(q)
    if (s) setStats(s)
    setCounters(c.counters)
    setServices(c.services)
    setLoading(false)
  }, [])

  const live = useOrgRealtime(stats.orgId, fetchAll)
  usePolling(fetchAll, live ? 30000 : 5000)

  // Guichet réel correspondant (un nom saisi avec l'ancien système est relié au guichet du même nom)
  const realCounter = useMemo(
    () => counters.find(x => x.id === counter?.id) ?? counters.find(x => x.name === counter?.name) ?? null,
    [counters, counter]
  )
  // Services traités par ce guichet (aucun choisi = tous)
  const myServiceIds = realCounter && realCounter.serviceIds.length > 0 ? new Set(realCounter.serviceIds) : null

  const name = counter?.name ?? ''
  // Uniquement les tickets réellement rattachés à ce guichet (un ticket sans guichet n'appartient à personne)
  const mine = (tk: QueueTicket) => !!tk.counterName && (tk.counterId ? tk.counterId === realCounter?.id || tk.counterName === name : tk.counterName === name)
  const current = queue.find(tk => (tk.status === 'SERVING' || tk.status === 'CALLED') && mine(tk))
  const onHold = queue.filter(tk => tk.status === 'ON_HOLD' && mine(tk))
  // Un autre guichet ouvert peut-il traiter ce service ? (sinon ce guichet garde le client, même transféré par lui)
  const otherCounterServes = (serviceId: string) =>
    counters.some(c => c.id !== realCounter?.id && c.name !== name && (c.serviceIds.length === 0 || c.serviceIds.includes(serviceId)))
  const waiting = queue.filter(tk =>
    tk.status === 'WAITING' &&
    (!myServiceIds || myServiceIds.has(tk.serviceId)) &&
    // Le guichet qui vient de transférer un client ne le rappelle pas : il est laissé au service suivant
    !(tk.route.transferredBy === name && otherCounterServes(tk.serviceId))
  )

  // Action instantanée : l'écran change dès l'appui, le serveur confirme ensuite
  const act = useCallback(async (ticketId: string, status: TicketStatus, label: string) => {
    if (!counter) return
    haptics.tap()
    setQueue(q =>
      status === 'COMPLETED' || status === 'ABSENT'
        ? q.filter(tk => tk.id !== ticketId)
        : q.map(tk => (tk.id === ticketId ? { ...tk, status, counterName: status === 'CALLED' ? counter.name : tk.counterName } : tk))
    )
    setLastAction(label)
    const res = await updateTicketStatus(ticketId, status, counter.name, realCounter?.id ?? counter.id ?? undefined)
    if (res.success) {
      if (status === 'COMPLETED') {
        haptics.success()
        setStats(s => ({ ...s, servedToday: s.servedToday + 1 }))
      }
    } else {
      toast(t('agent.actionFailed'), 'error')
    }
    fetchAll()
  }, [counter, realCounter, fetchAll, toast])

  const callNext = useCallback(() => {
    if (current || waiting.length === 0) return
    const next = waiting[0]
    act(next.id, 'CALLED', `${next.displayNum} → ${name}`)
  }, [current, waiting, act, name])

  const recall = useCallback(async () => {
    if (!current || current.status !== 'CALLED') return
    haptics.tap()
    const res = await recallTicket(current.id)
    toast(res.success ? t('agent.recalled') : t('agent.actionFailed'), res.success ? 'info' : 'error')
  }, [current, toast])

  const resume = async (ticketId: string) => {
    if (current) return
    haptics.tap()
    setQueue(q => q.map(tk => (tk.id === ticketId ? { ...tk, status: 'CALLED' } : tk)))
    const res = await resumeTicket(ticketId)
    if (!res.success) toast(t('agent.actionFailed'), 'error')
    fetchAll()
  }

  const doTransfer = async (serviceId: string) => {
    if (!current) return
    haptics.tap()
    const id = current.id
    setShowTransfer(false)
    setQueue(q => q.filter(tk => tk.id !== id))
    const res = await transferTicket(id, serviceId, transferNote)
    setTransferNote('')
    toast(res.success ? t('agent.transferDone') : res.error ?? t('agent.actionFailed'), res.success ? 'success' : 'error')
    fetchAll()
  }

  const saveNote = async () => {
    if (!current || !noteText.trim()) return
    const res = await addTicketNote(current.id, noteText)
    setShowNote(false)
    setNoteText('')
    toast(res.success ? t('agent.noteSaved') : t('agent.actionFailed'), res.success ? 'success' : 'error')
    fetchAll()
  }

  // Raccourcis clavier : l'agent garde les yeux sur le client
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || showTransfer || showNote || showProfile) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === ' ' && !current) { e.preventDefault(); callNext() }
      else if (key === 'r') recall()
      else if (key === 's' && current?.status === 'CALLED') act(current.id, 'SERVING', t('agent.start'))
      else if (key === 't' && current) act(current.id, 'COMPLETED', t('agent.complete'))
      else if (key === 'a' && current) act(current.id, 'ABSENT', t('agent.absent'))
      else if (key === 'p' && current) act(current.id, 'ON_HOLD', t('agent.hold'))
      else if (key === 'x' && current) setShowTransfer(true)
      else if (key === 'n' && current) setShowNote(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, callNext, recall, act, showTransfer, showNote, showProfile])

  const dark = ui.dark
  const surface = dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-surface-line'
  const muted = dark ? 'text-gray-400' : 'text-ink-muted'
  const strong = dark ? 'text-white' : 'text-ink'

  if (loading) return <DashboardSkeleton />

  // Choix du guichet (une fois par ordinateur)
  if (!counter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-sunken p-4">
        <div className="w-full max-w-md rounded-3xl border border-surface-line bg-white p-8 shadow-card">
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-info-soft text-info"><Monitor size={30} /></span>
          <h1 className="text-center text-xl font-bold text-ink">{t('agent.pickCounter')}</h1>
          <p className="mb-6 mt-2 text-center text-sm text-ink-muted">{t('agent.pickCounterText')}</p>
          {counters.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {counters.map(c => (
                <button key={c.id} onClick={() => chooseCounter({ id: c.id, name: c.name })}
                  className="min-h-touch rounded-2xl border-2 border-surface-line p-4 font-bold text-ink transition-all hover:border-brand">
                  {c.name}
                  {c.siteName && <span className="block text-xs font-medium text-ink-muted">{c.siteName}</span>}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); if (freeName.trim()) chooseCounter({ id: null, name: freeName.trim() }) }} className="space-y-4">
              <p className="rounded-xl bg-warning-soft p-3 text-xs text-warning-ink">{t('agent.noCounters')}</p>
              <TextInput label={t('agent.counterName')} value={freeName} onChange={e => setFreeName(e.target.value)} placeholder="Guichet 1" autoFocus />
              <Button type="submit" fullWidth disabled={!freeName.trim()}>{t('agent.useCounter')}</Button>
            </form>
          )}
        </div>
      </main>
    )
  }

  // Le personnel voit le motif choisi par l'établissement (ex. « Femme enceinte »)
  const priorityBadge = (score: number, reason?: string | null) => {
    const text = priorityText(score, reason)
    return text ? <Badge tone={score >= 3 ? 'danger' : 'info'}>{text}</Badge> : null
  }

  const actionButton = ({ onClick, icon, label, shortcut, tone = 'neutral' }: {
    onClick: () => void; icon: React.ReactNode; label: string; shortcut: string; tone?: 'neutral' | 'good' | 'bad' | 'brand'
  }) => (
    <button key={label} onClick={onClick} title={`${label} (${shortcut.toUpperCase()})`}
      className={cn('flex min-h-touch flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-semibold transition-all',
        tone === 'good' && 'bg-success text-white',
        tone === 'bad' && (dark ? 'bg-red-900/40 text-red-300' : 'bg-danger-soft text-danger-ink'),
        tone === 'brand' && 'bg-brand text-white',
        tone === 'neutral' && (dark ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-700'))}>
      {icon}
      <span>{label}</span>
      <kbd className="rounded bg-black/10 px-1.5 text-[10px] font-bold uppercase">{shortcut}</kbd>
    </button>
  )

  return (
    <div className={cn('min-h-screen transition-colors', dark ? 'bg-gray-900' : 'bg-surface-sunken')}>
      <div className={cn('mx-auto px-4 py-4', ui.compact ? 'max-w-sm' : 'max-w-3xl')}>
        {/* En-tête */}
        <header className={cn('mb-4 flex items-center justify-between gap-2 rounded-card border px-4 py-3', surface)}>
          <div className="min-w-0">
            <p className={cn('truncate text-xs', muted)}>{session?.user?.name}</p>
            <button onClick={() => setCounter(null)} className={cn('flex items-center gap-1.5 text-lg font-bold', strong)}>
              <Monitor size={16} className="text-info" /> {name}
              <span className={cn('text-xs font-medium underline', muted)}>{t('agent.change')}</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('mr-1 h-2 w-2 rounded-full', live ? 'bg-success animate-pulse' : 'bg-gray-400')} aria-hidden="true" />
            <button onClick={() => saveUi({ ...ui, compact: !ui.compact })} aria-label={t('agent.compact')} title={t('agent.compact')}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full', dark ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700')}>
              {ui.compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button onClick={() => saveUi({ ...ui, dark: !ui.dark })} aria-label={t('agent.darkMode')} title={t('agent.darkMode')}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full', dark ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-gray-700')}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setShowProfile(true)} aria-label={t('dashboard.myProfile')}
              className={cn('flex h-9 w-9 items-center justify-center rounded-full', dark ? 'bg-gray-700 text-gray-200' : 'bg-info-soft text-info')}>
              <UserIcon size={16} />
            </button>
          </div>
        </header>

        {/* Chiffres */}
        {!ui.compact && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            {[
              { label: t('agent.waiting'), value: waiting.length, icon: <Users size={16} /> },
              { label: t('agent.served'), value: stats.servedToday, icon: <CheckCircle2 size={16} /> },
              { label: t('agent.avg'), value: `${stats.avgMin} min`, icon: <Clock size={16} /> },
            ].map(s => (
              <div key={s.label} className={cn('rounded-card border p-3', surface)}>
                <span className={muted}>{s.icon}</span>
                <p className={cn('mt-1 text-2xl font-black tabular-nums', strong)}>{s.value}</p>
                <p className={cn('text-xs', muted)}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Client au guichet */}
        <section className={cn('mb-4 rounded-card border p-5', surface)} aria-live="polite">
          <p className={cn('mb-3 text-xs font-semibold uppercase tracking-wider', muted)}>{t('agent.current')}</p>
          {current ? (
            <div className="animate-pop-in">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('text-5xl font-black tracking-tight', strong)}>{current.displayNum}</p>
                  <p className={cn('mt-1 truncate font-semibold', strong)}>{current.guestName || current.user?.name || '—'}</p>
                  <p className={cn('text-sm', muted)}>{current.service.name}</p>
                  {/* Où le client est déjà passé avant d'arriver ici */}
                  {current.customer && (current.customer.tags.length > 0 || current.customer.visits > 1) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1.5">
                      {current.customer.tags.map(l => <TagChip key={l.tag.id} tag={l.tag} small />)}
                      {current.customer.visits > 1 && <span className={cn('text-xs font-semibold', muted)}>{current.customer.visits}e passage</span>}
                    </p>
                  )}
                  {current.route.step > 1 && (
                    <p className={cn('mt-1 text-xs font-semibold', muted)}>Étape {current.route.step} · déjà passé : {current.route.done.join(' → ')}</p>
                  )}
                </div>
                <div className="text-right">
                  {priorityBadge(current.priorityScore, current.priorityReason)}
                  <p className={cn('mt-2 font-mono text-2xl font-bold tabular-nums', current.status === 'SERVING' ? 'text-info' : 'text-brand')}>
                    {elapsed(current.status === 'SERVING' ? current.startedAt : current.calledAt, now)}
                  </p>
                </div>
              </div>

              {current.claimedPromoTitle && (
                <p className="mt-3 rounded-xl bg-success-soft p-2.5 text-xs font-semibold text-success-ink">🎁 {current.claimedPromoTitle} · {current.claimedPromoPrice}</p>
              )}
              {current.notes && (
                <p className={cn('mt-3 whitespace-pre-line rounded-xl p-2.5 text-xs', dark ? 'bg-yellow-900/30 text-yellow-200' : 'bg-warning-soft text-warning-ink')}>
                  <StickyNote size={12} className="mr-1 inline" />{current.notes}
                </p>
              )}

              <div className={cn('mt-4 grid gap-2', ui.compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6')}>
                {current.status === 'CALLED'
                  ? [
                      actionButton({ onClick: () => act(current.id, 'SERVING', t('agent.start')), icon: <Play size={18} />, label: t('agent.start'), shortcut: 's', tone: 'brand' }),
                      actionButton({ onClick: recall, icon: <Megaphone size={18} />, label: t('agent.recall'), shortcut: 'r' }),
                    ]
                  : actionButton({ onClick: () => act(current.id, 'COMPLETED', t('agent.complete')), icon: <CheckCircle2 size={18} />, label: t('agent.complete'), shortcut: 't', tone: 'good' })}
                {actionButton({ onClick: () => act(current.id, 'ABSENT', t('agent.absent')), icon: <UserX size={18} />, label: t('agent.absent'), shortcut: 'a', tone: 'bad' })}
                {actionButton({ onClick: () => act(current.id, 'ON_HOLD', t('agent.hold')), icon: <Pause size={18} />, label: t('agent.hold'), shortcut: 'p' })}
                {actionButton({ onClick: () => setShowTransfer(true), icon: <ArrowRightLeft size={18} />, label: t('agent.transfer'), shortcut: 'x' })}
                {actionButton({ onClick: () => setShowNote(true), icon: <StickyNote size={18} />, label: t('agent.note'), shortcut: 'n' })}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className={cn('mb-4 text-sm', muted)}>{waiting.length > 0 ? t('agent.noCurrent') : t('agent.nobodyWaiting')}</p>
              <button onClick={callNext} disabled={waiting.length === 0}
                className="flex w-full min-h-touch items-center justify-center gap-2 rounded-2xl bg-brand py-5 text-lg font-bold text-white shadow-raised transition-all disabled:opacity-40">
                <Megaphone size={22} /> {t('agent.callNext')}
                <kbd className="rounded bg-white/20 px-2 text-xs">Espace</kbd>
              </button>
            </div>
          )}
          {lastAction && <p className={cn('mt-3 text-center text-xs', muted)}>{lastAction}</p>}
        </section>

        {/* En pause à ce guichet */}
        {onHold.length > 0 && (
          <section className={cn('mb-4 rounded-card border p-4', surface)}>
            <p className={cn('mb-2 text-xs font-semibold uppercase tracking-wider', muted)}>{t('agent.onHold')}</p>
            <ul className="stagger space-y-2">
              {onHold.map(tk => (
                <li key={tk.id} className="flex items-center justify-between gap-2">
                  <span className={cn('font-mono font-bold', strong)}>{tk.displayNum} <span className={cn('font-sans text-sm font-normal', muted)}>{tk.guestName}</span></span>
                  <Button size="sm" variant="secondary" disabled={!!current} onClick={() => resume(tk.id)}>{t('agent.resume')}</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* File d'attente */}
        <section className={cn('rounded-card border', surface)}>
          <p className={cn('border-b px-4 py-3 text-xs font-semibold uppercase tracking-wider', muted, dark ? 'border-gray-700' : 'border-surface-line')}>
            {t('agent.queue')} · {waiting.length}
          </p>
          <ol className={cn('divide-y', dark ? 'divide-gray-700' : 'divide-surface-line')}>
            {waiting.slice(0, ui.compact ? 6 : 20).map((tk, i) => (
              <li key={tk.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold', i === 0 ? 'bg-brand text-white' : dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600')}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm', strong)}><span className="font-mono font-bold">{tk.displayNum}</span> · {tk.guestName || tk.user?.name}</p>
                    <p className={cn('truncate text-xs', muted)}>{tk.service.name} · {t('agent.since', { time: elapsed(tk.queuedAt, now) })}{tk.route.step > 1 && ` · ↪ depuis ${tk.route.done.at(-1)}`}</p>
                  </div>
                </div>
                {priorityBadge(tk.priorityScore, tk.priorityReason)}
              </li>
            ))}
          </ol>
        </section>

        {!ui.compact && (
          <p className={cn('mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs', muted)}>
            <Keyboard size={14} /> {t('agent.shortcuts')} :
            <span><kbd>Espace</kbd> {t('agent.callNext')}</span>
            <span><kbd>S</kbd> {t('agent.start')}</span>
            <span><kbd>T</kbd> {t('agent.complete')}</span>
            <span><kbd>R</kbd> {t('agent.recall')}</span>
            <span><kbd>A</kbd> {t('agent.absent')}</span>
            <span><kbd>P</kbd> {t('agent.hold')}</span>
            <span><kbd>X</kbd> {t('agent.transfer')}</span>
            <span><kbd>N</kbd> {t('agent.note')}</span>
          </p>
        )}
      </div>

      {/* Transfert */}
      <Dialog open={showTransfer} onClose={() => setShowTransfer(false)} title={t('agent.transferTitle')}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {services.filter(s => s.id !== current?.serviceId && (!realCounter?.branchId || s.branchId === realCounter.branchId)).map(s => {
              // Aucun autre guichet ne traite ce service : le client restera chez ce guichet
              const onlyHere = !otherCounterServes(s.id)
              return (
                <button key={s.id} onClick={() => doTransfer(s.id)}
                  className="flex min-h-touch flex-col items-start rounded-xl border-2 border-surface-line p-3 text-left text-sm font-semibold text-ink transition-all hover:border-brand">
                  {s.name}
                  {onlyHere && <span className="mt-0.5 text-[11px] font-medium text-warning-ink">Traité seulement par votre guichet</span>}
                </button>
              )
            })}
          </div>
          <TextArea label={t('agent.transferNote')} value={transferNote} onChange={e => setTransferNote(e.target.value)} maxLength={500} />
        </div>
      </Dialog>

      {/* Note interne */}
      <Dialog open={showNote} onClose={() => setShowNote(false)} title={t('agent.noteTitle')}>
        <div className="space-y-4">
          <TextArea label={t('agent.notes')} placeholder={t('agent.notePlaceholder')} value={noteText} onChange={e => setNoteText(e.target.value)} maxLength={500} autoFocus />
          <Button fullWidth onClick={saveNote} disabled={!noteText.trim()}>{t('common.save')}</Button>
        </div>
      </Dialog>

      <Dialog open={showProfile} onClose={() => setShowProfile(false)} title={t('dashboard.myProfile')}>
        <div className="flex flex-col gap-4">
          <UserProfileForm theme="blue" />
          <Button variant="secondary" fullWidth icon={<LogOut size={16} />} onClick={() => signOut({ callbackUrl: '/pro/login' })} className="text-danger">{t('common.logout')}</Button>
        </div>
      </Dialog>
    </div>
  )
}
