'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus, Printer, Ticket, CheckCircle2, UserX, Clock, Timer, Star } from 'lucide-react'
import { getAnalyticsSummary, type AnalyticsSummary, type PeriodDays, type PeriodMetrics } from '@/server/actions/analytics'
import { Button, Card, CardHeader, EmptyState } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t, type MessageKey } from '@/lib/i18n'

const PERIODS: { value: PeriodDays; label: MessageKey }[] = [
  { value: 1, label: 'analytics.today' },
  { value: 7, label: 'analytics.days7' },
  { value: 30, label: 'analytics.days30' },
  { value: 90, label: 'analytics.days90' },
]

// Couleurs des barres : une seule série, teinte de marque ; le pic en plein, le reste atténué
const BAR = '#fdba74'
const BAR_PEAK = '#f97316'

type MetricKey = keyof PeriodMetrics

// Nombres au format français : 0,2 min et non 0.2 min
const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

// Pour l'attente, les abandons et la durée de service, une baisse est une bonne nouvelle
const LOWER_IS_BETTER: MetricKey[] = ['avgWaitMin', 'dropOffRate', 'avgServiceMin']

function Delta({ metric, current, previous }: { metric: MetricKey; current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous === 0) {
    return <span className="text-xs text-ink-subtle" title={t('analytics.noComparison')}>—<span className="sr-only">{t('analytics.noComparison')}</span></span>
  }
  const change = Math.round(((current - previous) / previous) * 100)
  if (change === 0) return <span className="flex items-center gap-0.5 text-xs text-ink-subtle"><Minus size={12} />0 %</span>
  const good = LOWER_IS_BETTER.includes(metric) ? change < 0 : change > 0
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-semibold', good ? 'text-success-ink' : 'text-danger-ink')}>
      {change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {change > 0 ? '+' : ''}{change} %
      <span className="sr-only">{good ? t('analytics.better') : t('analytics.worse')}</span>
    </span>
  )
}

export default function AnalyticsTab() {
  const [days, setDays] = useState<PeriodDays>(7)
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getAnalyticsSummary(days).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [days])

  const kpis: { key: MetricKey; label: MessageKey; icon: React.ReactNode; format: (m: PeriodMetrics) => string }[] = [
    { key: 'totalTickets', label: 'analytics.tickets', icon: <Ticket size={16} className="text-brand" />, format: m => String(m.totalTickets) },
    { key: 'completedCount', label: 'analytics.served', icon: <CheckCircle2 size={16} className="text-success" />, format: m => String(m.completedCount) },
    { key: 'avgWaitMin', label: 'analytics.avgWait', icon: <Clock size={16} className="text-info" />, format: m => `${fr(m.avgWaitMin)} min` },
    { key: 'avgServiceMin', label: 'analytics.avgService', icon: <Timer size={16} className="text-purple-500" />, format: m => `${fr(m.avgServiceMin)} min` },
    { key: 'dropOffRate', label: 'analytics.dropOff', icon: <UserX size={16} className="text-danger" />, format: m => `${fr(m.dropOffRate)} %` },
    { key: 'nps', label: 'analytics.satisfaction', icon: <Star size={16} className="text-warning" />, format: m => (m.nps === null ? '—' : `${fr(m.nps)}/5`) },
  ]

  const hourly = data?.hourlyAffluence.filter(h => h.hour >= 6 && h.hour <= 21) ?? []
  const peak = hourly.reduce((a, b) => (b.count > a.count ? b : a), { hour: -1, label: '', count: 0 })
  const periodLabel = data
    ? `${new Date(data.from).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} – ${new Date(data.to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    : ''

  return (
    <div className="space-y-4">
      {/* Filtres : une seule ligne au-dessus des graphiques */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex gap-1 rounded-xl bg-white p-1 shadow-card" role="radiogroup" aria-label={t('analytics.period')}>
          {PERIODS.map(p => (
            <button key={p.value} role="radio" aria-checked={days === p.value} onClick={() => setDays(p.value)}
              className={cn('whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all sm:px-3', days === p.value ? 'bg-brand text-white' : 'text-ink-muted hover:bg-gray-100')}>
              {t(p.label)}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" icon={<Printer size={15} />} onClick={() => window.print()} disabled={!data}>{t('analytics.print')}</Button>
      </div>

      {/* En-tête du rapport imprimé */}
      {data && (
        <div className="hidden print:block">
          <h1 className="text-xl font-bold">{t('analytics.reportTitle', { org: data.orgName })}</h1>
          <p className="text-sm">{periodLabel}</p>
        </div>
      )}

      {loading || !data ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-card bg-gray-200/80" />)}</div>
          <div className="h-56 animate-pulse rounded-card bg-gray-200/80" />
        </div>
      ) : (
        <>
          <p className="text-xs text-ink-muted print:hidden">{periodLabel} · {t('analytics.vsPrevious')}</p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {kpis.map(k => (
              <Card key={k.key} className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  {k.icon}
                  <Delta metric={k.key} current={data.current[k.key] as number | null} previous={data.previous[k.key] as number | null} />
                </div>
                <p className="text-2xl font-black tabular-nums text-ink">{k.format(data.current)}</p>
                <p className="mt-1 text-xs text-ink-muted">{t(k.label)}</p>
              </Card>
            ))}
          </div>

          {/* Volume par jour (sauf pour « aujourd'hui ») */}
          {days > 1 && (
            <Card className="p-5">
              <h3 className="font-semibold text-ink">{t('analytics.dailyTitle')}</h3>
              <p className="mb-4 text-xs text-ink-subtle">{t('analytics.dailyText')}</p>
              {data.current.totalTickets === 0 ? (
                <p className="py-6 text-center text-sm text-ink-subtle">{t('analytics.empty')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.daily} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                    <CartesianGrid stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(v: number) => [`${v} tickets`, t('analytics.tickets')]} />
                    <Bar dataKey="count" fill={BAR_PEAK} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink">{t('analytics.hourlyTitle')}</h3>
              {peak.count > 0 && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">{t('analytics.peak', { hour: peak.label })}</span>}
            </div>
            <p className="mb-4 text-xs text-ink-subtle">{t('analytics.hourlyText')}</p>
            {data.current.totalTickets === 0 ? (
              <p className="py-6 text-center text-sm text-ink-subtle">{t('analytics.empty')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourly} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <CartesianGrid stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#fff7ed' }} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                    formatter={(v: number) => [`${v} tickets`, t('analytics.tickets')]} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={24}>
                    {hourly.map(h => <Cell key={h.hour} fill={h.hour === peak.hour ? BAR_PEAK : BAR} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('analytics.ahtTitle')} subtitle={t('analytics.ahtText')} />
              {data.aht.length === 0 ? (
                <EmptyState title={t('analytics.noCompleted')} />
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted"><th className="px-5 py-2 font-medium">{t('analytics.service')}</th><th className="px-5 py-2 text-right font-medium">{t('analytics.served')}</th><th className="px-5 py-2 text-right font-medium">{t('analytics.duration')}</th></tr></thead>
                  <tbody className="divide-y divide-surface-line">
                    {data.aht.map(s => (
                      <tr key={s.name}><td className="px-5 py-2.5 text-ink">{s.name}</td><td className="px-5 py-2.5 text-right tabular-nums text-ink-muted">{s.count}</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">{fr(s.avgMinutes)} min</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card>
              <CardHeader title={t('analytics.countersTitle')} subtitle={t('analytics.countersText')} />
              {data.counters.length === 0 ? (
                <EmptyState title={t('analytics.noCompleted')} />
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted"><th className="px-5 py-2 font-medium">{t('analytics.counter')}</th><th className="px-5 py-2 text-right font-medium">{t('analytics.served')}</th><th className="px-5 py-2 text-right font-medium">{t('analytics.duration')}</th></tr></thead>
                  <tbody className="divide-y divide-surface-line">
                    {data.counters.map(c => (
                      <tr key={c.name}><td className="px-5 py-2.5 text-ink">{c.name}</td><td className="px-5 py-2.5 text-right tabular-nums text-ink-muted">{c.served}</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">{fr(c.avgMinutes)} min</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
