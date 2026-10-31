'use client'

import AgendaTab from '../_components/agenda-tab'
import { useDashboard } from '../_components/dashboard-context'

export default function DashboardAgendaPage() {
  const { stats } = useDashboard()
  return stats?.orgId ? <AgendaTab orgId={stats.orgId} /> : null
}
