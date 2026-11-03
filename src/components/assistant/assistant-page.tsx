'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, CheckCircle2, AlertTriangle, Info, Lightbulb, CalendarClock, MessageSquareQuote, ArrowRight, ThumbsDown, ThumbsUp } from 'lucide-react'
import { getAssistant, runAdvancedAnalysis } from '@/server/actions/assistant'
import { BarChart } from '@/components/charts/bar-chart'
import { Badge, Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getAssistant>>>

const ICON = { good: CheckCircle2, bad: AlertTriangle, neutral: Info }
const TONE = { good: 'text-success', bad: 'text-danger', neutral: 'text-info' }

/** Assistant d'analyse : ce qu'il faut savoir, que faire, demain, et ce que disent les visiteurs. */
export function AssistantPage() {
  const toast = useToast()
  const [data, setData] = useState<Data | null | undefined>(undefined)
  const [site, setSite] = useState(0)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => setData(await getAssistant().catch(() => null)), [])
  useEffect(() => { load() }, [load])

  if (data === undefined) return <div className="h-72 animate-pulse rounded-3xl bg-gray-100" />
  if (data === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès à l’analyse.</p>

  const advanced = async () => {
    setBusy(true)
    const res = await runAdvancedAnalysis()
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Analyse avancée terminée', 'success'); load()
  }
  const f = data.forecast.sites[site]
  const issues = data.insights.filter(i => i.tone === 'bad').length

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"><Sparkles size={14} /> Assistant</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{issues ? `${issues} point${issues > 1 ? 's' : ''} à regarder aujourd’hui` : 'Tout est normal aujourd’hui'}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">L’assistant compare vos chiffres à vos journées habituelles, prévoit l’affluence de demain et lit les commentaires de vos visiteurs. Tout est calculé sur vos données.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="mb-3 font-semibold text-ink">Ce qu’il faut savoir</h2>
          <ul className="space-y-3">{data.insights.map((i, k) => <InsightRow key={k} i={i} />)}</ul>
        </section>
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink"><Lightbulb size={16} className="text-brand" /> Que faire</h2>
          {data.recommendations.length === 0 ? <p className="text-sm text-ink-subtle">Pas de recommandation pour l’instant : l’assistant en propose dès que vos données le justifient.</p> : (
            <ul className="space-y-3">{data.recommendations.map((i, k) => <InsightRow key={k} i={i} />)}</ul>
          )}
        </section>
      </div>

      {/* Prévision de demain */}
      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><CalendarClock size={16} className="text-brand" /> Demain, {data.forecast.weekday}</h2>
          {data.forecast.sites.length > 1 && (
            <select value={site} onChange={e => setSite(Number(e.target.value))} aria-label="Site" className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm">
              {data.forecast.sites.map((s, i) => <option key={s.id} value={i}>{s.name}</option>)}
            </select>
          )}
        </div>
        {!f || f.daysOfHistory < 2 ? (
          <p className="mt-3 text-sm text-ink-subtle">Il faut au moins deux {data.forecast.weekday}s d’activité pour prévoir l’affluence.</p>
        ) : (
          <>
            <p className="mb-4 mt-1 text-sm text-ink-muted">
              Environ <strong className="text-ink">{f.total} visiteurs</strong> attendus{f.peak ? <>, plus forte affluence vers <strong className="text-ink">{f.peak.hour} h</strong> ({Math.round(f.peak.expected)} par heure)</> : ''} · moyenne de {f.daysOfHistory} {data.forecast.weekday}s · {f.serviceMin} min par visiteur au guichet · {f.available} guichet{f.available > 1 ? 's' : ''} actif{f.available > 1 ? 's' : ''}
            </p>
            <BarChart label="Visiteurs attendus par heure" data={f.hours.map(h => ({ label: `${h.hour} h`, value: h.expected, hint: `${h.counters} guichet${h.counters > 1 ? 's' : ''} nécessaire${h.counters > 1 ? 's' : ''}${h.counters > f.available ? ' (plus que vos guichets actifs)' : ''}` }))} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {f.hours.map(h => (
                <span key={h.hour} className={cn('rounded-lg px-2 py-1 text-[11px] font-semibold tabular-nums', h.counters > f.available ? 'bg-warning-soft text-warning-ink' : 'bg-surface-sunken text-ink-muted')}>
                  {h.hour} h · {h.counters} guichet{h.counters > 1 ? 's' : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Ce que disent les visiteurs */}
      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold text-ink"><MessageSquareQuote size={16} className="text-brand" /> Ce que disent vos visiteurs</h2>
        <p className="text-xs text-ink-muted">{data.commentCount} commentaire{data.commentCount > 1 ? 's' : ''} sur les 8 dernières semaines · noms et numéros masqués</p>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {([['negative', 'Ce qui déplaît', ThumbsDown, 'bg-danger'], ['positive', 'Ce qui plaît', ThumbsUp, 'bg-success']] as const).map(([k, title, Icon, bar]) => {
            const t = data.themes[k]
            return (
              <div key={k}>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink"><Icon size={14} /> {title}<span className="font-normal text-ink-subtle">· {t.classified} commentaire{t.classified > 1 ? 's' : ''} classé{t.classified > 1 ? 's' : ''}</span></p>
                {t.themes.length === 0 ? <p className="text-sm text-ink-subtle">Pas encore de commentaire.</p> : (
                  <ul className="space-y-3">
                    {t.themes.map(th => (
                      <li key={th.id}>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="w-44 shrink-0 truncate text-ink">{th.label}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><span className={cn('block h-full rounded-full animate-bar-grow origin-left', bar)} style={{ width: `${th.share}%` }} /></span>
                          <span className="w-10 text-right tabular-nums text-ink-muted">{th.share} %</span>
                        </div>
                        <p className="mt-1 text-xs italic text-ink-muted">« {th.quote} »</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Analyse avancée par l'IA */}
      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-ink"><Sparkles size={16} className="text-brand" /> Analyse avancée</h2>
            <p className="text-xs text-ink-muted">Lecture plus fine des commentaires libres par l’IA. Seuls les textes anonymisés sont transmis.</p>
          </div>
          {data.advanced.available && <Button size="sm" variant="secondary" loading={busy} onClick={advanced}>{data.advanced.last ? 'Mettre à jour' : 'Lancer l’analyse'}</Button>}
        </div>
        {!data.advanced.available && !data.advanced.last && <p className="mt-3 text-sm text-ink-subtle">Bientôt disponible : l’équipe Lerena l’active pour votre établissement. L’analyse intégrée ci-dessus fonctionne déjà.</p>}
        {data.advanced.last && (
          <div className="mt-4 space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle"><Badge tone="brand"><Sparkles size={11} /> Analyse avancée</Badge> le {new Date(data.advanced.last.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm text-ink">{data.advanced.last.content.summary}</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.advanced.last.content.themes.map((t, i) => (
                <li key={i} className="rounded-xl bg-surface-sunken px-3 py-2 text-sm">
                  <p className="flex items-center justify-between font-semibold text-ink"><span className="flex items-center gap-1.5">{t.sentiment === 'positive' ? <ThumbsUp size={13} className="text-success" /> : <ThumbsDown size={13} className="text-danger" />}{t.label}</span><span className="tabular-nums text-ink-muted">{t.share} %</span></p>
                  {t.quote && <p className="mt-0.5 text-xs italic text-ink-muted">« {t.quote} »</p>}
                </li>
              ))}
            </ul>
            {data.advanced.last.content.recommendations.length > 0 && (
              <ul className="space-y-1 text-sm">{data.advanced.last.content.recommendations.map((r, i) => <li key={i} className="flex items-start gap-2"><Lightbulb size={14} className="mt-0.5 shrink-0 text-brand" />{r}</li>)}</ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function InsightRow({ i }: { i: Data['insights'][number] }) {
  const Icon = ICON[i.tone]
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink">
      <Icon size={16} className={cn('mt-0.5 shrink-0', TONE[i.tone])} />
      <span className="flex-1">{i.text}{i.action && <Link href={i.action.href} className="ml-2 inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-brand hover:underline">{i.action.label}<ArrowRight size={12} /></Link>}</span>
    </li>
  )
}
