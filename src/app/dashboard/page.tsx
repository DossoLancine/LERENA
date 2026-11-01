'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Clock, CheckCircle2, Activity, AlertTriangle, Monitor, DoorOpen } from 'lucide-react'
import { Card, CardHeader, StatCard, EmptyState, TicketStatusBadge, Button, useToast } from '@/components/ui'
import { updateCounter } from '@/server/actions/counters'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'
import { useDashboard } from './_components/dashboard-context'

// Au-delà de ce délai, une file est signalée au responsable
const HIGH_WAIT_MIN = 25

function minutesSince(iso: string | null, now: number) {
  return iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)) : 0
}

export default function DashboardOverviewPage() {
  const { stats, liveQueue, services, counters, refresh } = useDashboard()
  const toast = useToast()
  const [now, setNow] = useState(Date.now())
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])

  // Attente réelle par service : personnes en file × durée moyenne de passage
  const waits = services.map(s => ({ name: s.name, minutes: s.count * s.avgMin }))
  const longest = waits.reduce((max, w) => (w.minutes > max.minutes ? w : max), { name: '', minutes: 0 })
  const overloaded = waits.filter(w => w.minutes > HIGH_WAIT_MIN).sort((a, b) => b.minutes - a.minutes)
  const closedCounter = counters.find(c => !c.isActive)
  const openCount = counters.filter(c => c.isActive).length

  // Action directe depuis l'alerte : ouvrir le premier guichet fermé
  const openCounter = async () => {
    if (!closedCounter) return
    haptics.tap()
    setOpening(true)
    const res = await updateCounter(closedCounter.id, { isActive: true })
    setOpening(false)
    toast(res.success ? t('overview.counterOpened', { name: closedCounter.name }) : res.error ?? t('errors.generic.title'), res.success ? 'success' : 'error')
    refresh()
  }

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
        <div key={w.name} role="alert" className="flex flex-col gap-3 rounded-card border border-amber-200 bg-warning-soft p-4 animate-rise-in sm:flex-row sm:items-center">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-ink">{t('dashboard.alert.title')}</p>
            <p className="mt-0.5 text-xs text-warning-ink/80">{t('dashboard.alert.body', { service: w.name, minutes: w.minutes })}</p>
          </div>
          <div className="flex gap-2">
            {closedCounter ? (
              <Button size="sm" loading={opening} icon={<DoorOpen size={15} />} onClick={openCounter}>
                {t('overview.openCounter', { name: closedCounter.name })}
              </Button>
            ) : (
              <Link href="/dashboard/counters" className="btn-secondary !px-3 !py-2 text-xs">{t('overview.addCounter')}</Link>
            )}
            <Link href="/dashboard/queue" className="btn-secondary !px-3 !py-2 text-xs">{t('overview.seeQueue')}</Link>
          </div>
        </div>
      ))}

      {/* Guichets en direct */}
      <Card>
        <CardHeader
          title={t('overview.countersTitle', { open: openCount, total: counters.length })}
          action={<Link href="/dashboard/counters" className="text-sm font-medium text-brand">{t('common.details')}</Link>}
        />
        {counters.length === 0 ? (
          <EmptyState icon={<Monitor size={28} />} title={t('counters.empty')} description={t('counters.emptyText')}
            action={<Link href="/dashboard/counters" className="btn-primary text-sm">{t('counters.add')}</Link>} />
        ) : (
          <ul className="grid gap-px bg-surface-line sm:grid-cols-2 lg:grid-cols-3">
            {counters.map(c => (
              <li key={c.id} className={cn('bg-white p-4', !c.isActive && 'opacity-50')}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-ink"><Monitor size={15} className="text-info" />{c.name}</span>
                  <span className={cn('text-xs font-semibold', c.isActive ? 'text-success' : 'text-ink-subtle')}>{c.isActive ? t('common.open') : t('common.closed')}</span>
                </div>
                {c.ticket ? (
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-lg font-bold text-ink">{c.ticket.num}</p>
                      <p className="text-xs text-ink-muted">{c.ticket.service}{c.agentName ? ` · ${c.agentName}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <TicketStatusBadge status={c.ticket.status} />
                      <p className="mt-1 text-xs text-ink-subtle">{t('common.minutes', { count: minutesSince(c.ticket.since, now) })}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ink-subtle">{c.isActive ? t('overview.counterFree') : '—'}</p>
                )}
                <p className="mt-2 text-xs text-ink-muted">
                  {t('overview.servedToday', { count: c.servedToday })}{c.onHold > 0 ? ` · ${t('overview.onHold', { count: c.onHold })}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('dashboard.liveQueue')}
            action={<Link href="/dashboard/queue" className="text-sm font-medium text-brand">{t('common.seeAll')}</Link>}
          />
          {liveQueue.length === 0 ? (
            <p className="p-6 text-center text-xs text-ink-subtle">{t('dashboard.noActiveTicket')}</p>
          ) : (
            <ul className="divide-y divide-surface-line">
              {liveQueue.slice(0, 6).map(ticket => (
                <li key={ticket.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-14 font-mono text-sm font-bold text-gray-700">{ticket.num}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{ticket.name}</p>
                      <p className="truncate text-xs text-ink-muted">{ticket.service}</p>
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
      </div>
    </>
  )
}
