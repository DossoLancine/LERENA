import { prisma } from '@/lib/prisma'
import { claimOnce } from '@/lib/locks'
import { notify } from '@/lib/notifications'
import { reportSettings } from '@/lib/reports'

// Alertes en direct (établissements ouverts) : attente trop longue, file trop longue, personne appelé alors que
// des visiteurs attendent, avis négatifs en rafale. Évaluées au fil de l'activité (au plus toutes les 5 minutes) ;
// une même alerte ne se répète pas avant 1 heure. Envoyées aux membres dont le périmètre couvre le site.

const MIN = 60_000

/** Verrou « une fois par heure » pour une alerte et un site (la ligne de JobRun sert de verrou). */
const once = (key: string, now: Date) => claimOnce(`alert:${key}:${now.toISOString().slice(0, 13)}`, now)

export async function runLiveAlerts(now = new Date()) {
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const waiting = await prisma.ticket.groupBy({
    by: ['queueId'], where: { status: 'WAITING', createdAt: { gte: today }, queue: { branch: { organization: { isActive: true } } } },
    _count: { _all: true }, _min: { queuedAt: true }
  })
  let sent = 0
  if (waiting.length) {
    const queueIds = waiting.map(w => w.queueId)
    const [queues, lastCalls] = await Promise.all([
      prisma.queue.findMany({ where: { id: { in: queueIds } }, select: { id: true, branchId: true, branch: { select: { name: true, organizationId: true } } } }),
      prisma.ticket.groupBy({ by: ['queueId'], where: { queueId: { in: queueIds }, calledAt: { gte: today } }, _max: { calledAt: true } })
    ])
    // Par site : personnes en attente, plus ancienne entrée en file, dernier appel
    const sites = new Map<string, { orgId: string; name: string; count: number; oldest: Date; lastCall: Date | null }>()
    for (const w of waiting) {
      const q = queues.find(x => x.id === w.queueId)
      if (!q || !w._min.queuedAt) continue
      const cur = sites.get(q.branchId) ?? { orgId: q.branch.organizationId, name: q.branch.name, count: 0, oldest: w._min.queuedAt, lastCall: null }
      cur.count += w._count._all
      if (w._min.queuedAt < cur.oldest) cur.oldest = w._min.queuedAt
      const lc = lastCalls.find(l => l.queueId === w.queueId)?._max.calledAt ?? null
      if (lc && (!cur.lastCall || lc > cur.lastCall)) cur.lastCall = lc
      sites.set(q.branchId, cur)
    }
    const settingsCache = new Map<string, Awaited<ReturnType<typeof reportSettings>>>()
    for (const [siteId, s] of Array.from(sites)) {
      if (!settingsCache.has(s.orgId)) settingsCache.set(s.orgId, await reportSettings(s.orgId))
      const a = settingsCache.get(s.orgId)!.alerts
      const waitedMin = Math.round((now.getTime() - s.oldest.getTime()) / MIN)
      if (a.waitHigh.on && waitedMin >= a.waitHigh.min && await once(`wait:${siteId}`, now)) {
        await notify({ event: 'WAIT_HIGH', orgId: s.orgId, siteId, url: '/dashboard/queue', title: `Attente de ${waitedMin} min · ${s.name}`, body: `${s.count} personne${s.count > 1 ? 's' : ''} en attente ; la plus ancienne depuis ${waitedMin} min (seuil ${a.waitHigh.min} min).` })
        sent++
      }
      if (a.queueLong.on && s.count > a.queueLong.max && await once(`queue:${siteId}`, now)) {
        await notify({ event: 'QUEUE_LONG', orgId: s.orgId, siteId, url: '/dashboard/queue', title: `${s.count} personnes en attente · ${s.name}`, body: `Au-dessus de votre seuil de ${a.queueLong.max}. Ouvrez un guichet de plus si possible.` })
        sent++
      }
      const silentMin = Math.round((now.getTime() - (s.lastCall ?? s.oldest).getTime()) / MIN)
      if (a.noCall.on && silentMin >= a.noCall.min && await once(`nocall:${siteId}`, now)) {
        await notify({ event: 'SITE_NO_COUNTER', orgId: s.orgId, siteId, url: '/dashboard/counters', title: `Personne n’est appelé · ${s.name}`, body: `${s.count} personne${s.count > 1 ? 's' : ''} attend${s.count > 1 ? 'ent' : ''}, aucun appel depuis ${silentMin} min : un guichet est-il ouvert ?` })
        sent++
      }
    }
  }

  // Avis négatifs en rafale (dernière heure), par site
  const burst = await prisma.$queryRaw<{ org_id: string; site_id: string; name: string; n: number }[]>`
    SELECT c."organizationId" AS org_id, q."branchId" AS site_id, b.name, count(*)::int AS n
    FROM "Complaint" c JOIN "Ticket" t ON t.id = c."ticketId" JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
    WHERE c."createdAt" >= ${new Date(now.getTime() - 60 * MIN)} GROUP BY 1, 2, 3`
  for (const r of burst) {
    const a = (await reportSettings(r.org_id)).alerts.complaintBurst
    if (!a.on || r.n < a.count || !(await once(`burst:${r.site_id}`, now))) continue
    await notify({ event: 'COMPLAINT_BURST', orgId: r.org_id, siteId: r.site_id, url: '/dashboard/feedback', title: `${r.n} avis négatifs en une heure · ${r.name}`, body: 'Quelque chose ne va pas sur ce site : regardez les avis et l’attente.' })
    sent++
  }
  return { liveAlerts: sent }
}
