'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { metricsByOrg } from '@/lib/metrics'

// Pilote d'un établissement : mesures relevées sur place avant Lerena, puis rapport avant / après
// calculé sur les vrais tickets (attente, volume, absences, satisfaction), semaine par semaine.

const DENIED = { success: false as const, error: 'Accès réservé à l’administration de la plateforme' }
const DAY = 86400_000
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : null)

export async function setPilot(orgId: string, data: { startedAt: string; baselineWaitMin: string | number; baselineDaily: string | number; notes?: string }) {
  if (!(await getSuperAdmin())) return DENIED
  const start = data.startedAt ? new Date(`${data.startedAt}T00:00:00Z`) : null
  if (start && Number.isNaN(start.getTime())) return { success: false as const, error: 'Date invalide' }
  const n = (v: string | number) => (v === '' || v == null ? null : Math.max(0, Math.round(Number(v))) || null)
  await prisma.organization.update({
    where: { id: orgId },
    data: { pilotStartedAt: start, pilotBaselineWaitMin: n(data.baselineWaitMin), pilotBaselineDaily: n(data.baselineDaily), pilotNotes: data.notes?.trim().slice(0, 2000) || null }
  })
  await audit({ action: 'PILOT_UPDATED', targetType: 'Organization', targetId: orgId, organizationId: orgId, details: start ? `début ${data.startedAt}` : 'pilote retiré' })
  revalidatePath(`/admin/clients/${orgId}/pilot`)
  return { success: true as const }
}

export async function getPilotReport(orgId: string) {
  if (!(await getSuperAdmin())) return null
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, city: true, category: true, logo: true, pilotStartedAt: true, pilotBaselineWaitMin: true, pilotBaselineDaily: true, pilotNotes: true, _count: { select: { branches: true, devices: true, members: true } } }
  })
  if (!org) return null
  const base = { org: { ...org, pilotStartedAt: org.pilotStartedAt?.toISOString() ?? null } }
  if (!org.pilotStartedAt) return { ...base, report: null }

  const start = org.pilotStartedAt
  const now = new Date()
  const days = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY))
  const total = (await metricsByOrg([orgId], start, now)).get(orgId)!

  // Semaine par semaine (8 au plus)
  const weeks: { label: string; tickets: number; avgWaitMin: number | null; absentRate: number | null; satisfaction: number | null }[] = []
  for (let w = 0; w < Math.min(8, Math.ceil(days / 7)); w++) {
    const from = new Date(start.getTime() + w * 7 * DAY)
    const to = new Date(Math.min(now.getTime(), from.getTime() + 7 * DAY))
    const m = (await metricsByOrg([orgId], from, to)).get(orgId)!
    weeks.push({ label: `S${w + 1}`, tickets: m.tickets, avgWaitMin: m.avgWaitMin, absentRate: pct(m.absent, m.tickets), satisfaction: m.satisfaction })
  }

  const ticketsPerDay = Math.round((total.tickets / days) * 10) / 10
  const waitGain = org.pilotBaselineWaitMin && total.avgWaitMin != null
    ? Math.round(((org.pilotBaselineWaitMin - total.avgWaitMin) / org.pilotBaselineWaitMin) * 100)
    : null
  const incidents = await prisma.errorEvent.count({ where: { lastSeen: { gte: start } } })

  return {
    ...base,
    report: {
      days, generatedAt: now.toISOString(),
      tickets: total.tickets, served: total.served, ticketsPerDay,
      avgWaitMin: total.avgWaitMin, avgServiceMin: total.avgServiceMin,
      absentRate: pct(total.absent, total.tickets), cancelledRate: pct(total.cancelled, total.tickets),
      satisfaction: total.satisfaction, ratings: total.ratings,
      waitGain, incidents, weeks
    }
  }
}
