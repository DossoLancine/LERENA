'use client'

import { Users } from 'lucide-react'
import { Card, CardHeader, EmptyState, TicketStatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'
import { useDashboard } from '../_components/dashboard-context'

export default function DashboardQueuePage() {
  const { liveQueue } = useDashboard()

  return (
    <Card>
      <CardHeader
        title={t('dashboard.fullQueue')}
        action={<span className="text-sm text-ink-muted">{t('dashboard.ticketsCount', { count: liveQueue.length })}</span>}
      />
      {liveQueue.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title={t('dashboard.emptyQueueTitle')} description={t('dashboard.emptyQueueBody')} />
      ) : (
        <ol className="divide-y divide-surface-line">
          {liveQueue.map((ticket, i) => (
            <li key={ticket.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  ticket.status === 'SERVING' ? 'bg-info text-white' : 'bg-gray-100 text-gray-600'
                )}>{i + 1}</span>
                <div>
                  <p className="text-sm">
                    <span className="font-mono font-bold text-gray-700">{ticket.num}</span>
                    <span className="text-ink"> — {ticket.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{ticket.service} · {ticket.counter}</p>
                </div>
              </div>
              <div className="text-right">
                <TicketStatusBadge status={ticket.status} />
                {ticket.wait > 0 && <p className="mt-1 text-xs text-ink-subtle">~{t('common.minutes', { count: ticket.wait })}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
