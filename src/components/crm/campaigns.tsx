'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Send, Plus, Users, CalendarClock, Lock, Search, X, Copy, Ban, ShieldCheck, MessageSquare } from 'lucide-react'
import { cancelCampaign, countAudience, createCampaign, getCampaign, getCampaigns, getComposer, getReachableByIds, searchReachable } from '@/server/actions/campaigns'
import { MAX_BODY, TEMPLATES, VARIABLES, renderMessage, smsParts, stopFooter } from '@/lib/campaign-text'
import { SEGMENT_LABELS } from '@/lib/customer-labels'
import type { CustomerSegment } from '@/lib/customer-segments'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { TagChip } from './parts'

const STATUS: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  SCHEDULED: { label: 'Programmée', tone: 'info' },
  SENDING: { label: 'En cours d’envoi', tone: 'warning' },
  SENT: { label: 'Envoyée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' }
}
const when = (d: Date | string) => new Date(d).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Locked() {
  return (
    <div className="flex flex-col items-center rounded-card border border-surface-line bg-white px-6 py-14 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Lock size={24} /></span>
      <p className="mt-4 font-semibold text-ink">Les campagnes SMS sont incluses à partir du forfait Pro</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">Prévenez vos visiteurs d’une fermeture, d’une campagne de vaccination ou d’un nouveau service, en quelques minutes.</p>
      <Link href="/dashboard/billing" className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Voir les forfaits</Link>
    </div>
  )
}

function Hero({ eyebrow, title, children }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{eyebrow}</p>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
      {children}
    </header>
  )
}

// ---- Liste ----

export function CampaignsList() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCampaigns>> | undefined>(undefined)
  useEffect(() => { getCampaigns().then(setData).catch(() => setData(null)) }, [])
  if (data === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (!data) return null
  if (!data.enabled) return <div className="space-y-5"><Hero eyebrow="Campagnes" title="Messages à vos visiteurs" /><Locked /></div>

  const pct = data.total ? Math.round((data.reachable / data.total) * 100) : 0
  return (
    <div className="space-y-5">
      <Hero eyebrow="Campagnes" title={<>{data.reachable} <span className="text-ink-muted">visiteur{data.reachable > 1 ? 's' : ''} joignable{data.reachable > 1 ? 's' : ''}</span></>}>
        <p className="mt-1 max-w-xl text-sm text-ink-muted">
          {data.reachable} sur {data.total} ont accepté vos messages ({pct} %). Ils donnent leur accord depuis leur ticket ou à l’accueil ; chaque SMS contient un lien STOP.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href="/dashboard/campaigns/new" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"><Plus size={16} /> Nouvelle campagne</Link>
          <span className="rounded-xl bg-white/80 px-3 py-2 text-sm text-ink-muted"><strong className="tabular-nums text-ink">{data.balance.total}</strong> SMS disponibles</span>
        </div>
      </Hero>

      <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
        {data.campaigns.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-ink">Aucune campagne pour l’instant</p>
            <p className="mt-1 text-sm text-ink-muted">Partez d’un modèle : fermeture exceptionnelle, documents prêts, vaccination…</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-line">
            {data.campaigns.map((c, i) => {
              const done = c.sent + c.failed + c.skipped
              return (
                <li key={c.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                  <Link href={`/dashboard/campaigns/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-surface-sunken/60">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2"><span className="truncate font-semibold text-ink">{c.name}</span><Badge tone={STATUS[c.status]?.tone ?? 'neutral'}>{STATUS[c.status]?.label ?? c.status}</Badge></p>
                      <p className="mt-0.5 text-xs text-ink-muted">{c.status === 'SCHEDULED' ? `Prévue ${when(c.scheduledAt)}` : `Lancée ${when(c.scheduledAt)}`}{c.createdByName ? ` · ${c.createdByName}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-5 text-right text-xs text-ink-muted">
                      <span><span className="block font-display text-lg font-bold tabular-nums text-ink">{c.sent}<span className="text-ink-subtle">/{c.recipients}</span></span>envoyés</span>
                      {c.unsubscribed > 0 && <span><span className="block font-display text-lg font-bold tabular-nums text-ink">{c.unsubscribed}</span>STOP</span>}
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 sm:block" aria-hidden="true">
                        <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${c.recipients ? (done / c.recipients) * 100 : 0}%` }} />
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

// ---- Nouvelle campagne ----

type Composer = Extract<NonNullable<Awaited<ReturnType<typeof getComposer>>>, { enabled: true }>
type Mode = 'segment' | 'tag' | 'selection'

export function CampaignComposer() {
  const router = useRouter()
  const params = useSearchParams()
  const toast = useToast()
  const [data, setData] = useState<Awaited<ReturnType<typeof getComposer>> | undefined>(undefined)
  const [mode, setMode] = useState<Mode>('segment')
  const [segment, setSegment] = useState<CustomerSegment>('all')
  const [tagId, setTagId] = useState<string | null>(null)
  const [picked, setPicked] = useState<{ id: string; name: string | null; phone: string | null }[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<typeof picked>([])
  const [count, setCount] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [schedule, setSchedule] = useState(false)
  const [at, setAt] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { getComposer().then(setData).catch(() => setData(null)) }, [])
  // Dupliquer une campagne : on repart de son message
  useEffect(() => {
    const from = params.get('from')
    if (from) getCampaign(from).then(c => { if (c) { setBody(c.body); setName(`${c.name} (copie)`) } }).catch(() => null)
    // Visiteurs choisis ailleurs (clients à risque) : seuls ceux qui acceptent vos messages sont repris
    const ids = params.get('customers')?.split(',').filter(Boolean)
    if (ids?.length) getReachableByIds(ids).then(list => { setMode('selection'); setPicked(list); if (!name) setName('Relance des clients à risque') }).catch(() => null)
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps

  const target = useMemo(() => (
    mode === 'segment' ? { segment } : mode === 'tag' ? { tagId } : { customerIds: picked.map(p => p.id) }
  ), [mode, segment, tagId, picked])

  useEffect(() => {
    if (mode === 'segment' && data?.enabled) { setCount(data.segmentCounts[segment]); return }
    if (mode === 'selection') { setCount(picked.length); return }
    if (mode === 'tag' && !tagId) { setCount(0); return }
    setCount(null)
    countAudience(target).then(setCount).catch(() => setCount(0))
  }, [mode, segment, tagId, picked, target, data])

  useEffect(() => {
    if (mode !== 'selection' || q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => searchReachable(q).then(setResults).catch(() => null), 250)
    return () => clearTimeout(t)
  }, [q, mode])

  if (data === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (!data) return null
  if (!data.enabled) return <div className="space-y-5"><Back /><Locked /></div>
  const d: Composer = data

  const sample = { firstName: d.sample?.firstName ?? 'Aya', orgName: d.orgName, link: d.link, service: d.sample?.service ?? 'Consultation', nextDate: d.sample?.nextDate ?? null }
  const preview = body.trim() ? renderMessage(body, sample) + stopFooter(d.appBase, 'a1b2c3d4e5') : ''
  const parts = smsParts(preview)
  const n = (count ?? 0) * Math.max(1, parts.parts)
  const enough = d.balance.total >= n
  const placeholders = /\[[^\]]+\]/.test(body)
  const scheduledIso = schedule && at ? new Date(at).toISOString() : null
  const canSend = n > 0 && body.trim().length >= 10 && enough && !placeholders && (!schedule || !!at)

  const insert = (key: string) => {
    const el = area.current
    if (!el) return setBody(b => b + key)
    const start = el.selectionStart ?? body.length
    const next = body.slice(0, start) + key + body.slice(el.selectionEnd ?? start)
    setBody(next.slice(0, MAX_BODY))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + key.length, start + key.length) })
  }

  const send = async () => {
    setBusy(true)
    const res = await createCampaign({ name, body, target, scheduledAt: scheduledIso })
    setBusy(false)
    if (!res.success) { setConfirm(false); return toast(res.error, 'error') }
    toast(schedule ? 'Campagne programmée' : 'Envoi lancé', 'success')
    router.push(`/dashboard/campaigns/${res.id}`)
  }

  return (
    <div className="space-y-5">
      <Back />
      <Hero eyebrow="Nouvelle campagne" title="Prévenir vos visiteurs" />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* 1. Destinataires */}
          <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Users size={16} className="text-brand" /> 1. Destinataires</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Seuls les visiteurs qui ont accepté vos messages et n’ont pas répondu STOP sont comptés.</p>
            <div className="mt-4 inline-flex rounded-xl bg-surface-sunken p-1 text-sm font-semibold" role="radiogroup" aria-label="Type de cible">
              {([['segment', 'Segment'], ['tag', 'Étiquette'], ['selection', 'Sélection']] as const).map(([m, l]) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('rounded-lg px-3 py-1.5', mode === m ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>{l}</button>
              ))}
            </div>
            <div className="mt-4">
              {mode === 'segment' && (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(SEGMENT_LABELS) as CustomerSegment[]).map(s => (
                    <button key={s} onClick={() => setSegment(s)} aria-pressed={segment === s} title={SEGMENT_LABELS[s].hint}
                      className={cn('flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold', segment === s ? 'border-ink bg-ink text-white' : 'border-surface-line text-ink-muted hover:text-ink')}>
                      {SEGMENT_LABELS[s].label}<span className={cn('rounded-full px-1.5 text-xs tabular-nums', segment === s ? 'bg-white/20' : 'bg-gray-100')}>{d.segmentCounts[s]}</span>
                    </button>
                  ))}
                </div>
              )}
              {mode === 'tag' && (d.tags.length === 0 ? <p className="text-sm text-ink-subtle">Aucune étiquette : créez-en depuis une fiche visiteur.</p> : (
                <div className="flex flex-wrap gap-2">
                  {d.tags.map(t => (
                    <button key={t.id} onClick={() => setTagId(t.id)} aria-pressed={tagId === t.id} className={cn('rounded-full transition-opacity', tagId && tagId !== t.id && 'opacity-45')}><TagChip tag={t} /></button>
                  ))}
                </div>
              ))}
              {mode === 'selection' && (
                <div className="space-y-3">
                  <label className="relative block">
                    <span className="sr-only">Chercher un visiteur</span>
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou numéro" className="h-10 w-full rounded-control border border-gray-200 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </label>
                  {results.length > 0 && (
                    <ul className="divide-y divide-surface-line rounded-xl border border-surface-line">
                      {results.filter(r => !picked.some(p => p.id === r.id)).map(r => (
                        <li key={r.id}><button onClick={() => { setPicked(p => [...p, r]); setQ('') }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-sunken">
                          <span className="font-semibold text-ink">{r.name || 'Sans nom'}</span><span className="text-xs text-ink-muted">{r.phone}</span>
                        </button></li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {picked.map(p => (
                      <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-semibold text-ink">
                        {p.name || p.phone}<button onClick={() => setPicked(list => list.filter(x => x.id !== p.id))} aria-label={`Retirer ${p.name ?? ''}`}><X size={12} /></button>
                      </span>
                    ))}
                    {picked.length === 0 && <span className="text-xs text-ink-subtle">Cherchez puis ajoutez des visiteurs.</span>}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2. Message */}
          <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><MessageSquare size={16} className="text-brand" /> 2. Message</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setBody(t.body); if (!name) setName(t.label) }} className="rounded-full border border-surface-line px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-brand hover:text-ink">{t.label}</button>
              ))}
            </div>
            <input value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="Nom de la campagne (pour vous)"
              className="mt-4 h-10 w-full rounded-control border border-gray-200 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <textarea ref={area} value={body} onChange={e => setBody(e.target.value.slice(0, MAX_BODY))} rows={5} placeholder="Bonjour {prénom}, …"
              className="mt-3 w-full resize-none rounded-control border border-gray-200 px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-ink-subtle">Insérer :</span>
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => insert(v.key)} className="rounded-md bg-brand-50 px-2 py-1 font-mono text-[11px] font-semibold text-brand-700 hover:bg-brand-100">{v.key}</button>
              ))}
            </div>
            {placeholders && <p className="mt-2 text-xs font-semibold text-warning-ink">Remplacez les passages entre crochets [ ] avant l’envoi.</p>}
          </section>

          {/* 3. Envoi */}
          <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
            <h2 className="flex items-center gap-2 font-semibold text-ink"><CalendarClock size={16} className="text-brand" /> 3. Envoi</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[{ v: false, l: 'Maintenant' }, { v: true, l: 'Programmer' }].map(o => (
                <button key={o.l} onClick={() => setSchedule(o.v)} aria-pressed={schedule === o.v} className={cn('rounded-xl border px-4 py-2 text-sm font-semibold', schedule === o.v ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted')}>{o.l}</button>
              ))}
              {schedule && <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="h-10 rounded-control border border-gray-200 px-3 text-sm" />}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">Les SMS partent entre 8 h et 20 h. {!schedule && !d.sendingHours ? `Lancée maintenant, la campagne partira ${new Date().getUTCHours() < 8 ? 'à' : 'demain à'} 8 h.` : ''}</p>
          </section>
        </div>

        {/* Aperçu et coût */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
          <div className="rounded-[28px] bg-ink p-3 shadow-card">
            <div className="rounded-[20px] bg-[#f4f1ee] p-4">
              <p className="text-center text-[11px] font-semibold text-ink-subtle">Aperçu{d.sample?.firstName ? ` pour ${d.sample.firstName}` : ''}</p>
              <div className="mt-3 min-h-[120px]">
                {preview ? (
                  <p className="animate-rise-in whitespace-pre-line rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink shadow-sm [overflow-wrap:anywhere]">{preview}</p>
                ) : <p className="pt-8 text-center text-xs text-ink-subtle">Votre message apparaîtra ici</p>}
              </div>
              {preview && <p className={cn('mt-2 text-center text-[11px]', parts.parts > 1 ? 'text-warning-ink' : 'text-ink-subtle')}>{parts.length} caractères{parts.parts > 1 ? ` · arrive en ${parts.parts} parties` : ''}</p>}
              {preview && parts.unicode && <p className="mt-1 text-center text-[11px] text-ink-subtle">Émoji ou caractères spéciaux : 70 caractères par partie au lieu de 160.</p>}
            </div>
          </div>
          <div className="rounded-card border border-surface-line bg-white p-5 shadow-card">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Destinataires</dt><dd className="font-display text-lg font-bold tabular-nums text-ink">{count ?? '…'}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">SMS utilisés{parts.parts > 1 ? ` (${parts.parts} parties chacun)` : ''}</dt><dd className="font-semibold tabular-nums text-ink">{n}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">Disponibles</dt><dd className={cn('font-semibold tabular-nums', enough ? 'text-ink' : 'text-danger')}>{d.balance.total}</dd></div>
            </dl>
            {!enough && <p className="mt-3 text-xs font-semibold text-danger">Pas assez de SMS : achetez un pack dans Abonnement → Boutique.</p>}
            <Button fullWidth className="mt-4" icon={<Send size={15} />} disabled={!canSend} onClick={() => setConfirm(true)}>
              {schedule ? 'Programmer' : `Envoyer à ${n} visiteur${n > 1 ? 's' : ''}`}
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-subtle"><ShieldCheck size={13} className="mt-px shrink-0" /> Lien STOP ajouté automatiquement à chaque SMS.</p>
          </div>
        </aside>
      </div>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={schedule ? 'Programmer la campagne ?' : 'Envoyer maintenant ?'}>
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {n} visiteur{n > 1 ? 's' : ''} recevr{n > 1 ? 'ont' : 'a'} ce SMS{schedule && at ? ` le ${when(new Date(at))}` : ''}. {n} SMS seront décomptés.
          </p>
          <p className="whitespace-pre-line rounded-2xl bg-surface-sunken p-3 text-sm text-ink [overflow-wrap:anywhere]">{preview}</p>
          <Button fullWidth loading={busy} onClick={send}>{schedule ? 'Programmer' : 'Envoyer'}</Button>
        </div>
      </Dialog>
    </div>
  )
}

function Back() {
  return <Link href="/dashboard/campaigns" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Campagnes</Link>
}

// ---- Suivi d'une campagne ----

type Detail = NonNullable<Awaited<ReturnType<typeof getCampaign>>>
const RECIPIENT: Record<string, { label: string; tone: 'success' | 'danger' | 'neutral' | 'warning' | 'info' }> = {
  PENDING: { label: 'En attente', tone: 'neutral' }, SENDING: { label: 'Envoi…', tone: 'info' }, SENT: { label: 'Envoyé', tone: 'success' },
  FAILED: { label: 'Échec', tone: 'danger' }, SKIPPED: { label: 'Non envoyé', tone: 'warning' }
}

export function CampaignDetail({ id }: { id: string }) {
  const toast = useToast()
  const [data, setData] = useState<Detail | null | undefined>(undefined)
  const load = useCallback(async () => setData(await getCampaign(id).catch(() => null)), [id])
  useEffect(() => { load() }, [load])
  // Tant qu'elle est en cours, la page fait avancer l'envoi et rafraîchit les compteurs
  const live = data && (data.status === 'SENDING' || (data.status === 'SCHEDULED' && new Date(data.scheduledAt) <= new Date()))
  useEffect(() => {
    if (!live) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [live, load])

  if (data === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (data === null) return <div className="space-y-5"><Back /><p className="rounded-card bg-white p-10 text-center text-sm text-ink-muted shadow-card">Campagne introuvable.</p></div>

  const done = data.sent + data.failed + data.skipped
  const pct = data.recipients ? Math.round((done / data.recipients) * 100) : 0
  const cancel = async () => {
    if (!window.confirm('Annuler la campagne ? Les SMS pas encore partis ne partiront pas.')) return
    const res = await cancelCampaign(id)
    if (!res.success) toast(res.error, 'error')
    load()
  }
  const target = data.targetLabel.selection ? `${data.targetLabel.selection} visiteurs choisis` : data.targetLabel.tag ? `Étiquette « ${data.targetLabel.tag} »` : `Segment « ${SEGMENT_LABELS[data.targetLabel.segment as CustomerSegment]?.label ?? 'Tous'} »`

  return (
    <div className="space-y-5">
      <Back />
      <Hero eyebrow={STATUS[data.status]?.label ?? data.status} title={data.name}>
        <p className="mt-1 text-sm text-ink-muted">{target} · {data.status === 'SCHEDULED' ? `prévue ${when(data.scheduledAt)}` : `lancée ${when(data.startedAt ?? data.scheduledAt)}`}{data.createdByName ? ` · ${data.createdByName}` : ''}</p>
        <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#fb923c] to-brand transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {live && !data.sendingHours && <p className="mt-2 text-xs text-ink-muted">En pause jusqu’à 8 h (pas de SMS la nuit).</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {(data.status === 'SCHEDULED' || data.status === 'SENDING') && <Button size="sm" variant="secondary" icon={<Ban size={14} />} onClick={cancel}>Annuler</Button>}
          <Link href={`/dashboard/campaigns/new?from=${data.id}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-ink"><Copy size={14} /> Dupliquer</Link>
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { l: 'Destinataires', v: data.recipients }, { l: 'Envoyés', v: data.sent }, { l: 'Échecs', v: data.failed, bad: data.failed > 0 },
          { l: 'Non envoyés', v: data.skipped, bad: data.skipped > 0 }, { l: 'Désinscriptions', v: data.unsubscribed }
        ].map(s => (
          <div key={s.l} className="rounded-card border border-surface-line bg-white p-4 shadow-card">
            <p className="text-xs text-ink-muted">{s.l}</p>
            <p className={cn('mt-1 font-display text-3xl font-bold tabular-nums', s.bad ? 'text-warning-ink' : 'text-ink')}>{s.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
          <h2 className="border-b border-surface-line px-5 py-3.5 font-semibold text-ink">Destinataires</h2>
          <ul className="max-h-[480px] divide-y divide-surface-line overflow-y-auto">
            {data.sends.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                {r.customer ? <Link href={`/dashboard/visitors/${r.customer.id}`} className="min-w-0 flex-1 truncate font-semibold text-ink hover:text-brand">{r.customer.name || r.customer.phone}</Link> : <span className="flex-1 text-ink-subtle">Fiche supprimée</span>}
                {r.error && <span className="hidden truncate text-xs text-ink-subtle sm:inline">{r.error}</span>}
                <Badge tone={RECIPIENT[r.status]?.tone ?? 'neutral'}>{RECIPIENT[r.status]?.label ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
        <aside className="h-fit rounded-card border border-surface-line bg-white p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Message</p>
          <p className="mt-2 whitespace-pre-line rounded-2xl bg-surface-sunken p-3 text-sm text-ink [overflow-wrap:anywhere]">{data.body}</p>
          <p className="mt-2 text-[11px] text-ink-subtle">Variables remplacées pour chaque visiteur, lien STOP ajouté à la fin.</p>
        </aside>
      </div>
    </div>
  )
}
