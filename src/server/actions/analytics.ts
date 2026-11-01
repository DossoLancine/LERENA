'use server'

import { prisma } from "@/lib/prisma"
import { getManagerContext } from "@/lib/session"
import { branchFilter } from '@/lib/sites'

// Statistiques du responsable sur une période, comparées à la période précédente de même durée

export type PeriodDays = 1 | 7 | 30 | 90

export interface HourlyData { hour: number; label: string; count: number }
export interface DailyData { day: string; label: string; count: number }
export interface ServiceAHT { name: string; avgMinutes: number; count: number }
export interface CounterPerf { name: string; served: number; avgMinutes: number }

export interface PeriodMetrics {
  totalTickets: number
  completedCount: number
  dropOffCount: number
  dropOffRate: number
  avgWaitMin: number
  avgServiceMin: number
  nps: number | null
  npsCount: number
}

export interface AnalyticsSummary {
  days: PeriodDays
  orgName: string
  from: string
  to: string
  current: PeriodMetrics
  previous: PeriodMetrics
  aht: ServiceAHT[]
  counters: CounterPerf[]
  hourlyAffluence: HourlyData[]
  daily: DailyData[]
}

type Row = {
  serviceId: string
  status: string
  counterName: string | null
  createdAt: Date
  queuedAt: Date
  calledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  npsScore: number | null
  service: { name: string }
}

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60000
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0)

function metrics(rows: Row[]): PeriodMetrics {
  const completed = rows.filter(t => t.status === 'COMPLETED')
  const dropOff = rows.filter(t => t.status === 'ABSENT' || t.status === 'CANCELLED').length
  // Attente vécue : de l'entrée dans la file à l'appel (bornée à 8 h pour écarter les oublis de clôture)
  const waits = rows.filter(t => t.calledAt).map(t => minutes(t.queuedAt, t.calledAt!)).filter(m => m >= 0 && m < 480)
  const services = completed.filter(t => t.startedAt && t.completedAt).map(t => minutes(t.startedAt!, t.completedAt!)).filter(m => m >= 0 && m < 240)
  const scores = rows.map(t => t.npsScore).filter((s): s is number => s !== null)
  return {
    totalTickets: rows.length,
    completedCount: completed.length,
    dropOffCount: dropOff,
    dropOffRate: rows.length ? Math.round((dropOff / rows.length) * 1000) / 10 : 0,
    avgWaitMin: avg(waits),
    avgServiceMin: avg(services),
    nps: scores.length ? avg(scores) : null,
    npsCount: scores.length
  }
}

export async function getAnalyticsSummary(days: PeriodDays = 7): Promise<AnalyticsSummary | null> {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return null
    const period = ([1, 7, 30, 90] as const).includes(days) ? days : 7

    // Période en jours entiers : « aujourd'hui » commence à minuit
    const to = new Date()
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - (period - 1))
    const prevFrom = new Date(from.getTime() - period * 86400_000)

    const select = {
      serviceId: true, status: true, counterName: true, createdAt: true, queuedAt: true,
      calledAt: true, startedAt: true, completedAt: true, npsScore: true,
      service: { select: { name: true } }
    } as const
    const scope = { queue: { branch: await branchFilter(ctx.orgId) } }

    const [org, rows, prevRows] = await Promise.all([
      prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
      prisma.ticket.findMany({ where: { ...scope, createdAt: { gte: from, lte: to } }, select }),
      prisma.ticket.findMany({ where: { ...scope, createdAt: { gte: prevFrom, lt: from } }, select })
    ])

    // Durée moyenne de traitement par service
    const byService = new Map<string, { name: string; total: number; count: number }>()
    for (const t of rows) {
      if (t.status !== 'COMPLETED' || !t.startedAt || !t.completedAt) continue
      const m = Math.min(Math.max(0, minutes(t.startedAt, t.completedAt)), 120)
      const e = byService.get(t.serviceId) ?? { name: t.service.name, total: 0, count: 0 }
      e.total += m; e.count += 1
      byService.set(t.serviceId, e)
    }

    // Performance par guichet
    const byCounter = new Map<string, { served: number; durations: number[] }>()
    for (const t of rows) {
      if (t.status !== 'COMPLETED' || !t.counterName) continue
      const e = byCounter.get(t.counterName) ?? { served: 0, durations: [] }
      e.served += 1
      if (t.startedAt && t.completedAt) e.durations.push(Math.min(Math.max(0, minutes(t.startedAt, t.completedAt)), 120))
      byCounter.set(t.counterName, e)
    }

    const hourly = new Array(24).fill(0)
    rows.forEach(t => { hourly[t.createdAt.getHours()]++ })

    const daily: DailyData[] = []
    for (let i = 0; i < period; i++) {
      const d = new Date(from.getTime() + i * 86400_000)
      const key = d.toISOString().slice(0, 10)
      daily.push({
        day: key,
        label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        count: rows.filter(t => t.createdAt.toISOString().slice(0, 10) === key).length
      })
    }

    return {
      days: period,
      orgName: org?.name ?? '',
      from: from.toISOString(),
      to: to.toISOString(),
      current: metrics(rows),
      previous: metrics(prevRows),
      aht: Array.from(byService.values())
        .map(s => ({ name: s.name, avgMinutes: Math.round((s.total / s.count) * 10) / 10, count: s.count }))
        .sort((a, b) => b.count - a.count),
      counters: Array.from(byCounter.entries())
        .map(([name, c]) => ({ name, served: c.served, avgMinutes: avg(c.durations) }))
        .sort((a, b) => b.served - a.served),
      hourlyAffluence: hourly.map((count, hour) => ({ hour, label: `${String(hour).padStart(2, '0')}h`, count })),
      daily
    }
  } catch (error) {
    console.error("Analytics error:", error)
    return null
  }
}
