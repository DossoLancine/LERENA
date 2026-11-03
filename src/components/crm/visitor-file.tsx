'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Phone, MessageCircle, CalendarPlus, Pencil, Star, Ticket, CalendarDays, CalendarX2, Clock, Trash2,
  ShieldCheck, Tag as TagIcon, Plus, Check, Smartphone, StickyNote, MessageSquareText
} from 'lucide-react'
import {
  getCustomer, renameCustomer, setCustomerConsent, addCustomerNote, deleteCustomerNote, setCustomerTags, createCustomerTag, deleteCustomerTag
} from '@/server/actions/customers'
import { TAG_COLORS, SOURCE_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/customer-labels'
import { Button, Dialog, TextInput, TicketStatusBadge, Badge, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { TagChip, Initials, sinceLabel } from './parts'
import { BookForVisitor } from './book-for-visitor'
import { FollowUpsCard } from './follow-ups'
import { MessagesCard } from './messages-card'

type Data = NonNullable<Awaited<ReturnType<typeof getCustomer>>>
type Entry = Data['timeline'][number]

const fullDate = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = (d: Date | string, utc = false) =>
  new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...(utc ? { timeZone: 'UTC' } : {}) })

/** Fiche d'un visiteur : chiffres, actions en un geste, étiquettes, historique et notes internes. */
export function VisitorFile({ id, basePath }: { id: string; basePath: string }) {
  const toast = useToast()
  const [data, setData] = useState<Data | null | undefined>(undefined)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showTags, setShowTags] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [rename, setRename] = useState('')
  const [showSms, setShowSms] = useState(false)

  const load = useCallback(async () => setData(await getCustomer(id).catch(() => null)), [id])
  useEffect(() => { load() }, [load])

  if (data === undefined) return <FileSkeleton />
  if (data === null) {
    return (
      <div className="rounded-card border border-surface-line bg-white p-10 text-center shadow-card">
        <p className="font-semibold text-ink">Fiche introuvable</p>
        <p className="mt-1 text-sm text-ink-muted">Elle a peut-être été supprimée (durée de conservation dépassée ou demande du visiteur).</p>
        <Link href={basePath} className="mt-4 inline-block text-sm font-semibold text-brand">Retour aux visiteurs</Link>
      </div>
    )
  }

  const c = data.customer
  const wa = c.phone?.replace(/\D/g, '')
  const run = async (p: Promise<{ success: boolean; error?: string }>, ok?: string) => {
    const res = await p
    if (!res.success) toast(res.error ?? 'Action impossible', 'error')
    else if (ok) toast(ok, 'success')
    await load()
    return res.success
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    setSavingNote(true)
    if (await run(addCustomerNote(c.id, noteText))) setNoteText('')
    setSavingNote(false)
  }

  const stats = [
    { label: 'Passages', value: c.visits, icon: <Ticket size={16} /> },
    { label: 'Absences', value: c.noShows, icon: <CalendarX2 size={16} />, warn: c.noShows >= 2 },
    { label: 'RDV à venir', value: c.upcoming, icon: <CalendarDays size={16} /> },
    { label: 'Note moyenne', value: c.ratingAvg != null ? c.ratingAvg.toFixed(1).replace('.', ',') : '—', icon: <Star size={16} />, warn: c.lastRating != null && c.lastRating <= 2 }
  ]

  return (
    <div className="space-y-5">
      <Link href={basePath} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeft size={16} /> Visiteurs
      </Link>

      {/* Identité et actions */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-4">
          <Initials name={c.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{c.name || 'Visiteur sans nom'}</h1>
              <button onClick={() => { setRename(c.name ?? ''); setShowRename(true) }} aria-label="Modifier le nom" className="rounded-full p-1.5 text-ink-subtle hover:bg-white/70 hover:text-ink"><Pencil size={15} /></button>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="font-mono tabular-nums">{c.phone ?? 'Sans numéro'}</span>
              {c.hasAccount && <span className="inline-flex items-center gap-1"><Smartphone size={13} /> Compte Lerena</span>}
              <span>Connu depuis le {fullDate(c.firstSeenAt)}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {c.tags.map(t => <TagChip key={t.id} tag={t} />)}
              <button onClick={() => setShowTags(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:border-brand hover:text-brand">
                <TagIcon size={12} /> {c.tags.length ? 'Étiquettes' : 'Ajouter une étiquette'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <a href={c.phone ? `tel:${c.phone}` : undefined} aria-disabled={!c.phone}
            className={cn('flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white', !c.phone && 'pointer-events-none opacity-40')}>
            <Phone size={16} /> Appeler
          </a>
          <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!wa}
            className={cn('flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm', !wa && 'pointer-events-none opacity-40')}>
            <MessageCircle size={16} className="text-[#128c4a]" /> WhatsApp
          </a>
          <button onClick={() => setShowBook(true)} disabled={!c.phone}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm disabled:opacity-40">
            <CalendarPlus size={16} className="text-brand" /> <span className="truncate">Rendez-vous</span>
          </button>
          <button onClick={() => setShowSms(true)} disabled={!c.phone || !!c.optedOutAt}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm disabled:opacity-40">
            <MessageSquareText size={16} className="text-brand" /> SMS
          </button>
        </div>
      </section>

      {/* Chiffres */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="animate-rise-in rounded-card border border-surface-line bg-white p-4 shadow-card" style={{ animationDelay: `${i * 40}ms` }}>
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', s.warn ? 'text-warning-ink' : 'text-ink-muted')}>{s.icon}{s.label}</span>
            <p className={cn('mt-1 font-display text-3xl font-bold tabular-nums', s.warn ? 'text-warning-ink' : 'text-ink')}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
        {/* Historique */}
        <section className="rounded-card border border-surface-line bg-white shadow-card">
          <header className="flex items-center justify-between border-b border-surface-line px-5 py-4">
            <h2 className="font-semibold text-ink">Historique</h2>
            <span className="text-xs text-ink-muted">{c.lastVisitAt ? `Dernier passage ${sinceLabel(c.lastVisitAt)}` : 'Pas encore venu'}</span>
          </header>
          {data.timeline.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-muted">Aucun passage enregistré pour l’instant.</p>
          ) : (
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[37px] top-6 w-px bg-surface-line" aria-hidden="true" />
              {data.timeline.map(e => <TimelineItem key={`${e.kind}-${e.id}`} e={e} />)}
            </ol>
          )}
        </section>
        {c.phone && <MessagesCard customerId={c.id} orgName={c.orgName} name={c.name || 'ce visiteur'} open={showSms} onOpenChange={setShowSms} />}
        </div>

        <div className="space-y-5">
        <FollowUpsCard customerId={c.id} hasPhone={!!c.phone} />

        {/* Notes internes */}
        <section className="h-fit rounded-card border border-surface-line bg-white shadow-card">
          <header className="border-b border-surface-line px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><StickyNote size={16} className="text-brand" /> Notes de l’équipe</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Visibles par l’accueil et le responsable, jamais par le visiteur.</p>
          </header>
          <div className="space-y-2 p-4">
            <textarea
              value={noteText} onChange={e => setNoteText(e.target.value)} rows={3} maxLength={1000}
              placeholder="Ex. Préfère être appelé le matin. Vient accompagné de sa mère."
              className="w-full resize-none rounded-control border border-gray-200 px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="text-[11px] leading-snug text-ink-subtle">N’inscrivez ni diagnostic ni information médicale : uniquement ce qui aide à mieux accueillir.</p>
            <Button size="sm" fullWidth loading={savingNote} disabled={!noteText.trim()} onClick={addNote}>Ajouter la note</Button>
          </div>
          <ul className="divide-y divide-surface-line border-t border-surface-line">
            {data.notes.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-subtle">Pas encore de note.</li>}
            {data.notes.map(n => (
              <li key={n.id} className="group px-5 py-3">
                <p className="whitespace-pre-line text-sm text-ink">{n.text}</p>
                <p className="mt-1 flex items-center justify-between text-[11px] text-ink-subtle">
                  <span>{n.authorName} · {dateTime(n.createdAt)}</span>
                  {(n.mine || data.role === 'MANAGER') && (
                    <button onClick={() => run(deleteCustomerNote(n.id), 'Note supprimée')} aria-label="Supprimer la note" className="rounded p-1 opacity-60 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"><Trash2 size={13} /></button>
                  )}
                </p>
              </li>
            ))}
          </ul>

          {/* Consentement aux messages */}
          <div className="flex items-start gap-3 border-t border-surface-line px-5 py-4">
            <ShieldCheck size={18} className={cn('mt-0.5 shrink-0', c.consentAt ? 'text-success' : 'text-ink-subtle')} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink">{c.consentAt ? 'Accepte les messages d’information' : c.optedOutAt ? 'A répondu STOP aux messages d’information' : 'Pas d’accord pour les messages d’information'}</p>
              <p className="text-xs text-ink-muted">
                {c.consentAt ? `Depuis le ${fullDate(c.consentAt)}${c.consentChannel === 'RECEPTION' ? ', recueilli par l’équipe' : c.consentChannel === 'APP' ? ', donné dans l’application' : ''}.`
                  : c.optedOutAt ? `Le ${fullDate(c.optedOutAt)}. Ne cochez « Il accepte » que s’il vous le redemande.` : 'Les SMS liés à ses tickets et rendez-vous partent quand même.'}
              </p>
            </div>
            <button onClick={() => run(setCustomerConsent(c.id, !c.consentAt), c.consentAt ? 'Accord retiré' : 'Accord enregistré')}
              className="shrink-0 rounded-lg border border-surface-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
              {c.consentAt ? 'Retirer' : 'Il accepte'}
            </button>
          </div>
        </section>
        </div>
      </div>

      <TagsDialog open={showTags} onClose={() => setShowTags(false)} data={data} onChange={load} />

      <Dialog open={showRename} onClose={() => setShowRename(false)} title="Nom du visiteur">
        <div className="space-y-4">
          <TextInput label="Nom" value={rename} onChange={e => setRename(e.target.value)} maxLength={60} />
          <Button fullWidth disabled={!rename.trim()} onClick={async () => { if (await run(renameCustomer(c.id, rename), 'Nom enregistré')) setShowRename(false) }}>Enregistrer</Button>
        </div>
      </Dialog>

      {c.phone && (
        <BookForVisitor open={showBook} onClose={() => setShowBook(false)} orgId={data.orgId} customerId={c.id} name={c.name || 'Visiteur'} phone={c.phone} onBooked={load} />
      )}
    </div>
  )
}

function TimelineItem({ e }: { e: Entry }) {
  const isTicket = e.kind === 'ticket'
  return (
    <li className="relative flex gap-4 py-3">
      <span className={cn('relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white',
        isTicket ? 'bg-brand-50 text-brand' : e.upcoming ? 'bg-info-soft text-info-ink' : 'bg-gray-100 text-ink-muted')}>
        {isTicket ? <Ticket size={15} /> : <CalendarDays size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">
            {isTicket ? <span className="font-mono">{e.label}</span> : e.upcoming ? 'Rendez-vous à venir' : 'Rendez-vous'}
            <span className="font-normal text-ink-muted"> · {e.service}{e.site ? ` · ${e.site}` : ''}</span>
          </p>
          {isTicket ? <TicketStatusBadge status={e.status} /> : (
            <Badge tone={e.status === 'NO_SHOW' ? 'warning' : e.status === 'CANCELLED' ? 'neutral' : 'info'}>{APPOINTMENT_STATUS_LABELS[e.status] ?? e.status}</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          {/* Les heures de rendez-vous sont enregistrées en heure locale d'Abidjan (UTC) */}
          {dateTime(e.at, !isTicket)}
          {isTicket && e.counter ? ` · ${e.counter}` : ''}
          {!isTicket && e.source ? ` · pris ${SOURCE_LABELS[e.source] ? `via ${SOURCE_LABELS[e.source]}` : ''}` : ''}
        </p>
        {isTicket && (e.waitMin != null || e.serviceMin != null || e.priority || e.rating != null) && (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-muted">
            {e.waitMin != null && <span className="inline-flex items-center gap-1"><Clock size={12} /> {e.waitMin} min d’attente</span>}
            {e.serviceMin != null && <span>{e.serviceMin} min au guichet</span>}
            {e.priority && <span className="font-semibold text-info-ink">{e.priority}</span>}
            {e.rating != null && (
              <span className={cn('inline-flex items-center gap-0.5 font-semibold', e.rating <= 2 ? 'text-danger' : 'text-ink')}>
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} className={i < e.rating! ? (e.rating! <= 2 ? 'fill-danger text-danger' : 'fill-amber-400 text-amber-500') : 'text-gray-300'} />)}
              </span>
            )}
          </p>
        )}
        {isTicket && e.note && <p className="mt-1.5 rounded-lg bg-surface-sunken px-2.5 py-1.5 text-xs text-ink">{e.note}</p>}
      </div>
    </li>
  )
}

function TagsDialog({ open, onClose, data, onChange }: { open: boolean; onClose: () => void; data: Data; onChange: () => Promise<void> }) {
  const toast = useToast()
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(TAG_COLORS[0])
  const [busy, setBusy] = useState(false)
  // Sélection initialisée à l'ouverture seulement : une étiquette créée dans la fenêtre reste cochée après rechargement
  useEffect(() => { if (open) setSelected(data.customer.tags.map(t => t.id)) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
  const save = async () => {
    setBusy(true)
    const res = await setCustomerTags(data.customer.id, selected)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    await onChange()
    onClose()
  }
  const create = async () => {
    const res = await createCustomerTag(name, color)
    if (!res.success) return toast(res.error, 'error')
    setName('')
    setSelected(s => [...s, res.tag.id])
    await onChange()
  }
  const remove = async (id: string, label: string) => {
    if (!window.confirm(`Supprimer l’étiquette « ${label} » de toutes les fiches ?`)) return
    const res = await deleteCustomerTag(id)
    if (!res.success) return toast(res.error, 'error')
    setSelected(s => s.filter(x => x !== id))
    await onChange()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Étiquettes">
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">Les étiquettes s’affichent au guichet quand ce visiteur est appelé.</p>
        <ul className="flex flex-wrap gap-2">
          {data.orgTags.length === 0 && <li className="text-sm text-ink-subtle">Aucune étiquette pour l’instant : créez la première ci-dessous.</li>}
          {data.orgTags.map(t => {
            const on = selected.includes(t.id)
            return (
              <li key={t.id} className="flex items-center">
                <button onClick={() => toggle(t.id)} aria-pressed={on}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all', on ? 'text-white' : 'bg-white')}
                  style={on ? { backgroundColor: t.color, borderColor: t.color } : { color: t.color, borderColor: `${t.color}50` }}>
                  {on ? <Check size={14} /> : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />} {t.name}
                </button>
                {data.role === 'MANAGER' && (
                  <button onClick={() => remove(t.id, t.name)} aria-label={`Supprimer l’étiquette ${t.name}`} className="ml-0.5 rounded-full p-1 text-ink-subtle hover:text-danger"><Trash2 size={13} /></button>
                )}
              </li>
            )
          })}
        </ul>

        <div className="rounded-2xl border border-surface-line bg-surface-sunken p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Nouvelle étiquette</p>
          <div className="flex gap-2">
            <input value={name} onChange={e => setName(e.target.value)} maxLength={30} placeholder="Ex. Fauteuil roulant, Interprète, VIP"
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) create() }}
              className="h-10 min-w-0 flex-1 rounded-control border border-gray-200 bg-white px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <Button size="sm" icon={<Plus size={14} />} disabled={!name.trim()} onClick={create}>Créer</Button>
          </div>
          <div className="mt-2.5 flex gap-1.5" role="radiogroup" aria-label="Couleur">
            {TAG_COLORS.map(col => (
              <button key={col} role="radio" aria-checked={color === col} aria-label={`Couleur ${col}`} onClick={() => setColor(col)}
                className={cn('h-6 w-6 rounded-full ring-offset-2 transition-transform', color === col && 'scale-110 ring-2 ring-ink/40')} style={{ backgroundColor: col }} />
            ))}
          </div>
        </div>

        <Button fullWidth loading={busy} onClick={save}>Enregistrer</Button>
      </div>
    </Dialog>
  )
}

function FileSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="h-5 w-24 animate-pulse rounded bg-gray-100" />
      <div className="h-48 animate-pulse rounded-3xl bg-gray-100" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-card bg-gray-100" />)}</div>
      <div className="h-64 animate-pulse rounded-card bg-gray-100" />
    </div>
  )
}
