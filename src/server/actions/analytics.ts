'use server'

import { prisma } from "@/lib/prisma"
import { getManagerContext } from "@/lib/session"

export interface HourlyData {
  hour: number
  label: string
  count: number
}

export interface ServiceAHT {
  name: string
  avgMinutes: number
  count: number
}

export interface AnalyticsSummary {
  aht: ServiceAHT[]
  dropOffRate: number
  dropOffCount: number
  totalTickets: number
  hourlyAffluence: HourlyData[]
  completedCount: number
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return null

    // 90 derniers jours de l'organisation du manager connecté
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000)
    const allTickets = await prisma.ticket.findMany({
      where: { queue: { branch: { organizationId: ctx.orgId } }, createdAt: { gte: since } },
      select: {
        serviceId: true,
        status: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        service: { select: { name: true } }
      }
    })

    const totalTickets = allTickets.length

    // --- AHT: Average Handling Time by Service ---
    const completedTickets = allTickets.filter(
      t => t.status === 'COMPLETED' && t.startedAt && t.completedAt
    )

    const byService: Record<string, { total: number; count: number; name: string }> = {}
    for (const t of completedTickets) {
      const svcId = t.serviceId
      const svcName = t.service?.name || 'Inconnu'
      const durationMs = new Date(t.completedAt!).getTime() - new Date(t.startedAt!).getTime()
      const durationMin = Math.max(0, Math.min(durationMs / 60000, 120)) // clamp 0–120 min
      if (!byService[svcId]) byService[svcId] = { total: 0, count: 0, name: svcName }
      byService[svcId].total += durationMin
      byService[svcId].count += 1
    }

    const aht: ServiceAHT[] = Object.values(byService).map(s => ({
      name: s.name,
      avgMinutes: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
      count: s.count
    }))

    // --- Drop-Off Rate ---
    const dropOffCount = allTickets.filter(
      t => t.status === 'ABSENT' || t.status === 'CANCELLED'
    ).length
    const dropOffRate = totalTickets > 0
      ? Math.round((dropOffCount / totalTickets) * 1000) / 10
      : 0

    // --- Hourly Affluence ---
    const hourlyCounts: number[] = new Array(24).fill(0)
    for (const t of allTickets) {
      const hour = new Date(t.createdAt).getHours()
      hourlyCounts[hour]++
    }

    const hourlyAffluence: HourlyData[] = hourlyCounts.map((count, hour) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}h`,
      count
    }))

    return {
      aht,
      dropOffRate,
      dropOffCount,
      totalTickets,
      hourlyAffluence,
      completedCount: completedTickets.length
    }
  } catch (error) {
    console.error("Analytics error:", error)
    return null
  }
}
