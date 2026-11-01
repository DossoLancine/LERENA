'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { getManagerStats, getLiveQueue, getOrganizationServices, getCounterBoard, toggleOrganizationStatus } from '@/server/actions/manager'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'

type Stats = NonNullable<Awaited<ReturnType<typeof getManagerStats>>>
type LiveTicket = Awaited<ReturnType<typeof getLiveQueue>>[number]
type ServiceSummary = Awaited<ReturnType<typeof getOrganizationServices>>[number]
export type CounterStatus = Awaited<ReturnType<typeof getCounterBoard>>[number]

interface DashboardData {
  stats: Stats | null
  liveQueue: LiveTicket[]
  services: ServiceSummary[]
  counters: CounterStatus[]
  loading: boolean
  refresh: () => Promise<void>
  toggleOpen: () => Promise<boolean>
}

const DashboardContext = createContext<DashboardData | null>(null)

// Seules ces pages affichent la file en direct : ailleurs, aucun rafraîchissement inutile
const LIVE_PATHS = ['/dashboard', '/dashboard/queue']

/** Données partagées par toutes les pages du tableau de bord, tenues à jour en temps réel. */
export function DashboardProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [stats, setStats] = useState<Stats | null>(null)
  const [liveQueue, setLiveQueue] = useState<LiveTicket[]>([])
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [counters, setCounters] = useState<CounterStatus[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [s, q, svc, ctr] = await Promise.all([getManagerStats(), getLiveQueue(), getOrganizationServices(), getCounterBoard()])
      setStats(s)
      setLiveQueue(q)
      setServices(svc)
      setCounters(ctr)
    } finally {
      setLoading(false)
    }
  }, [])

  // Premier chargement partout (l'en-tête a besoin du nom et de l'état ouvert/fermé),
  // puis rafraîchissement uniquement sur les pages en direct
  const isLive = LIVE_PATHS.includes(pathname)
  const live = useOrgRealtime(isLive ? stats?.orgId : null, refresh)
  usePolling(refresh, live ? 30000 : 5000, isLive || stats === null)

  const toggleOpen = useCallback(async () => {
    if (!stats) return false
    const next = !stats.isOpen
    setStats({ ...stats, isOpen: next }) // immédiat, annulé si le serveur refuse
    const res = await toggleOrganizationStatus(stats.orgId, next)
    if (!res.success) setStats({ ...stats, isOpen: !next })
    return res.success
  }, [stats])

  return (
    <DashboardContext.Provider value={{ stats, liveQueue, services, counters, loading, refresh, toggleOpen }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard doit être utilisé dans DashboardProvider')
  return ctx
}
