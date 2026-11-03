'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, ChevronRight, Star, CalendarX2, Tag as TagIcon, X, Contact } from 'lucide-react'
import { listCustomers, createCustomer, type CustomerSegment, type CustomerSort } from '@/server/actions/customers'
import { SEGMENT_LABELS } from '@/lib/customer-labels'
import { Button, Dialog, TextInput, useToast } from '@/components/ui'
import PhoneInput from '@/components/ui/phone-input'
import { cn } from '@/lib/cn'
import { TagChip, Initials, sinceLabel } from './parts'

type Data = NonNullable<Awaited<ReturnType<typeof listCustomers>>>

const SORTS: { id: CustomerSort; label: string }[] = [
  { id: 'recent', label: 'Dernier passage' },
  { id: 'visits', label: 'Nombre de passages' },
  { id: 'noshows', label: 'Absences' },
  { id: 'name', label: 'Nom' }
]

/** Fichier visiteurs : recherche, segments prêts à l'emploi, étiquettes. Commun au tableau de bord et à l'accueil. */
export function VisitorsList({ basePath }: { basePath: string }) {
  const router = useRouter()
  const toast = useToast()
  const [segment, setSegment] = useState<CustomerSegment>('all')
  const [tagId, setTagId] = useState<string | null>(null)
  const [sort, setSort] = useState<CustomerSort>('recent')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<Data | null>(null)
  const [items, setItems] = useState<Data['items']>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(async (p: number) => {
    const id = ++reqId.current
    setLoading(true)
    const res = await listCustomers({ segment, tagId, q, sort, page: p }).catch(() => null)
    if (id !== reqId.current) return
    setLoading(false)
    if (!res) return
    setData(res)
    setItems(prev => (p === 0 ? res.items : [...prev, ...res.items]))
  }, [segment, tagId, q, sort])

  // Recherche : petite attente pendant la frappe
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load(0) }, q ? 280 : 0)
    return () => clearTimeout(timer)
  }, [load, q])

  const create = async () => {
    setCreating(true)
    const res = await createCustomer({ name: newName, phone: newPhone })
    setCreating(false)
    if (!res.success) return toast(res.error, 'error')
    setShowNew(false)
    setNewName(''); setNewPhone('')
    router.push(`${basePath}/${res.id}`)
  }

  const activeTag = data?.tags.find(t => t.id === tagId)

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Fichier visiteurs</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {data ? data.counts.all.toLocaleString('fr-FR') : '…'} <span className="text-ink-muted">{data?.counts.all === 1 ? 'visiteur' : 'visiteurs'}</span>
            </h1>
            <p className="mt-1 max-w-md text-sm text-ink-muted">Chaque ticket et chaque rendez-vous complète la fiche du visiteur, sans saisie.</p>
          </div>
          <Button icon={<UserPlus size={16} />} onClick={() => setShowNew(true)}>Nouvelle fiche</Button>
        </div>

        {/* Recherche */}
        <label className="relative mt-5 block">
          <span className="sr-only">Rechercher un visiteur</span>
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <input
            value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou numéro de téléphone"
            className="h-12 w-full rounded-2xl border border-white/70 bg-white/90 pl-11 pr-10 text-sm text-ink shadow-sm placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          {q && <button onClick={() => setQ('')} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-subtle hover:bg-gray-100"><X size={16} /></button>}
        </label>
      </header>

      {/* Segments */}
      <nav aria-label="Segments" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {(Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map(s => {
          const active = segment === s && !tagId
          return (
            <button key={s} onClick={() => { setSegment(s); setTagId(null) }} title={SEGMENT_LABELS[s].hint} aria-pressed={active}
              className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                active ? 'border-ink bg-ink text-white' : 'border-surface-line bg-white text-ink-muted hover:border-gray-300 hover:text-ink')}>
              {SEGMENT_LABELS[s].label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/20' : 'bg-gray-100')}>{data?.counts[s] ?? '·'}</span>
            </button>
          )
        })}
      </nav>

      {/* Étiquettes et tri */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {data && data.tags.length > 0 && <TagIcon size={14} className="mr-1 text-ink-subtle" aria-hidden="true" />}
          {data?.tags.map(t => (
            <button key={t.id} onClick={() => setTagId(tagId === t.id ? null : t.id)} aria-pressed={tagId === t.id}
              className={cn('rounded-full transition-opacity', tagId && tagId !== t.id && 'opacity-45')}>
              <TagChip tag={t} suffix={t.count} />
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          Trier par
          <select value={sort} onChange={e => setSort(e.target.value as CustomerSort)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-ink">
            {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      {/* Liste */}
      <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-surface-line px-4 py-3 text-xs text-ink-muted">
          <span>
            {activeTag ? <>Étiquette <strong className="text-ink">{activeTag.name}</strong></> : <strong className="text-ink">{SEGMENT_LABELS[segment].label}</strong>}
            {' · '}{SEGMENT_LABELS[activeTag ? 'all' : segment].hint.toLowerCase()}
          </span>
          {data && <span className="tabular-nums">{data.total.toLocaleString('fr-FR')} résultat{data.total > 1 ? 's' : ''}</span>}
        </div>

        {loading && items.length === 0 ? (
          <ul aria-busy="true" className="divide-y divide-surface-line">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-4">
                <span className="h-10 w-10 animate-pulse rounded-full bg-gray-100" />
                <span className="h-4 w-40 animate-pulse rounded bg-gray-100" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Contact size={26} /></span>
            <p className="mt-4 font-semibold text-ink">{q ? `Aucun visiteur pour « ${q} »` : 'Personne dans ce segment pour le moment'}</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              {q ? 'Vérifiez l’orthographe ou cherchez par numéro.' : 'Les fiches se créent toutes seules dès qu’un visiteur prend un ticket ou un rendez-vous avec son numéro.'}
            </p>
          </div>
        ) : (
          <ul className={cn('divide-y divide-surface-line transition-opacity', loading && 'opacity-60')}>
            {items.map((c, i) => (
              <li key={c.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <Link href={`${basePath}/${c.id}`} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-surface-sunken/60">
                  <Initials name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-semibold text-ink">{c.name || 'Sans nom'}</span>
                      {c.tags.slice(0, 3).map(t => <TagChip key={t.id} tag={t} small />)}
                      {c.tags.length > 3 && <span className="text-[11px] text-ink-subtle">+{c.tags.length - 3}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {c.phone ?? 'Sans numéro'}{c.lastVisitAt ? ` · venu ${sinceLabel(c.lastVisitAt)}` : ' · pas encore venu'}
                    </p>
                  </div>
                  <div className="hidden items-center gap-4 text-right sm:flex">
                    {c.noShows > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-warning-ink" title="Absences">
                        <CalendarX2 size={14} aria-hidden="true" />{c.noShows}
                      </span>
                    )}
                    {c.lastRating != null && (
                      <span className={cn('flex items-center gap-1 text-xs font-semibold', c.lastRating <= 2 ? 'text-danger' : 'text-ink-muted')} title="Dernière note">
                        <Star size={14} aria-hidden="true" className={c.lastRating <= 2 ? 'fill-danger' : 'fill-amber-400 text-amber-500'} />{c.lastRating}
                      </span>
                    )}
                    <span className="w-20">
                      <span className="block font-display text-xl font-bold tabular-nums text-ink">{c.visits}</span>
                      <span className="block text-[11px] text-ink-subtle">passage{c.visits > 1 ? 's' : ''}</span>
                    </span>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {data?.more && (
          <div className="border-t border-surface-line p-3 text-center">
            <Button variant="ghost" loading={loading} onClick={() => { const p = page + 1; setPage(p); load(p) }}>Afficher plus</Button>
          </div>
        )}
      </section>

      <Dialog open={showNew} onClose={() => setShowNew(false)} title="Nouvelle fiche visiteur">
        <div className="space-y-4">
          <TextInput label="Nom" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex. Aya Koné" />
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">Téléphone</span>
            <PhoneInput value={newPhone} onChange={setNewPhone} />
            <p className="text-xs text-ink-subtle">Si ce numéro est déjà connu, sa fiche s’ouvre.</p>
          </div>
          <Button fullWidth loading={creating} disabled={!newPhone} onClick={create}>Créer la fiche</Button>
        </div>
      </Dialog>
    </div>
  )
}
