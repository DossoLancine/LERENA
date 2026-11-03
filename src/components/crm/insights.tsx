'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Lock } from 'lucide-react'
import { getCrmInsights } from '@/server/actions/crm-insights'
import { BarChart } from '@/components/charts/bar-chart'
import { cn } from '@/lib/cn'

const TABS = [
  { href: '/dashboard/visitors', label: 'Fichier', exact: true },
  { href: '/dashboard/visitors/insights', label: 'Pilotage' },
  { href: '/dashboard/visitors/import', label: 'Import' },
  { href: '/dashboard/visitors/duplicates', label: 'Doublons' }
]

/** Onglets du fichier visiteurs (tableau de bord du responsable). */
export function CrmTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Fichier visiteurs" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {TABS.map(t => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
            className={cn('shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors', active ? 'bg-ink text-white' : 'text-ink-muted hover:bg-white hover:text-ink')}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function InsightsLocked({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-surface-line bg-white px-6 py-14 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Lock size={24} /></span>
      <p className="mt-4 font-semibold text-ink">{what} sont inclus à partir du forfait Pro</p>
      <Link href="/dashboard/billing" className="mt-5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Voir les forfaits</Link>
    </div>
  )
}

type Data = Extract<NonNullable<Awaited<ReturnType<typeof getCrmInsights>>>, { enabled: true }>

/** Tableau de bord du fichier visiteurs : fidélité, pertes, absences, satisfaction, 6 derniers mois. */
export function CrmInsights() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCrmInsights>> | undefined>(undefined)
  useEffect(() => { getCrmInsights().then(setData).catch(() => setData(null)) }, [])

  return (
    <div className="space-y-5">
      <CrmTabs />
      {data === undefined ? <div className="h-72 animate-pulse rounded-3xl bg-gray-100" /> : !data ? null : !data.enabled ? <InsightsLocked what="Le pilotage, l’import et l’export des visiteurs" /> : <Board d={data} />}
    </div>
  )
}

function Board({ d }: { d: Data }) {
  const k = d.kpis
  const cards = [
    { label: 'Visiteurs actifs', value: k.active, hint: `venus ces 90 jours, sur ${k.total} fiches` },
    { label: 'Nouveaux ce mois', value: k.newThisMonth, hint: 'premier passage ce mois-ci' },
    { label: 'Taux de retour', value: `${k.returnRate} %`, hint: 'des actifs sont déjà venus au moins 2 fois' },
    { label: 'Perdus de vue', value: k.lost, hint: 'pas revenus depuis plus de 90 jours', warn: k.lost > 0 },
    { label: 'Absences aux RDV', value: `${k.noShowRate} %`, hint: '90 derniers jours', warn: k.noShowRate >= 15 },
    { label: 'Satisfaction', value: k.satisfaction != null ? `${k.satisfaction.toFixed(1).replace('.', ',')}/5` : '—', hint: `${k.ratingsCount} note${k.ratingsCount > 1 ? 's' : ''} en 90 jours`, warn: k.satisfaction != null && k.satisfaction < 3.5 },
    { label: 'Joignables par SMS', value: `${k.consentRate} %`, hint: 'ont accepté vos messages' }
  ]
  return (
    <>
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Pilotage</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {k.returnRate} % <span className="text-ink-muted">de vos visiteurs reviennent</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Fidélité, pertes, absences et satisfaction, calculées sur le fichier visiteurs.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((c, i) => (
          <div key={c.label} className="animate-rise-in rounded-card border border-surface-line bg-white p-4 shadow-card" style={{ animationDelay: `${i * 35}ms` }}>
            <p className="text-xs text-ink-muted">{c.label}</p>
            <p className={cn('mt-1 font-display text-2xl font-bold tabular-nums', c.warn ? 'text-warning-ink' : 'text-ink')}>{c.value}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-ink-subtle">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-ink">Nouveaux visiteurs</h2>
          <p className="mb-4 text-xs text-ink-muted">Premier passage dans le mois</p>
          <BarChart label="Nouveaux visiteurs par mois" data={d.series.map(s => ({ label: s.label, value: s.newcomers, hint: `${s.visits} passages au total` }))} />
        </section>
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-ink">Visiteurs revenus</h2>
          <p className="mb-4 text-xs text-ink-muted">Déjà venus avant le mois</p>
          <BarChart label="Visiteurs revenus par mois" data={d.series.map(s => ({ label: s.label, value: s.returning, hint: `${s.visitors} visiteurs ce mois` }))} />
        </section>
      </div>

      <section className="rounded-card border border-surface-line bg-white shadow-card">
        <h2 className="border-b border-surface-line px-5 py-3.5 font-semibold text-ink">À surveiller</h2>
        <ul className="divide-y divide-surface-line">
          {d.watch.map(w => (
            <li key={w.id}>
              <Link href={w.href} className="group flex items-center gap-4 px-5 py-3 hover:bg-surface-sunken/60">
                <span className={cn('w-12 font-display text-2xl font-bold tabular-nums', w.count > 0 ? 'text-ink' : 'text-ink-subtle')}>{w.count}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-ink">{w.label}</span><span className="block text-xs text-ink-muted">{w.hint}</span></span>
                <ArrowRight size={16} className="text-ink-subtle transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
