import { prisma } from '@/lib/prisma'

// Indicateurs par établissement sur une période : base commune des vues réseau et plateforme

export interface SiteMetrics {
  tickets: number
  served: number
  absent: number
  cancelled: number
  avgWaitMin: number | null
  avgServiceMin: number | null
  satisfaction: number | null
  ratings: number
  waitingNow: number
}

const EMPTY: SiteMetrics = { tickets: 0, served: 0, absent: 0, cancelled: 0, avgWaitMin: null, avgServiceMin: null, satisfaction: null, ratings: 0, waitingNow: 0 }

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null)

export async function metricsByOrg(orgIds: string[], from: Date, to: Date): Promise<Map<string, SiteMetrics>> {
  const result = new Map<string, SiteMetrics>()
  if (orgIds.length === 0) return result

  const [rows, waiting] = await Promise.all([
    prisma.ticket.findMany({
      where: { createdAt: { gte: from, lt: to }, queue: { branch: { organizationId: { in: orgIds } } } },
      select: {
        status: true, createdAt: true, queuedAt: true, calledAt: true, startedAt: true, completedAt: true, npsScore: true,
        queue: { select: { branch: { select: { organizationId: true } } } }
      }
    }),
    prisma.ticket.findMany({
      where: { status: 'WAITING', queue: { branch: { organizationId: { in: orgIds } } } },
      select: { queue: { select: { branch: { select: { organizationId: true } } } } }
    })
  ])

  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const id = r.queue.branch.organizationId
    const list = groups.get(id) ?? []
    list.push(r)
    groups.set(id, list)
  }
  const waitingCount = new Map<string, number>()
  for (const w of waiting) {
    const id = w.queue.branch.organizationId
    waitingCount.set(id, (waitingCount.get(id) ?? 0) + 1)
  }

  for (const id of orgIds) {
    const list = groups.get(id) ?? []
    // Durées plafonnées pour qu'un ticket oublié ne fausse pas la moyenne
    const waits = list.filter(t => t.calledAt).map(t => Math.min(Math.max(0, minutes(t.createdAt, t.calledAt!)), 240))
    const services = list.filter(t => t.status === 'COMPLETED' && t.startedAt && t.completedAt).map(t => Math.min(Math.max(0, minutes(t.startedAt!, t.completedAt!)), 120))
    const ratings = list.filter(t => t.npsScore != null).map(t => t.npsScore!)
    result.set(id, {
      ...EMPTY,
      tickets: list.length,
      served: list.filter(t => t.status === 'COMPLETED').length,
      absent: list.filter(t => t.status === 'ABSENT').length,
      cancelled: list.filter(t => t.status === 'CANCELLED').length,
      avgWaitMin: avg(waits),
      avgServiceMin: avg(services),
      satisfaction: avg(ratings),
      ratings: ratings.length,
      waitingNow: waitingCount.get(id) ?? 0
    })
  }
  return result
}

/** Premier et dernier instant d'un mois « AAAA-MM » (mois en cours si invalide). */
export function monthRange(month?: string) {
  const now = new Date()
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [y, mo] = m.split('-').map(Number)
  const from = new Date(y, mo - 1, 1)
  const to = new Date(y, mo, 1)
  return { month: m, from, to, label: from.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) }
}
