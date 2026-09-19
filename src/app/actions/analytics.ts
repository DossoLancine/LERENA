'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

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
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'MANAGER') {
      return null
    }

    // Get all tickets for the first org (MVP — manager scoped)
    const org = await prisma.organization.findFirst({
      include: {
        branches: {
          include: {
            queues: {
              include: {
                tickets: {
                  include: { service: true }
                }
              }
            }
          }
        }
      }
    })

    if (!org) return null

    const allTickets = org.branches.flatMap(b =>
      b.queues.flatMap(q => q.tickets)
    )

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
