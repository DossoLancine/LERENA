'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star, Phone, MessageSquareText, StickyNote, CheckCircle2, RotateCcw, Clock, Inbox, BarChart3, Archive } from 'lucide-react'
import { addComplaintEvent, closeComplaint, getComplaint, getSatisfactionStats, listComplaints, reopenComplaint, replyToComplaint } from '@/server/actions/feedback'
import { getSuggestedReply } from '@/server/actions/assistant'
import { FEEDBACK_REASONS, type FeedbackReason } from '@/lib/customer-labels'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { BarChart } from '@/components/charts/bar-chart'
import { cn } from '@/lib/cn'
import { refreshMenuCounts } from './parts'

type Tab = 'open' | 'closed' | 'stats'
type List = NonNullable<Awaited<ReturnType<typeof listComplaints>>>
type Item = List['items'][number]
type Detail = NonNullable<Awaited<ReturnType<typeof getComplaint>>>
type Stats = NonNullable<Awaited<ReturnType<typeof getSatisfactionStats>>>

const HOUR = 3600_000
const ageLabel = (d: Date | string) => {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / HOUR)
  return h < 1 ? 'à l’instant' : h < 24 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`
}
const late = (d: Date | string) => Date.now() - new Date(d).getTime() > 48 * HOUR

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} sur 5`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} size={size} className={i <= n ? (n <= 2 ? 'fill-danger text-danger' : 'fill-amber-400 text-amber-400') : 'text-gray-200'} />)}
    </span>
  )
}

/** Avis des visiteurs : à traiter sous 48 h, traités, et statistiques de satisfaction. */
export function FeedbackPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('open')
  const [list, setList] = useState<List | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [openId, setOpenId] = useState<string | null>(params.get('id'))

  const load = useCallback(async () => {
    if (tab === 'stats') setStats(await getSatisfactionStats().catch(() => null))
    else setList(await listComplaints(tab === 'open' ? 'OPEN' : 'CLOSED').catch(() => null))
  }, [tab])
  useEffect(() => { load() }, [load])
  // Compteur de l'en-tête même depuis l'onglet statistiques
  useEffect(() => { if (tab === 'stats' && !list) listComplaints('OPEN').then(setList).catch(() => null) }, [tab, list])

  const close = () => { setOpenId(null); if (params.get('id')) router.replace('/dashboard/feedback'); load() }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Avis des visiteurs</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {list ? list.open : '…'} <span className="text-ink-muted">avis à traiter</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {list?.overdue ? <strong className="text-danger">{list.overdue} en attente depuis plus de 48 h. </strong> : null}
          Une note de 2 étoiles ou moins, ou un 3 avec un motif, arrive ici. Appelez, répondez, puis clôturez avec la cause.
        </p>
        <nav className="mt-4 inline-flex rounded-xl bg-white/80 p-1 text-sm font-semibold" aria-label="Vues">
          {([['open', 'À traiter', Inbox], ['closed', 'Traités', Archive], ['stats', 'Satisfaction', BarChart3]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', tab === id ? 'bg-ink text-white' : 'text-ink-muted')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'stats' ? <StatsView stats={stats} /> : <ComplaintList list={list} onOpen={setOpenId} closedView={tab === 'closed'} />}
      <ComplaintDialog id={openId} onClose={close} />
    </div>
  )
}

function ComplaintList({ list, onOpen, closedView }: { list: List | null; onOpen: (id: string) => void; closedView: boolean }) {
  if (!list) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />
  if (list.items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-card border border-surface-line bg-white px-6 py-14 text-center shadow-card">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success"><CheckCircle2 size={26} /></span>
        <p className="mt-4 font-semibold text-ink">{closedView ? 'Aucun avis traité pour l’instant' : 'Rien à traiter'}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{closedView ? 'Les avis clôturés s’afficheront ici avec leur cause.' : 'Aucun visiteur mécontent en attente de réponse.'}</p>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {list.items.map((c, i) => <ComplaintCard key={c.id} c={c} i={i} onOpen={onOpen} />)}
    </ul>
  )
}

function ComplaintCard({ c, i, onOpen }: { c: Item; i: number; onOpen: (id: string) => void }) {
  const overdue = c.status === 'OPEN' && late(c.createdAt)
  return (
    <li className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
      <button onClick={() => onOpen(c.id)} className={cn('w-full rounded-card border bg-white p-4 text-left shadow-card transition-colors hover:border-brand/40', overdue ? 'border-danger/40' : 'border-surface-line')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Stars n={c.rating} /><span className="font-semibold text-ink">{c.name || 'Visiteur'}</span></span>
          <span className={cn('flex items-center gap-1 text-xs font-semibold', overdue ? 'text-danger' : 'text-ink-muted')}>
            <Clock size={12} />{c.status === 'OPEN' ? ageLabel(c.createdAt) : `clôturé ${ageLabel(c.closedAt!)}`}
          </span>
        </div>
        {c.comment && <p className="mt-2 line-clamp-2 text-sm text-ink">« {c.comment} »</p>}
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="font-mono">{c.ticket.displayNum}</span>
          <span>{c.ticket.service.name}</span>
          {c.ticket.counterName && <span>{c.ticket.counterName}</span>}
          {c.waitMin != null && <span>{c.waitMin} min d’attente</span>}
          {c.reason && <Badge tone="warning">{FEEDBACK_REASONS[c.reason as FeedbackReason]}</Badge>}
          {c.closeReason && <Badge tone="neutral">Cause : {FEEDBACK_REASONS[c.closeReason as FeedbackReason]}</Badge>}
          {c._count.events > 0 && <span>{c._count.events} action{c._count.events > 1 ? 's' : ''}</span>}
        </p>
      </button>
    </li>
  )
}

const EVENT_LABEL: Record<string, string> = { NOTE: 'Note', SMS: 'SMS envoyé', CALL: 'Appel', CLOSED: 'Clôturé', REOPENED: 'Rouvert' }

function ComplaintDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast()
  const [c, setC] = useState<Detail | null>(null)
  const [mode, setMode] = useState<'note' | 'sms' | 'close' | null>(null)
  const [text, setText] = useState('')
  const [cause, setCause] = useState<FeedbackReason | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => { if (id) setC(await getComplaint(id).catch(() => null)) }, [id])
  useEffect(() => { setC(null); setMode(null); setText(''); setCause(null); load() }, [load])

  const run = async (p: Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(true)
    const res = await p
    setBusy(false)
    if (!res.success) return toast(res.error ?? 'Action impossible', 'error')
    toast(ok, 'success')
    setMode(null); setText('')
    refreshMenuCounts()
    load()
  }

  return (
    <Dialog open={!!id} onClose={onClose} title="Avis à traiter" size="lg">
      {!c ? <div className="h-48 animate-pulse rounded-2xl bg-gray-100" /> : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars n={c.rating} size={18} />
              <span className="text-xs text-ink-muted">{new Date(c.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="mt-2 text-base text-ink">{c.comment ? `« ${c.comment} »` : <span className="text-ink-subtle">Pas de commentaire</span>}</p>
            {c.reason && <p className="mt-1 text-xs font-semibold text-warning-ink">Motif donné : {FEEDBACK_REASONS[c.reason as FeedbackReason]}</p>}
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
              <span className="font-mono font-semibold text-ink">{c.ticket.displayNum}</span><span>{c.ticket.service.name}</span>
              {c.ticket.counterName && <span>{c.ticket.counterName}</span>}<span>{c.ticket.queue.branch.name}</span>
              {c.waitMin != null && <span>{c.waitMin} min d’attente</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-semibold text-ink">
              {c.customer ? <Link href={`/dashboard/visitors/${c.customer.id}`} className="hover:text-brand">{c.name || 'Visiteur'} · {c.customer.visits} passage{c.customer.visits > 1 ? 's' : ''}</Link> : c.name || 'Visiteur sans fiche'}
            </span>
            {c.phone && (
              <a href={`tel:${c.phone}`} onClick={() => addComplaintEvent(c.id, 'CALL').then(load)} className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white"><Phone size={15} /> Appeler</a>
            )}
            {c.phone && <Button size="sm" variant="secondary" icon={<MessageSquareText size={14} />} onClick={() => setMode('sms')}>SMS</Button>}
            <Button size="sm" variant="secondary" icon={<StickyNote size={14} />} onClick={() => setMode('note')}>Note</Button>
          </div>

          {(mode === 'note' || mode === 'sms') && (
            <div className="animate-rise-in space-y-2 rounded-2xl border border-surface-line p-3">
              {mode === 'sms' && (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={async () => { const r = await getSuggestedReply(c.id); if (r) setText(r) }} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">Proposer une réponse</button>
                  {['Bonjour, nous avons bien reçu votre avis et nous vous présentons nos excuses. Pouvons-nous vous appeler pour en parler ?',
                    'Merci pour votre retour. Nous avons pris des mesures pour que cela ne se reproduise pas.'].map(q => (
                    <button key={q} onClick={() => setText(q)} className="rounded-full border border-surface-line px-2.5 py-1 text-left text-xs text-ink-muted hover:text-ink">{q.split('.')[0]}</button>
                  ))}
                </div>
              )}
              <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus maxLength={mode === 'sms' ? 320 : 1000}
                placeholder={mode === 'sms' ? 'Votre réponse au visiteur…' : 'Ce qui a été fait, ce qui a été dit…'}
                className="w-full resize-none rounded-control border border-gray-200 px-3 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
                <Button size="sm" fullWidth loading={busy} disabled={!text.trim()}
                  onClick={() => run(mode === 'sms' ? replyToComplaint(c.id, text) : addComplaintEvent(c.id, 'NOTE', text), mode === 'sms' ? 'SMS envoyé' : 'Note ajoutée')}>
                  {mode === 'sms' ? 'Envoyer le SMS' : 'Ajouter la note'}
                </Button>
              </div>
            </div>
          )}

          {c.events.length > 0 && (
            <ol className="space-y-2 border-l-2 border-surface-line pl-4">
              {c.events.map(e => (
                <li key={e.id} className="text-sm">
                  <p className="text-xs text-ink-subtle"><strong className="text-ink-muted">{EVENT_LABEL[e.kind] ?? e.kind}</strong> · {e.authorName} · {new Date(e.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  {e.text && <p className="text-ink">{e.text}</p>}
                </li>
              ))}
            </ol>
          )}

          {c.status === 'OPEN' ? (
            mode === 'close' ? (
              <div className="animate-rise-in space-y-3 rounded-2xl border border-brand/20 bg-brand-50/40 p-3">
                <p className="text-sm font-semibold text-ink">Cause retenue</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FEEDBACK_REASONS) as FeedbackReason[]).map(r => (
                    <button key={r} onClick={() => setCause(r)} aria-pressed={cause === r}
                      className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold', cause === r ? 'border-ink bg-ink text-white' : 'border-surface-line bg-white text-ink-muted')}>{FEEDBACK_REASONS[r]}</button>
                  ))}
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={500} placeholder="Ce qui a été fait (facultatif)"
                  className="w-full resize-none rounded-control border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none" />
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Annuler</Button>
                  <Button size="sm" fullWidth loading={busy} disabled={!cause} onClick={() => run(closeComplaint(c.id, { closeReason: cause!, resolution: text }), 'Avis clôturé')}>Clôturer l’avis</Button>
                </div>
              </div>
            ) : (
              <Button fullWidth icon={<CheckCircle2 size={16} />} onClick={() => { setText(''); setMode('close') }}>Clôturer avec la cause</Button>
            )
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success-ink">
              <span>Clôturé par {c.closedByName} · cause : {FEEDBACK_REASONS[c.closeReason as FeedbackReason]}{c.resolution ? ` · ${c.resolution}` : ''}</span>
              <button onClick={() => run(reopenComplaint(c.id), 'Avis rouvert')} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold"><RotateCcw size={12} /> Rouvrir</button>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

function StatsView({ stats }: { stats: Stats | null }) {
  if (!stats) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />
  if (stats.count === 0) {
    return <p className="rounded-card border border-surface-line bg-white px-6 py-14 text-center text-sm text-ink-muted shadow-card">Pas encore de note sur les 8 dernières semaines. Les visiteurs notent leur passage depuis leur ticket.</p>
  }
  const maxDist = Math.max(...stats.distribution.map(d => d.count), 1)
  const maxReason = Math.max(...stats.reasons.map(r => r.count), 1)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: 'Note moyenne', v: stats.average != null ? stats.average.toFixed(1).replace('.', ',') : '—', h: '8 dernières semaines' },
          { l: 'Notes reçues', v: stats.count, h: `${stats.responseRate} % des passages` },
          { l: 'Avis à traiter', v: stats.complaints.total, h: `${stats.complaints.open} encore ouverts` },
          { l: 'Traités sous 48 h', v: stats.complaints.within48h != null ? `${stats.complaints.within48h} %` : '—', h: stats.complaints.medianHours != null ? `délai médian ${stats.complaints.medianHours} h` : 'aucun clôturé' }
        ].map(s => (
          <div key={s.l} className="rounded-card border border-surface-line bg-white p-4 shadow-card">
            <p className="text-xs text-ink-muted">{s.l}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{s.v}</p>
            <p className="mt-0.5 text-[11px] text-ink-subtle">{s.h}</p>
          </div>
        ))}
      </div>

      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <h2 className="font-semibold text-ink">Note moyenne par semaine</h2>
        <p className="mb-4 text-xs text-ink-muted">Sur 5 · semaines commençant le lundi</p>
        <BarChart label="Note moyenne par semaine" data={stats.byWeek.map(w => ({ label: w.label, value: w.value, hint: `${w.count} note${w.count > 1 ? 's' : ''}` }))} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Répartition des notes</h2>
          <ul className="space-y-2">
            {stats.distribution.map(d => (
              <li key={d.stars} className="flex items-center gap-3 text-sm">
                <span className="flex w-10 items-center gap-1 tabular-nums text-ink-muted">{d.stars} <Star size={12} className="fill-amber-400 text-amber-400" /></span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-brand animate-bar-grow origin-left" style={{ width: `${(d.count / maxDist) * 100}%` }} /></span>
                <span className="w-8 text-right tabular-nums text-ink">{d.count}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Causes des avis négatifs</h2>
          {stats.reasons.length === 0 ? <p className="text-sm text-ink-subtle">Aucune cause relevée.</p> : (
            <ul className="space-y-2">
              {stats.reasons.map(r => (
                <li key={r.reason} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate text-ink">{r.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full bg-brand-700 animate-bar-grow origin-left" style={{ width: `${(r.count / maxReason) * 100}%` }} /></span>
                  <span className="w-8 text-right tabular-nums text-ink">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {([['Par service', stats.byService], ['Par guichet', stats.byCounter]] as const).map(([title, rows]) => (
          <section key={title} className="rounded-card border border-surface-line bg-white shadow-card">
            <h2 className="border-b border-surface-line px-5 py-3.5 font-semibold text-ink">{title}<span className="ml-2 text-xs font-normal text-ink-muted">les moins bien notés en premier</span></h2>
            <ul className="divide-y divide-surface-line">
              {rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-subtle">Pas de données</li>}
              {rows.map(r => (
                <li key={r.label} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
                  <span className="text-xs text-ink-subtle tabular-nums">{r.count} note{r.count > 1 ? 's' : ''}</span>
                  <span className={cn('w-12 text-right font-display font-bold tabular-nums', r.avg < 3 ? 'text-danger' : 'text-ink')}>{r.avg.toFixed(1).replace('.', ',')}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
