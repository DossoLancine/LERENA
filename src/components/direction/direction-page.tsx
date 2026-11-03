'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Gauge, Users, Wallet, Settings2, Trophy, Clock, Star, AlertTriangle, MessageSquareText, Printer, ArrowRight } from 'lucide-react'
import { getBeforeAfter, getDirection, getDirectionSettings, saveDirectionSettings } from '@/server/actions/direction'
import { Badge, Button, Dialog, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { fcfa } from '@/lib/billing-labels'

type Data = NonNullable<Awaited<ReturnType<typeof getDirection>>>
type Tab = 'sites' | 'team' | 'value' | 'before'
const DOT = { green: 'bg-success', orange: 'bg-warning', red: 'bg-danger' }
const STATUS_LABEL = { green: 'Tout va bien', orange: 'À surveiller', red: 'En difficulté' }
const n1 = (v: number | null, unit = '') => (v == null ? '—' : `${String(Math.round(v * 10) / 10).replace('.', ',')}${unit}`)

/** Vue direction : sites, équipe, valeur en FCFA, avant / après. */
export function DirectionPage() {
  const [tab, setTab] = useState<Tab>('sites')
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null | undefined>(undefined)
  const [settings, setSettings] = useState(false)
  const load = useCallback(async () => setData(await getDirection(days).catch(() => null)), [days])
  useEffect(() => { load() }, [load])

  if (data === undefined) return <div className="h-72 animate-pulse rounded-3xl bg-gray-100" />
  if (data === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès à la vue direction.</p>

  const red = data.sites.filter(s => s.status === 'red').length
  const orange = data.sites.filter(s => s.status === 'orange').length

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7 print:hidden">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"><Gauge size={14} /> Direction{data.scoped ? ' · vos sites' : ''}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {red ? `${red} site${red > 1 ? 's' : ''} en difficulté` : orange ? `${orange} site${orange > 1 ? 's' : ''} à surveiller` : data.sites.length > 1 ? 'Tous vos sites vont bien' : 'Votre site va bien'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">En direct, sur 30 jours et en FCFA : ce qui compte pour piloter, sur un seul écran.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <nav className="inline-flex rounded-xl bg-white/80 p-1 text-sm font-semibold" aria-label="Vue direction">
            {([['sites', 'Sites', Gauge], ['team', 'Équipe', Users], ['value', 'Valeur en FCFA', Wallet], ['before', 'Avant / après', Clock]] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', tab === id ? 'bg-ink text-white' : 'text-ink-muted')}><Icon size={14} /> {label}</button>
            ))}
          </nav>
          {data.canEdit && <Button size="sm" variant="secondary" icon={<Settings2 size={14} />} onClick={() => setSettings(true)}>Objectifs et valeurs</Button>}
        </div>
      </header>

      {tab === 'sites' && <SitesTab data={data} />}
      {tab === 'team' && <TeamTab data={data} days={days} setDays={setDays} />}
      {tab === 'value' && <ValueTab data={data} onSettings={() => setSettings(true)} />}
      {tab === 'before' && <BeforeAfterTab canEdit={data.canEdit} onSettings={() => setSettings(true)} />}
      {settings && <SettingsDialog onClose={() => setSettings(false)} onSaved={() => { setSettings(false); load() }} />}
    </div>
  )
}

function SitesTab({ data }: { data: Data }) {
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {data.sites.map((s, i) => (
        <li key={s.id} className="animate-rise-in rounded-card border border-surface-line bg-white p-5 shadow-card" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-display text-lg font-bold text-ink"><span className={cn('h-3 w-3 shrink-0 rounded-full', DOT[s.status], s.status === 'red' && 'animate-pulse')} aria-hidden="true" />{s.name}</p>
              <p className="text-xs text-ink-muted">{STATUS_LABEL[s.status]}{s.reasons.length ? ` : ${s.reasons.join(', ')}` : ''}</p>
            </div>
            <Link href="/dashboard/queue" className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-50">File</Link>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ['En attente', String(s.waitingNow), s.waitNow ? `depuis ${s.waitNow} min` : 'personne'],
              ['Aujourd’hui', String(s.visitorsToday), s.waitToday != null ? `attente ${n1(s.waitToday, ' min')}` : 'visiteurs'],
              ['Avis à traiter', String(s.openComplaints), s.openComplaints ? 'à traiter' : 'aucun']
            ].map(([l, v, h]) => (
              <div key={l} className="rounded-xl bg-surface-sunken px-2 py-2.5"><dt className="text-[11px] text-ink-muted">{l}</dt><dd className="font-display text-2xl font-bold tabular-nums text-ink">{v}</dd><dd className="text-[11px] text-ink-subtle">{h}</dd></div>
            ))}
          </dl>
          <div className="mt-4 space-y-2.5">
            <Objective label="Attente moyenne (30 j)" value={s.wait30} target={s.targets.waitMin} unit=" min" lowerIsBetter />
            <Objective label="Satisfaction (30 j)" value={s.satisfaction30} target={s.targets.satisfaction} unit="/5" />
          </div>
          <p className="mt-3 text-[11px] text-ink-subtle">{s.visitors30} visiteurs sur 30 jours · {s.counters} guichet{s.counters > 1 ? 's' : ''} actif{s.counters > 1 ? 's' : ''}{s.noShowRate30 != null ? ` · ${s.noShowRate30} % d’absences aux RDV` : ''}{s.targets.custom ? '' : ' · objectifs proposés pour votre secteur'}</p>
        </li>
      ))}
    </ul>
  )
}

function Objective({ label, value, target, unit, lowerIsBetter }: { label: string; value: number | null; target: number; unit: string; lowerIsBetter?: boolean }) {
  const ok = value == null ? null : lowerIsBetter ? value <= target : value >= target
  const pct = value == null ? 0 : lowerIsBetter ? Math.min(100, (target / Math.max(value, 0.1)) * 100) : Math.min(100, (value / target) * 100)
  return (
    <div>
      <p className="flex items-center justify-between text-xs"><span className="text-ink-muted">{label}</span><span className="font-semibold tabular-nums text-ink">{n1(value, unit)} <span className="font-normal text-ink-subtle">· objectif {n1(target, unit)}</span>{ok != null && <Badge tone={ok ? 'success' : 'warning'} className="ml-1.5">{ok ? 'atteint' : 'pas encore'}</Badge>}</span></p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className={cn('h-full rounded-full transition-all duration-700', ok ? 'bg-success' : 'bg-warning')} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function TeamTab({ data, days, setDays }: { data: Data; days: number; setDays: (d: number) => void }) {
  const r = data.ranking
  const ranked = r.agents.filter(a => a.eligible)
  const others = r.agents.filter(a => !a.eligible)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">Comparaison équitable : la vitesse est rapportée à la moyenne du même service (100 = moyenne). Minimum 20 visiteurs servis pour être classé.</p>
        <div className="inline-flex rounded-xl bg-surface-sunken p-1 text-xs font-semibold">
          {[7, 30, 90].map(d => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={cn('rounded-lg px-3 py-1.5', days === d ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>{d} jours</button>)}
        </div>
      </div>
      {ranked.length > 0 && (
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Trophy size={16} className="text-amber-500" /> Équipe du mois</h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {ranked.slice(0, 3).map((a, i) => (
              <li key={a.id} className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 ring-1 ring-amber-100">
                <p className="font-display text-2xl font-bold text-amber-600">{i + 1}</p>
                <p className="font-semibold text-ink">{a.name}</p>
                <p className="mt-1 text-xs text-ink-muted">{a.served} servis · vitesse {a.speed ?? '—'} · {a.satisfaction != null ? `${n1(a.satisfaction)}/5` : 'pas encore de note'}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="overflow-x-auto rounded-card border border-surface-line bg-white shadow-card">
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="border-b border-surface-line text-left text-xs text-ink-muted">
            {['Agent', 'Visiteurs servis', 'Durée moyenne', 'Vitesse', 'Satisfaction', 'Avis négatifs'].map(h => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-surface-line">
            {ranked.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ink-subtle">Personne n’a encore servi 20 visiteurs sur la période.</td></tr>}
            {ranked.map(a => (
              <tr key={a.id}>
                <th scope="row" className="px-4 py-2.5 text-left font-semibold text-ink">{a.name}</th>
                <td className="px-4 py-2.5 tabular-nums">{a.served}</td>
                <td className="px-4 py-2.5 tabular-nums">{n1(a.avgMin, ' min')}</td>
                <td className={cn('px-4 py-2.5 tabular-nums', a.speed != null && a.speed >= 110 ? 'text-success-ink' : '')}>{a.speed ?? '—'}</td>
                <td className="px-4 py-2.5 tabular-nums"><span className="inline-flex items-center gap-1">{a.satisfaction != null ? <><Star size={12} className="fill-amber-400 text-amber-400" />{n1(a.satisfaction)}</> : '—'}<span className="text-ink-subtle">{a.ratings ? ` (${a.ratings})` : ''}</span></span></td>
                <td className="px-4 py-2.5 tabular-nums">{a.complaints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {others.length > 0 && <p className="text-xs text-ink-subtle">Pas encore classés (moins de 20 visiteurs servis) : {others.map(a => `${a.name} (${a.served})`).join(', ')}.</p>}
    </div>
  )
}

function ValueTab({ data, onSettings }: { data: Data; onSettings: () => void }) {
  const m = data.money
  if (!m.valuesConfigured) {
    return (
      <section className="rounded-card border border-surface-line bg-white p-6 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Wallet size={26} /></span>
        <p className="mt-4 font-semibold text-ink">Indiquez la valeur d’une visite</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Pour chiffrer en FCFA l’argent perdu par les absences et la valeur de vos clients fidèles{m.suggestion ? ` (par exemple ${fcfa(m.suggestion)} dans votre secteur)` : ''}.</p>
        {data.canEdit && <Button className="mt-4" onClick={onSettings}>Régler la valeur</Button>}
      </section>
    )
  }
  const ids = m.atRisk.list.filter(c => c.reachable).map(c => c.id)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { l: 'Perdus par les absences', v: m.lostAmount != null ? fcfa(m.lostAmount) : '—', h: `${m.noShows} rendez-vous manqués ce mois-ci`, bad: !!m.lostAmount },
          { l: 'Clients à risque', v: String(m.atRisk.count), h: `${fcfa(m.atRisk.value)} par an`, bad: m.atRisk.count > 0 },
          { l: 'Clients perdus de vue', v: String(m.lost.count), h: `${fcfa(m.lost.value)} par an, plus de 90 jours`, bad: m.lost.count > 0 },
          { l: 'Temps gagné ce mois', v: m.timeSaved.hours != null ? `${m.timeSaved.hours} h` : '—', h: m.timeSaved.hours != null ? `soit ${m.timeSaved.workDays} journées de travail rendues aux visiteurs` : 'indiquez l’attente avant Lerena', bad: false }
        ].map(c => (
          <div key={c.l} className="rounded-card border border-surface-line bg-white p-4 shadow-card">
            <p className="text-xs text-ink-muted">{c.l}</p>
            <p className={cn('mt-1 font-display text-2xl font-bold tabular-nums', c.bad ? 'text-warning-ink' : 'text-ink')}>{c.v}</p>
            <p className="mt-0.5 text-[11px] text-ink-subtle">{c.h}</p>
          </div>
        ))}
      </div>
      <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-line px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink"><AlertTriangle size={16} className="text-warning-ink" /> Clients à risque</h2>
            <p className="text-xs text-ink-muted">Habitués qui ont laissé passer plus du double de leur rythme habituel, du plus précieux au moins précieux.</p>
          </div>
          {data.canCampaign && ids.length > 0 && <Link href={`/dashboard/campaigns/new?customers=${ids.join(',')}`} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"><MessageSquareText size={14} /> Relancer par SMS ({ids.length})</Link>}
        </header>
        <ul className="divide-y divide-surface-line">
          {m.atRisk.list.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-subtle">Aucun habitué en retard sur son rythme : vos visiteurs fidèles reviennent.</li>}
          {m.atRisk.list.map(c => (
            <li key={c.id}>
              <Link href={`/dashboard/visitors/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-sunken/60">
                <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{c.name ?? c.phone}</span><span className="block text-xs text-ink-muted">{c.visits} passages · venait tous les {c.intervalDays} jours · pas revenu depuis {c.sinceDays} jours{c.reachable ? '' : ' · n’a pas accepté les SMS'}</span></span>
                <span className="font-display font-bold tabular-nums text-ink">{fcfa(c.annualValue)}<span className="text-xs font-normal text-ink-subtle"> / an</span></span>
                <ArrowRight size={14} className="text-ink-subtle" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-ink-subtle">Valeur calculée avec {m.visitValue != null ? fcfa(m.visitValue) : '—'} par visite en moyenne (réglable par service).</p>
    </div>
  )
}

function BeforeAfterTab({ canEdit, onSettings }: { canEdit: boolean; onSettings: () => void }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof getBeforeAfter>> | undefined>(undefined)
  useEffect(() => { getBeforeAfter().then(setD).catch(() => setD(null)) }, [])
  if (d === undefined) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />
  if (!d) return null
  const rows = [
    { l: 'Attente moyenne', before: d.before.waitMin != null ? `${d.before.waitMin} min` : '—', after: d.after.waitMin != null ? `${d.after.waitMin} min` : '—' },
    { l: 'Visiteurs par jour', before: d.before.dailyVisitors != null ? String(d.before.dailyVisitors) : '—', after: d.after.dailyVisitors != null ? String(d.after.dailyVisitors) : '—' },
    { l: 'Satisfaction', before: 'non mesurée', after: d.after.satisfaction != null ? `${n1(d.after.satisfaction)}/5` : '—' },
    { l: 'Visiteurs absents à l’appel', before: 'non mesuré', after: d.after.absentRate != null ? `${d.after.absentRate} %` : '—' }
  ]
  return (
    <section className="rounded-card border border-surface-line bg-white p-6 shadow-card print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{d.orgName}</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">Avant et après Lerena</h2>
          <p className="text-sm text-ink-muted">Depuis le {new Date(d.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · « après » = 30 derniers jours</p>
        </div>
        <Button size="sm" variant="secondary" icon={<Printer size={14} />} className="print:hidden" onClick={() => window.print()}>Imprimer ou PDF</Button>
      </div>
      {!d.baselineSet && (
        <p className="mt-4 rounded-2xl bg-warning-soft p-3 text-sm text-warning-ink print:hidden">Indiquez l’attente moyenne relevée avant Lerena pour mesurer le gain.{canEdit && <button onClick={onSettings} className="ml-2 font-semibold underline">Indiquer</button>}</p>
      )}
      {(d.waitGainPct != null || d.hoursSaved != null) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {d.waitGainPct != null && <div className="rounded-2xl bg-success-soft p-4"><p className="font-display text-4xl font-bold text-success-ink">{d.waitGainPct > 0 ? `−${d.waitGainPct}` : `+${-d.waitGainPct}`} %</p><p className="text-sm text-success-ink">d’attente en moins</p></div>}
          {d.hoursSaved != null && <div className="rounded-2xl bg-brand-50 p-4"><p className="font-display text-4xl font-bold text-brand-700">{d.hoursSaved.toLocaleString('fr-FR')} h</p><p className="text-sm text-brand-700">rendues aux visiteurs sur {d.servedSince.toLocaleString('fr-FR')} passages</p></div>}
        </div>
      )}
      <table className="mt-5 w-full text-sm">
        <thead><tr className="border-b border-surface-line text-left text-xs text-ink-muted"><th scope="col" className="py-2 font-semibold"></th><th scope="col" className="py-2 font-semibold">Avant</th><th scope="col" className="py-2 font-semibold">Avec Lerena</th></tr></thead>
        <tbody className="divide-y divide-surface-line">{rows.map(r => <tr key={r.l}><th scope="row" className="py-2.5 text-left font-semibold text-ink">{r.l}</th><td className="py-2.5 text-ink-muted">{r.before}</td><td className="py-2.5 font-semibold text-ink">{r.after}</td></tr>)}</tbody>
      </table>
    </section>
  )
}

function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [s, setS] = useState<NonNullable<Awaited<ReturnType<typeof getDirectionSettings>>> | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getDirectionSettings().then(setS).catch(() => null) }, [])
  const save = async () => {
    if (!s) return
    setBusy(true)
    const res = await saveDirectionSettings({ defaultVisitValue: s.defaultVisitValue, sites: s.sites, services: s.services.map(x => ({ id: x.id, visitValue: x.visitValue })), baseline: s.canEditBaseline ? { waitMin: s.baseline.waitMin, daily: s.baseline.daily } : undefined })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Objectifs et valeurs enregistrés', 'success'); onSaved()
  }
  const num = (v: string) => (v === '' ? null : Number(v))
  const input = 'h-9 w-24 rounded-lg border border-gray-200 px-2 text-right tabular-nums'
  return (
    <Dialog open onClose={onClose} title="Objectifs et valeurs" size="lg">
      {!s ? <div className="h-40 animate-pulse rounded-2xl bg-gray-100" /> : (
        <div className="space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Objectifs par site</p>
            <p className="text-[11px] text-ink-subtle">Laissez vide pour garder ceux proposés pour votre secteur ({s.defaults.targetWaitMin} min, {String(s.defaults.targetSatisfaction).replace('.', ',')}/5).</p>
            <ul className="mt-2 space-y-2">
              {s.sites.map((site, i) => (
                <li key={site.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[140px] flex-1 font-semibold text-ink">{site.name}</span>
                  <label className="flex items-center gap-1 text-xs text-ink-muted">Attente ≤<input type="number" min={1} className={input} placeholder={String(s.defaults.targetWaitMin)} value={site.targetWaitMin ?? ''} onChange={e => setS({ ...s, sites: s.sites.map((x, j) => (j === i ? { ...x, targetWaitMin: num(e.target.value) } : x)) })} />min</label>
                  <label className="flex items-center gap-1 text-xs text-ink-muted">Satisfaction ≥<input type="number" min={1} max={5} step={0.1} className={input} placeholder={String(s.defaults.targetSatisfaction)} value={site.targetSatisfaction ?? ''} onChange={e => setS({ ...s, sites: s.sites.map((x, j) => (j === i ? { ...x, targetSatisfaction: num(e.target.value) } : x)) })} />/5</label>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Valeur d’une visite (FCFA)</p>
            {s.canEditBaseline && (
              <label className="mt-2 flex items-center gap-2 text-sm text-ink">Par défaut<input type="number" min={0} className={input} placeholder={s.defaults.visitValue ? String(s.defaults.visitValue) : ''} value={s.defaultVisitValue ?? ''} onChange={e => setS({ ...s, defaultVisitValue: num(e.target.value) })} />FCFA</label>
            )}
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {s.services.map((svc, i) => (
                <li key={svc.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{svc.name}{s.sites.length > 1 ? <span className="text-ink-subtle"> · {svc.site}</span> : ''}</span>
                  <input type="number" min={0} aria-label={`Valeur d’une visite : ${svc.name}`} className={input} placeholder="défaut" value={svc.visitValue ?? ''} onChange={e => setS({ ...s, services: s.services.map((x, j) => (j === i ? { ...x, visitValue: num(e.target.value) } : x)) })} />
                </li>
              ))}
            </ul>
          </section>
          {s.canEditBaseline && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Avant Lerena</p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 text-ink">Attente moyenne<input type="number" min={0} className={input} value={s.baseline.waitMin ?? ''} onChange={e => setS({ ...s, baseline: { ...s.baseline, waitMin: num(e.target.value) } })} />min</label>
                <label className="flex items-center gap-2 text-ink">Visiteurs par jour<input type="number" min={0} className={input} value={s.baseline.daily ?? ''} onChange={e => setS({ ...s, baseline: { ...s.baseline, daily: num(e.target.value) } })} /></label>
              </div>
            </section>
          )}
          <Button fullWidth loading={busy} onClick={save}>Enregistrer</Button>
        </div>
      )}
    </Dialog>
  )
}
