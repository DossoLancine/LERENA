'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer, TrendingDown, TrendingUp, Minus, CheckCircle2, AlertTriangle, Info, Clock } from 'lucide-react'
import { getReport } from '@/server/actions/reports'
import { Button } from '@/components/ui'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getReport>>>
const num = (n: number | null, unit = '') => (n == null ? '—' : `${String(n).replace('.', ',')}${unit}`)

/** Rapport complet, prêt à imprimer ou à enregistrer en PDF (Imprimer → Enregistrer en PDF). */
export function ReportView({ id }: { id: string }) {
  const [data, setData] = useState<Data | null | undefined>(undefined)
  useEffect(() => { getReport(id).then(setData).catch(() => setData(null)) }, [id])
  if (data === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (data === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Rapport introuvable.</p>
  const s = data.summary

  // Pour l'attente, une baisse est une bonne nouvelle ; pour le reste, une hausse
  const Delta = ({ value, unit, lowerIsBetter }: { value: number | null; unit: string; lowerIsBetter?: boolean }) => {
    if (value == null || value === 0) return <span className="inline-flex items-center gap-1 text-xs text-ink-subtle"><Minus size={12} /> stable</span>
    const good = lowerIsBetter ? value < 0 : value > 0
    const Icon = value > 0 ? TrendingUp : TrendingDown
    return <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', good ? 'text-success-ink' : 'text-danger')}><Icon size={12} /> {value > 0 ? '+' : ''}{String(value).replace('.', ',')}{unit}</span>
  }
  const cards = [
    { label: 'Visiteurs', value: num(s.now.visitors), delta: <Delta value={s.delta.visitors} unit=" %" /> },
    { label: 'Attente moyenne', value: num(s.now.avgWait, ' min'), delta: <Delta value={s.delta.avgWait} unit=" min" lowerIsBetter /> },
    { label: 'Satisfaction', value: num(s.now.satisfaction, '/5'), delta: <Delta value={s.delta.satisfaction} unit="" /> },
    { label: 'Absences aux RDV', value: num(s.now.noShowRate, ' %'), delta: <Delta value={s.delta.noShowRate} unit=" pt" lowerIsBetter /> }
  ]

  return (
    <div className="space-y-5 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Rapports</Link>
        <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Imprimer ou PDF</Button>
      </div>

      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-6 py-6 print:rounded-none print:bg-none print:px-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {data.logo && <img src={data.logo} alt="" className="h-10 w-10 rounded-xl object-contain" />}
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">{data.orgName}{data.scoped ? ' · vos sites' : ''}</p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{data.label}</h1>
        <p className="mt-1 text-sm text-ink-muted">{data.period} · comparé à la période précédente</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-card border border-surface-line bg-white p-4 shadow-card print:shadow-none">
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-ink">{c.value}</p>
            <div className="mt-1">{c.delta}</div>
          </div>
        ))}
      </div>

      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card print:shadow-none">
        <h2 className="mb-3 font-semibold text-ink">Ce qu’il faut retenir</h2>
        <ul className="space-y-2">
          {s.lines.length === 0 && <li className="text-sm text-ink-subtle">Pas d’activité sur la période.</li>}
          {s.lines.map((l, i) => {
            const Icon = l.tone === 'good' ? CheckCircle2 : l.tone === 'bad' ? AlertTriangle : Info
            return <li key={i} className="flex items-start gap-2 text-sm text-ink"><Icon size={16} className={cn('mt-0.5 shrink-0', l.tone === 'good' ? 'text-success' : l.tone === 'bad' ? 'text-danger' : 'text-info')} />{l.text}</li>
          })}
          {s.peak && <li className="flex items-start gap-2 text-sm text-ink"><Clock size={16} className="mt-0.5 shrink-0 text-ink-muted" />Heure la plus chargée : {s.peak}.</li>}
        </ul>
      </section>

      {s.watch.length > 0 && (
        <section className="rounded-card border border-warning/40 bg-warning-soft/40 p-5 print:shadow-none">
          <h2 className="mb-2 font-semibold text-ink">Sites à surveiller</h2>
          <ul className="space-y-1 text-sm">{s.watch.map(w => <li key={w.id}><strong className="text-ink">{w.name}</strong> <span className="text-ink-muted">: {w.reasons.join(', ')}</span></li>)}</ul>
        </section>
      )}

      {s.sites.length > 1 && (
        <section className="overflow-x-auto rounded-card border border-surface-line bg-white shadow-card print:shadow-none">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-surface-line text-left text-xs text-ink-muted">
              {['Site', 'Visiteurs', 'Attente', 'Satisfaction', 'Absences RDV', 'Avis négatifs'].map(h => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-surface-line">
              {s.sites.map(x => (
                <tr key={x.id}>
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold text-ink">{x.name}</th>
                  <td className="px-4 py-2.5 tabular-nums">{x.visitors}</td>
                  <td className="px-4 py-2.5 tabular-nums">{num(x.avgWait, ' min')}</td>
                  <td className="px-4 py-2.5 tabular-nums">{num(x.satisfaction, '/5')}</td>
                  <td className="px-4 py-2.5 tabular-nums">{num(x.noShowRate, ' %')}</td>
                  <td className="px-4 py-2.5 tabular-nums">{x.complaints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="text-center text-[11px] text-ink-subtle">Rapport préparé par Lerena le {new Date(data.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
    </div>
  )
}
