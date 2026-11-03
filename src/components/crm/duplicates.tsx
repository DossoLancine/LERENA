'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, GitMerge, Smartphone } from 'lucide-react'
import { findDuplicates, ignoreDuplicate, mergeDuplicate } from '@/server/actions/crm-insights'
import { Button, Dialog, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { CrmTabs, InsightsLocked } from './insights'
import { sinceLabel } from './parts'

type Data = Extract<NonNullable<Awaited<ReturnType<typeof findDuplicates>>>, { enabled: true }>
type Pair = Data['pairs'][number]
type Side = Pair['a']

/** Doublons possibles : comparer deux fiches, les fusionner, ou indiquer que ce sont deux personnes. */
export function DuplicatesPage() {
  const toast = useToast()
  const [data, setData] = useState<Awaited<ReturnType<typeof findDuplicates>> | undefined>(undefined)
  const [pair, setPair] = useState<Pair | null>(null)
  const [keep, setKeep] = useState<'a' | 'b'>('a')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => setData(await findDuplicates().catch(() => null)), [])
  useEffect(() => { load() }, [load])

  const open = (p: Pair) => {
    // Par défaut : la fiche la plus riche (compte, numéro, passages)
    const score = (s: Side) => (s.userId ? 100 : 0) + (s.phone ? 50 : 0) + s.visits
    setKeep(score(p.a) >= score(p.b) ? 'a' : 'b')
    setPair(p)
  }
  const merge = async () => {
    if (!pair) return
    const [k, r] = keep === 'a' ? [pair.a, pair.b] : [pair.b, pair.a]
    setBusy(true)
    const res = await mergeDuplicate(k.id, r.id)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Fiches fusionnées', 'success')
    setPair(null)
    load()
  }
  const ignore = async (p: Pair) => {
    const res = await ignoreDuplicate(p.a.id, p.b.id)
    if (!res.success) return toast(res.error, 'error')
    setPair(null)
    load()
  }

  return (
    <div className="space-y-5">
      <CrmTabs />
      {data === undefined ? <div className="h-64 animate-pulse rounded-3xl bg-gray-100" /> : !data ? null : !data.enabled ? <InsightsLocked what="Le pilotage, l’import et l’export des visiteurs" /> : (
        <>
          <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Doublons</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{data.total} <span className="text-ink-muted">doublon{data.total > 1 ? 's' : ''} possible{data.total > 1 ? 's' : ''}</span></h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-muted">Même nom (accents, majuscules et ordre des mots ignorés) sur deux fiches. Fusionnez si c’est la même personne : tout l’historique passe sur la fiche gardée.</p>
          </header>
          {data.pairs.length === 0 ? (
            <div className="flex flex-col items-center rounded-card border border-surface-line bg-white px-6 py-14 text-center shadow-card">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success"><CheckCircle2 size={26} /></span>
              <p className="mt-4 font-semibold text-ink">Aucun doublon repéré</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {data.pairs.map((p, i) => (
                <li key={`${p.a.id}-${p.b.id}`} className="animate-rise-in rounded-card border border-surface-line bg-white p-4 shadow-card" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{p.why}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">{[p.a, p.b].map(s => <SideCard key={s.id} s={s} />)}</div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => ignore(p)}>Deux personnes différentes</Button>
                    <Button size="sm" icon={<GitMerge size={14} />} onClick={() => open(p)}>Fusionner</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Dialog open={!!pair} onClose={() => setPair(null)} title="Fusionner deux fiches">
        {pair && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Choisissez la fiche à garder. L’autre est supprimée ; ses passages, rendez-vous, notes, étiquettes, suivis et avis rejoignent la fiche gardée.</p>
            <div className="space-y-2" role="radiogroup" aria-label="Fiche à garder">
              {(['a', 'b'] as const).map(k => (
                <button key={k} role="radio" aria-checked={keep === k} onClick={() => setKeep(k)} className={cn('block w-full rounded-2xl border-2 text-left', keep === k ? 'border-brand' : 'border-surface-line')}>
                  <SideCard s={pair[k]} bare />
                </button>
              ))}
            </div>
            <Button fullWidth loading={busy} onClick={merge}>Fusionner dans la fiche choisie</Button>
            <p className="text-center text-xs text-ink-subtle">Action inscrite au journal. Elle ne peut pas être annulée.</p>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function SideCard({ s, bare }: { s: Side; bare?: boolean }) {
  return (
    <div className={cn('p-3 text-sm', !bare && 'rounded-2xl bg-surface-sunken')}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        {bare ? s.name : <Link href={`/dashboard/visitors/${s.id}`} className="hover:text-brand">{s.name}</Link>}
        {s.userId && <span className="inline-flex items-center gap-0.5 text-[11px] font-normal text-ink-muted"><Smartphone size={11} /> compte</span>}
      </p>
      <p className="mt-0.5 font-mono text-xs text-ink-muted">{s.phone ?? 'Sans numéro'}</p>
      <p className="mt-1 text-xs text-ink-muted">
        {s.visits} passage{s.visits > 1 ? 's' : ''}{s.lastVisitAt ? ` · venu ${sinceLabel(s.lastVisitAt)}` : ''} · {s._count.notes} note{s._count.notes > 1 ? 's' : ''} · {s._count.tags} étiquette{s._count.tags > 1 ? 's' : ''}{s.consentAt ? ' · accord SMS' : ''}
      </p>
    </div>
  )
}
