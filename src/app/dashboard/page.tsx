'use client'

import Link from 'next/link'
import { Users, Clock, CheckCircle2, Activity, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, StatCard, EmptyState, TicketStatusBadge } from '@/components/ui'
import { t } from '@/lib/i18n'
import { useDashboard } from './_components/dashboard-context'

// Au-delà de ce délai, une file est signalée au responsable
const HIGH_WAIT_MIN = 25

export default function DashboardOverviewPage() {
  const { stats, liveQueue, services } = useDashboard()

  // Attente réelle par service : personnes en file × durée moyenne de passage
  const waits = services.map(s => ({ name: s.name, minutes: s.count * s.avgMin }))
  const longest = waits.reduce((max, w) => (w.minutes > max.minutes ? w : max), { name: '', minutes: 0 })
  const overloaded = waits.filter(w => w.minutes > HIGH_WAIT_MIN).sort((a, b) => b.minutes - a.minutes)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('dashboard.kpi.waiting')} value={stats?.currentWaiting ?? 0} icon={<Users size={18} className="text-brand" />} />
        <StatCard
          label={t('dashboard.kpi.longestWait')}
          value={t('common.minutes', { count: longest.minutes })}
          icon={<Clock size={18} className="text-info" />}
          hint={longest.minutes > 0 ? longest.name : undefined}
          hintTone={longest.minutes > HIGH_WAIT_MIN ? 'bad' : 'neutral'}
        />
        <StatCard label={t('dashboard.kpi.completed')} value={stats?.completedTickets ?? 0} icon={<CheckCircle2 size={18} className="text-success" />} />
        <StatCard label={t('dashboard.kpi.total')} value={stats?.todayTickets ?? 0} icon={<Activity size={18} className="text-purple-500" />} />
      </div>

      {overloaded.map(w => (
        <div key={w.name} role="alert" className="flex items-center gap-3 rounded-card border border-amber-200 bg-warning-soft p-4 animate-rise-in">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-warning-ink">{t('dashboard.alert.title')}</p>
            <p className="mt-0.5 text-xs text-warning-ink/80">{t('dashboard.alert.body', { service: w.name, minutes: w.minutes })}</p>
          </div>
        </div>
      ))}

      <Card>
        <CardHeader
          title={t('dashboard.liveQueue')}
          action={<Link href="/dashboard/queue" className="text-sm font-medium text-brand">{t('common.seeAll')}</Link>}
        />
        {liveQueue.length === 0 ? (
          <p className="p-6 text-center text-xs text-ink-subtle">{t('dashboard.noActiveTicket')}</p>
        ) : (
          <ul className="divide-y divide-surface-line">
            {liveQueue.slice(0, 5).map(ticket => (
              <li key={ticket.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-14 font-mono text-sm font-bold text-gray-700">{ticket.num}</span>
                  <div>
                    <p className="text-sm font-medium text-ink">{ticket.name}</p>
                    <p className="text-xs text-ink-muted">{ticket.service}</p>
                  </div>
                </div>
                <TicketStatusBadge status={ticket.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t('dashboard.servicesConfigured', { count: services.length })}
          action={<Link href="/dashboard/services" className="text-sm font-medium text-brand">{t('common.details')}</Link>}
        />
        {services.length === 0 ? (
          <EmptyState title={t('dashboard.noService')} />
        ) : (
          <ul className="divide-y divide-surface-line">
            {services.map(svc => (
              <li key={svc.id} className="px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{svc.name}</p>
                  <span className="text-xs text-ink-muted">{t('dashboard.servedToday', { count: svc.completedToday })}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-ink-muted">
                  <span className="flex items-center gap-1"><Users size={11} />{t('dashboard.waitingCount', { count: svc.count })}</span>
                  <span className="flex items-center gap-1"><Clock size={11} />~{t('common.minutes', { count: svc.avgMin })}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
