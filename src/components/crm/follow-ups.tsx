'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, Check, CalendarClock, MessageSquareText, RotateCcw, X, ListChecks, Phone, Lock } from 'lucide-react'
import { createFollowUp, getCustomerFollowUps, listFollowUps, setFollowUpStatus } from '@/server/actions/customers'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { TagChip } from './parts'

// Suivis datés : carte de la fiche visiteur et page « À faire ».

const today = () => new Date().toISOString().slice(0, 10)
const plusDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10)
const plusMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
const dueLabel = (d: Date | string) => {
  const key = new Date(d).toISOString().slice(0, 10)
  const days = Math.round((new Date(`${key}T00:00:00Z`).getTime() - new Date(`${today()}T00:00:00Z`).getTime()) / 86400_000)
  if (days === 0) return 'Aujourd’hui'
  if (days === 1) return 'Demain'
  if (days === -1) return 'Hier'
  if (days < 0) return `En retard de ${-days} jours`
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
const isLate = (d: Date | string) => new Date(d).toISOString().slice(0, 10) < today()

const QUICK = [
  { label: 'Dans 1 semaine', value: () => plusDays(7) },
  { label: '1 mois', value: () => plusMonths(1) },
  { label: '3 mois', value: () => plusMonths(3) },
  { label: '6 mois', value: () => plusMonths(6) }
]

function UpgradeNote({ what }: { what: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-surface-sunken p-4 text-sm">
      <Lock size={16} className="mt-0.5 shrink-0 text-ink-subtle" />
      <p className="text-ink-muted">{what} sont inclus à partir du forfait Pro. <Link href="/dashboard/billing" className="font-semibold text-brand">Voir les forfaits</Link></p>
    </div>
  )
}

type CardData = NonNullable<Awaited<ReturnType<typeof getCustomerFollowUps>>>

/** Carte « Suivis » de la fiche visiteur : programmer un rappel daté, le confier, prévenir le visiteur par SMS. */
export function FollowUpsCard({ customerId, hasPhone }: { customerId: string; hasPhone: boolean }) {
  const toast = useToast()
  const [data, setData] = useState<CardData | null>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(plusMonths(1))
  const [assignee, setAssignee] = useState('')
  const [sms, setSms] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => setData(await getCustomerFollowUps(customerId).catch(() => null)), [customerId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setBusy(true)
    const res = await createFollowUp(customerId, { title, dueDate: due, assignedToId: assignee || null, smsReminder: sms && hasPhone })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Suivi programmé', 'success')
    setTitle(''); setSms(false); setOpen(false)
    load()
  }
  const setStatus = async (id: string, status: 'OPEN' | 'DONE' | 'CANCELLED') => {
    const res = await setFollowUpStatus(id, status)
    if (!res.success) toast(res.error, 'error')
    load()
  }

  const openItems = data?.items.filter(f => f.status === 'OPEN') ?? []
  const doneItems = data?.items.filter(f => f.status === 'DONE').slice(0, 3) ?? []

  return (
    <section className="h-fit rounded-card border border-surface-line bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-surface-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-ink"><CalendarClock size={16} className="text-brand" /> Suivis</h2>
        {data?.enabled && !open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Programmer</Button>}
      </header>
      <div className="space-y-3 p-4">
        {!data ? <div className="h-16 animate-pulse rounded-xl bg-gray-100" /> : !data.enabled ? <UpgradeNote what="Les suivis datés" /> : (
          <>
            {open && (
              <div className="animate-rise-in space-y-3 rounded-2xl border border-brand/20 bg-brand-50/40 p-3">
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} autoFocus
                  placeholder="Objet : contrôle, renouvellement, résultats à remettre…"
                  className="h-10 w-full rounded-control border border-gray-200 bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK.map(q => (
                    <button key={q.label} onClick={() => setDue(q.value())} className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', due === q.value() ? 'border-brand bg-brand text-white' : 'border-surface-line bg-white text-ink-muted')}>{q.label}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-ink-muted">Date
                    <input type="date" value={due} min={today()} onChange={e => setDue(e.target.value)} className="mt-1 h-10 w-full rounded-control border border-gray-200 bg-white px-2 text-sm font-normal text-ink" />
                  </label>
                  <label className="text-xs font-semibold text-ink-muted">Confié à
                    <select value={assignee} onChange={e => setAssignee(e.target.value)} className="mt-1 h-10 w-full rounded-control border border-gray-200 bg-white px-2 text-sm font-normal text-ink">
                      <option value="">Toute l’équipe</option>
                      {data.team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </label>
                </div>
                <label className={cn('flex items-start gap-2 text-sm', !hasPhone && 'opacity-50')}>
                  <input type="checkbox" checked={sms} disabled={!hasPhone} onChange={e => setSms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c2410c]" />
                  <span><span className="font-semibold text-ink">Prévenir le visiteur par SMS ce jour-là</span><span className="block text-xs text-ink-muted">Avec le lien pour réserver son créneau. 1 SMS décompté.</span></span>
                </label>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button size="sm" fullWidth loading={busy} disabled={!title.trim()} onClick={save}>Programmer le suivi</Button>
                </div>
              </div>
            )}
            {openItems.length === 0 && !open && <p className="py-2 text-center text-sm text-ink-subtle">Aucun suivi prévu.</p>}
            <ul className="space-y-2">
              {openItems.map(f => (
                <li key={f.id} className={cn('flex items-start gap-3 rounded-xl border px-3 py-2.5', isLate(f.dueDate) ? 'border-warning/40 bg-warning-soft/40' : 'border-surface-line')}>
                  <button onClick={() => setStatus(f.id, 'DONE')} aria-label={`Marquer « ${f.title} » comme fait`}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-gray-300 text-transparent transition-colors hover:border-success hover:text-success"><Check size={12} strokeWidth={3} /></button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{f.title}</p>
                    <p className={cn('mt-0.5 flex flex-wrap items-center gap-x-2 text-xs', isLate(f.dueDate) ? 'font-semibold text-warning-ink' : 'text-ink-muted')}>
                      {dueLabel(f.dueDate)}
                      {f.assignedToName && <span className="font-normal text-ink-muted">· {f.assignedToName}</span>}
                      {f.smsReminder && <span className="inline-flex items-center gap-0.5 font-normal text-ink-muted"><MessageSquareText size={11} /> {f.smsSentAt ? 'SMS envoyé' : 'SMS prévu'}</span>}
                    </p>
                  </div>
                  <button onClick={() => setStatus(f.id, 'CANCELLED')} aria-label="Annuler le suivi" className="rounded p-1 text-ink-subtle hover:text-danger"><X size={14} /></button>
                </li>
              ))}
            </ul>
            {doneItems.length > 0 && (
              <ul className="space-y-1 border-t border-surface-line pt-2">
                {doneItems.map(f => (
                  <li key={f.id} className="flex items-center gap-2 text-xs text-ink-subtle">
                    <Check size={12} className="text-success" />
                    <span className="flex-1 truncate line-through">{f.title}</span>
                    <button onClick={() => setStatus(f.id, 'OPEN')} aria-label="Rouvrir" className="rounded p-0.5 hover:text-ink"><RotateCcw size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

type Board = NonNullable<Awaited<ReturnType<typeof listFollowUps>>>
type Item = Board['today'][number]

/** Page « À faire » : suivis en retard et du jour, à venir, faits cette semaine. */
export function FollowUpsBoard({ visitorsPath }: { visitorsPath: string }) {
  const toast = useToast()
  const [mine, setMine] = useState(false)
  const [data, setData] = useState<Board | null>(null)
  const [leaving, setLeaving] = useState<string[]>([])

  const load = useCallback(async () => setData(await listFollowUps({ mine }).catch(() => null)), [mine])
  useEffect(() => { load() }, [load])

  const done = async (f: Item) => {
    setLeaving(l => [...l, f.id])
    const res = await setFollowUpStatus(f.id, 'DONE')
    if (!res.success) toast(res.error, 'error')
    else toast(`« ${f.title} » fait`, 'success')
    await load()
    setLeaving(l => l.filter(x => x !== f.id))
  }

  const lateCount = data?.today.filter(f => isLate(f.dueDate)).length ?? 0

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">À faire</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {data ? data.today.length : '…'} <span className="text-ink-muted">suivi{data?.today.length === 1 ? '' : 's'} aujourd’hui</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">{lateCount > 0 ? `Dont ${lateCount} en retard. ` : ''}Appelez, cochez : le suivi passe dans « Faits ».</p>
        <div className="mt-4 inline-flex rounded-xl bg-white/80 p-1 text-sm font-semibold" role="radiogroup" aria-label="Suivis affichés">
          {[{ v: false, l: 'Toute l’équipe' }, { v: true, l: 'Les miens' }].map(o => (
            <button key={o.l} role="radio" aria-checked={mine === o.v} onClick={() => setMine(o.v)}
              className={cn('rounded-lg px-3 py-1.5', mine === o.v ? 'bg-ink text-white' : 'text-ink-muted')}>{o.l}</button>
          ))}
        </div>
      </header>

      {!data ? <div className="h-64 animate-pulse rounded-card bg-gray-100" /> : !data.enabled ? <UpgradeNote what="Les suivis et relances" /> : (
        <>
          <Column title="Aujourd’hui et en retard" icon={<BellRing size={16} className="text-brand" />} items={data.today} empty="Rien pour aujourd’hui. Programmez des suivis depuis les fiches visiteurs." visitorsPath={visitorsPath} onDone={done} leaving={leaving} />
          <Column title="14 prochains jours" icon={<CalendarClock size={16} className="text-ink-muted" />} items={data.upcoming} empty="Aucun suivi prévu dans les deux semaines." visitorsPath={visitorsPath} onDone={done} leaving={leaving} />
          {data.done.length > 0 && (
            <section className="rounded-card border border-surface-line bg-white shadow-card">
              <h2 className="flex items-center gap-2 border-b border-surface-line px-5 py-3.5 font-semibold text-ink"><ListChecks size={16} className="text-success" /> Faits cette semaine</h2>
              <ul className="divide-y divide-surface-line">
                {data.done.map(f => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <Check size={14} className="text-success" />
                    <Link href={`${visitorsPath}/${f.customer.id}`} className="font-semibold text-ink hover:text-brand">{f.customer.name || f.customer.phone}</Link>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{f.title}</span>
                    <span className="hidden text-xs text-ink-subtle sm:inline">{f.doneByName}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Column({ title, icon, items, empty, visitorsPath, onDone, leaving }: {
  title: string; icon: React.ReactNode; items: Item[]; empty: string; visitorsPath: string; onDone: (f: Item) => void; leaving: string[]
}) {
  return (
    <section className="rounded-card border border-surface-line bg-white shadow-card">
      <h2 className="flex items-center gap-2 border-b border-surface-line px-5 py-3.5 font-semibold text-ink">{icon}{title}<span className="ml-auto text-xs font-medium text-ink-muted tabular-nums">{items.length}</span></h2>
      {items.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-subtle">{empty}</p> : (
        <ul className="divide-y divide-surface-line">
          {items.map((f, i) => (
            <li key={f.id} className={cn('flex animate-rise-in items-center gap-3 px-4 py-3 transition-all duration-300', leaving.includes(f.id) && 'translate-x-4 opacity-0')} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <button onClick={() => onDone(f)} aria-label={`Marquer « ${f.title} » comme fait`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 text-transparent transition-colors hover:border-success hover:bg-success-soft hover:text-success"><Check size={14} strokeWidth={3} /></button>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Link href={`${visitorsPath}/${f.customer.id}`} className="font-semibold text-ink hover:text-brand">{f.customer.name || 'Visiteur'}</Link>
                  {f.customer.tags.slice(0, 2).map(t => <TagChip key={t.id} tag={t} small />)}
                </p>
                <p className="truncate text-sm text-ink-muted">{f.title}</p>
                <p className={cn('mt-0.5 flex flex-wrap gap-x-2 text-xs', isLate(f.dueDate) ? 'font-semibold text-warning-ink' : 'text-ink-subtle')}>
                  {dueLabel(f.dueDate)}
                  {f.assignedToName && <span className="font-normal text-ink-subtle">· {f.assignedToName}</span>}
                  {f.smsReminder && <span className="font-normal text-ink-subtle">· {f.smsSentAt ? 'SMS envoyé' : 'SMS prévu'}</span>}
                </p>
              </div>
              {f.customer.phone && (
                <a href={`tel:${f.customer.phone}`} aria-label={`Appeler ${f.customer.name ?? ''}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink text-white"><Phone size={16} /></a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
