'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { getManagerStats, getLiveQueue, getOrganizationServices, toggleOrganizationStatus } from '@/server/actions/manager'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'

type Stats = NonNullable<Awaited<ReturnType<typeof getManagerStats>>>
type LiveTicket = Awaited<ReturnType<typeof getLiveQueue>>[number]
type ServiceSummary = Awaited<ReturnType<typeof getOrganizationServices>>[number]

interface DashboardData {
  stats: Stats | null
  liveQueue: LiveTicket[]
  services: ServiceSummary[]
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
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [s, q, svc] = await Promise.all([getManagerStats(), getLiveQueue(), getOrganizationServices()])
      setStats(s)
      setLiveQueue(q)
      setServices(svc)
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
    <DashboardContext.Provider value={{ stats, liveQueue, services, loading, refresh, toggleOpen }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard doit être utilisé dans DashboardProvider')
  return ctx
}
