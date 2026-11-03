import { prisma } from '@/lib/prisma'
import { reportSettings } from '@/lib/reports'

// Vue direction : état des sites (en direct et sur 30 jours) avec objectifs, classement équitable des agents,
// valeur en FCFA (argent perdu par les absences, clients à risque, clients perdus, temps gagné), avant / après Lerena.
// Toujours limitée au périmètre du lecteur. Heures d'Abidjan (UTC).

const DAY = 86400_000
const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

/** Objectifs et valeur d'une visite proposés selon le secteur (modifiables). */
export function sectorDefaults(category: string | null | undefined) {
  const c = (category ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  if (/sant|hopital|clinique|pharma|medic|labo/.test(c)) return { targetWaitMin: 30, targetSatisfaction: 4, visitValue: 5000 }
  if (/banque|assur|finan|micro/.test(c)) return { targetWaitMin: 20, targetSatisfaction: 4.2, visitValue: 3000 }
  if (/mairie|admin|prefecture|public|ministere|impot|etat/.test(c)) return { targetWaitMin: 45, targetSatisfaction: 3.8, visitValue: 2000 }
  if (/telecom|operateur|agence|commerce|boutique/.test(c)) return { targetWaitMin: 15, targetSatisfaction: 4.2, visitValue: 2500 }
  return { targetWaitMin: 30, targetSatisfaction: 4, visitValue: null as number | null }
}

const avg = (sum: number | null, n: number) => (n && sum != null ? Math.round((sum / n) * 10) / 10 : null)

/** Chaque site : en direct (attente, file), aujourd'hui, 30 derniers jours, objectifs et pastille. */
export async function sitesOverview(orgId: string, siteIds: string[] | null, now = new Date()) {
  const [org, branches, settings] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { category: true } }),
    prisma.branch.findMany({ where: { organizationId: orgId, isActive: true, ...(siteIds ? { id: { in: siteIds } } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, city: true, lat: true, lng: true, targetWaitMin: true, targetSatisfaction: true } }),
    reportSettings(orgId)
  ])
  const ids = branches.map(b => b.id)
  if (!ids.length) return []
  const today = midnight(now)
  const from30 = new Date(now.getTime() - 30 * DAY)
  const [live, day, month, appts, complaints, counters] = await Promise.all([
    prisma.$queryRaw<{ site: string; waiting: number; oldest: Date | null }[]>`
      SELECT q."branchId" AS site, count(*)::int AS waiting, min(t."queuedAt") AS oldest FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId"
      WHERE q."branchId" = ANY(${ids}) AND t.status = 'WAITING' AND t."createdAt" >= ${today} GROUP BY 1`,
    prisma.$queryRaw<{ site: string; n: number; wait_sum: number | null; wait_n: number }[]>`
      SELECT q."branchId" AS site, count(*)::int AS n,
        sum(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait_sum,
        count(*) FILTER (WHERE t."calledAt" >= t."queuedAt")::int AS wait_n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" WHERE q."branchId" = ANY(${ids}) AND t."createdAt" >= ${today} AND t.status <> 'CANCELLED' GROUP BY 1`,
    prisma.$queryRaw<{ site: string; n: number; wait_sum: number | null; wait_n: number; rating_sum: number | null; rating_n: number }[]>`
      SELECT q."branchId" AS site, count(*)::int AS n,
        sum(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait_sum,
        count(*) FILTER (WHERE t."calledAt" >= t."queuedAt")::int AS wait_n,
        sum(t."npsScore")::float8 AS rating_sum, count(t."npsScore")::int AS rating_n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" WHERE q."branchId" = ANY(${ids}) AND t."createdAt" >= ${from30} AND t.status <> 'CANCELLED' GROUP BY 1`,
    prisma.$queryRaw<{ site: string; total: number; no_show: number }[]>`
      SELECT "branchId" AS site, count(*) FILTER (WHERE status <> 'CANCELLED')::int AS total, count(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_show
      FROM "Appointment" WHERE "branchId" = ANY(${ids}) AND "scheduledDate" >= ${from30} AND "scheduledDate" < ${now} GROUP BY 1`,
    prisma.$queryRaw<{ site: string; n: number }[]>`
      SELECT q."branchId" AS site, count(*)::int AS n FROM "Complaint" c JOIN "Ticket" t ON t.id = c."ticketId" JOIN "Queue" q ON q.id = t."queueId"
      WHERE q."branchId" = ANY(${ids}) AND c.status = 'OPEN' GROUP BY 1`,
    prisma.counter.groupBy({ by: ['branchId'], where: { branchId: { in: ids }, isActive: true }, _count: { _all: true } })
  ])
  const defaults = sectorDefaults(org?.category)
  return branches.map(b => {
    const l = live.find(x => x.site === b.id), d = day.find(x => x.site === b.id), m = month.find(x => x.site === b.id), a = appts.find(x => x.site === b.id)
    const targetWait = b.targetWaitMin ?? defaults.targetWaitMin
    const targetSat = b.targetSatisfaction ?? defaults.targetSatisfaction
    const waitNow = l?.oldest ? Math.round((now.getTime() - new Date(l.oldest).getTime()) / 60000) : 0
    const wait30 = avg(m?.wait_sum ?? null, m?.wait_n ?? 0)
    const sat30 = avg(m?.rating_sum ?? null, m?.rating_n ?? 0)
    const open = complaints.find(x => x.site === b.id)?.n ?? 0
    const reasons: string[] = []
    let status: 'green' | 'orange' | 'red' = 'green'
    if (waitNow >= settings.alerts.waitHigh.min) { status = 'red'; reasons.push(`attente de ${waitNow} min en ce moment`) }
    if (open >= 3) { status = 'red'; reasons.push(`${open} avis à traiter`) }
    if (sat30 != null && sat30 < targetSat - 0.5) { status = 'red'; reasons.push(`satisfaction ${String(sat30).replace('.', ',')}/5`) }
    if (status !== 'red') {
      if (wait30 != null && wait30 > targetWait) { status = 'orange'; reasons.push(`attente moyenne ${Math.round(wait30)} min (objectif ${targetWait})`) }
      if (sat30 != null && sat30 < targetSat) { status = 'orange'; reasons.push(`satisfaction sous l’objectif`) }
      if (open > 0) { status = 'orange'; reasons.push(`${open} avis à traiter`) }
    }
    return {
      id: b.id, name: b.name, city: b.city, lat: b.lat, lng: b.lng, status, reasons,
      waitingNow: l?.waiting ?? 0, waitNow, visitorsToday: d?.n ?? 0, waitToday: avg(d?.wait_sum ?? null, d?.wait_n ?? 0),
      wait30, satisfaction30: sat30, ratings30: m?.rating_n ?? 0, visitors30: m?.n ?? 0,
      noShowRate30: a?.total ? Math.round((a.no_show / a.total) * 100) : null,
      openComplaints: open, counters: counters.find(c => c.branchId === b.id)?._count._all ?? 0,
      targets: { waitMin: targetWait, satisfaction: targetSat, custom: b.targetWaitMin != null || b.targetSatisfaction != null },
      waitOnTarget: wait30 == null ? null : wait30 <= targetWait, satOnTarget: sat30 == null ? null : sat30 >= targetSat
    }
  }).sort((x, y) => ({ red: 0, orange: 1, green: 2 }[x.status] - { red: 0, orange: 1, green: 2 }[y.status]) || y.waitNow - x.waitNow)
}

export const MIN_TICKETS_FOR_RANKING = 20

/**
 * Classement équitable des agents : vitesse comparée à la moyenne du même service (100 = moyenne),
 * satisfaction des visiteurs servis, avis négatifs. Minimum 20 visiteurs servis sur la période pour apparaître.
 */
export async function agentRanking(orgId: string, siteIds: string[] | null, days = 30, now = new Date()) {
  const from = new Date(now.getTime() - days * DAY)
  const sites = siteIds ?? (await prisma.branch.findMany({ where: { organizationId: orgId }, select: { id: true } })).map(b => b.id)
  if (!sites.length) return { days, agents: [], eligible: 0 }
  const rows = await prisma.$queryRaw<{ agent: string; service: string; n: number; dur: number | null; rating_sum: number | null; rating_n: number; complaints: number }[]>`
    SELECT s."agentId" AS agent, s."serviceId" AS service, count(*)::int AS n, avg(s."durationSeconds")::float8 AS dur,
      sum(t."npsScore")::float8 AS rating_sum, count(t."npsScore")::int AS rating_n, count(c.id)::int AS complaints
    FROM "ServiceSession" s JOIN "Ticket" t ON t.id = s."ticketId" JOIN "Queue" q ON q.id = t."queueId"
    LEFT JOIN "Complaint" c ON c."ticketId" = t.id
    WHERE q."branchId" = ANY(${sites}) AND s."completedAt" >= ${from} AND s."durationSeconds" BETWEEN 15 AND 7200
    GROUP BY 1, 2`
  // Moyenne de chaque service, pondérée par le nombre de visiteurs servis
  const serviceAvg = new Map<string, number>()
  for (const svc of Array.from(new Set(rows.map(r => r.service)))) {
    const list = rows.filter(r => r.service === svc && r.dur != null)
    const n = list.reduce((a, r) => a + r.n, 0)
    if (n) serviceAvg.set(svc, list.reduce((a, r) => a + (r.dur ?? 0) * r.n, 0) / n)
  }
  const agentIds = Array.from(new Set(rows.map(r => r.agent)))
  const users = await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
  const agents = agentIds.map(id => {
    const list = rows.filter(r => r.agent === id)
    const served = list.reduce((a, r) => a + r.n, 0)
    const expected = list.reduce((a, r) => a + (serviceAvg.get(r.service) ?? 0) * r.n, 0)
    const actual = list.reduce((a, r) => a + (r.dur ?? 0) * r.n, 0)
    const ratingN = list.reduce((a, r) => a + r.rating_n, 0)
    const satisfaction = ratingN ? Math.round((list.reduce((a, r) => a + (r.rating_sum ?? 0), 0) / ratingN) * 10) / 10 : null
    const complaints = list.reduce((a, r) => a + r.complaints, 0)
    const speed = actual ? Math.round((expected / actual) * 100) : null
    const score = (satisfaction != null ? (satisfaction / 5) * 60 : 36) + (speed != null ? (Math.min(speed, 150) / 150) * 40 : 20) - complaints * 4
    return { id, name: users.find(u => u.id === id)?.name ?? 'Agent', served, avgMin: served ? Math.round((actual / served / 60) * 10) / 10 : null, speed, satisfaction, ratings: ratingN, complaints, score: Math.round(score), eligible: served >= MIN_TICKETS_FOR_RANKING }
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score)
  return { days, agents, eligible: agents.filter(a => a.eligible).length }
}

/** Valeur d'une visite par service, sinon celle de l'établissement. */
async function visitValues(orgId: string) {
  const [org, services] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { defaultVisitValue: true, category: true } }),
    prisma.service.findMany({ where: { branch: { organizationId: orgId } }, select: { id: true, visitValue: true } })
  ])
  const fallback = org?.defaultVisitValue ?? null
  const byService = new Map(services.map(s => [s.id, s.visitValue ?? fallback]))
  const known = services.map(s => s.visitValue ?? fallback).filter((v): v is number => v != null)
  return { byService, fallback, average: known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : fallback, configured: known.length > 0, suggestion: sectorDefaults(org?.category).visitValue }
}

/** Argent perdu par les absences du mois, clients à risque, clients perdus, temps gagné depuis Lerena. */
export async function moneyView(orgId: string, siteIds: string[] | null, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const values = await visitValues(orgId)
  const scope = siteIds ? { OR: [{ tickets: { some: { queue: { branchId: { in: siteIds } } } } }, { appointments: { some: { branchId: { in: siteIds } } } }] } : {}
  const [noShows, regulars, org, month] = await Promise.all([
    prisma.appointment.findMany({ where: { organizationId: orgId, status: 'NO_SHOW', scheduledDate: { gte: monthStart, lt: now }, ...(siteIds ? { branchId: { in: siteIds } } : {}) }, select: { serviceId: true } }),
    prisma.customer.findMany({
      where: { organizationId: orgId, visits: { gte: 2 }, lastVisitAt: { not: null, gte: new Date(now.getTime() - 365 * DAY) }, ...scope },
      select: { id: true, name: true, phone: true, visits: true, firstSeenAt: true, lastVisitAt: true, consentAt: true, optedOutAt: true },
      take: 5000
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { pilotStartedAt: true, pilotBaselineWaitMin: true, pilotBaselineDaily: true } }),
    prisma.$queryRaw<{ served: number; wait_sum: number | null; wait_n: number }[]>`
      SELECT count(*) FILTER (WHERE t.status = 'COMPLETED')::int AS served,
        sum(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait_sum,
        count(*) FILTER (WHERE t."calledAt" >= t."queuedAt")::int AS wait_n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
      WHERE b."organizationId" = ${orgId} AND (${siteIds}::text[] IS NULL OR b.id = ANY(${siteIds ?? []})) AND t."createdAt" >= ${monthStart}`
  ])
  const lostAmount = values.configured ? noShows.reduce((a, n) => a + ((n.serviceId ? values.byService.get(n.serviceId) : values.fallback) ?? values.average ?? 0), 0) : null

  // Rythme habituel de chaque client : un habitué qui laisse passer plus du double de son intervalle (et 30 jours) est à risque
  const unit = values.average ?? 0
  const scored = regulars.map(c => {
    const span = Math.max(DAY, c.lastVisitAt!.getTime() - c.firstSeenAt.getTime())
    const interval = span / Math.max(1, c.visits - 1)
    const since = now.getTime() - c.lastVisitAt!.getTime()
    const perYear = Math.min(52, (c.visits / Math.max(span, 30 * DAY)) * 365 * DAY)
    return { ...c, intervalDays: Math.round(interval / DAY), sinceDays: Math.round(since / DAY), annualValue: Math.round(perYear * unit), late: since > Math.max(2 * interval, 30 * DAY) }
  })
  const atRisk = scored.filter(c => c.visits >= 3 && c.late && c.sinceDays <= 180).sort((a, b) => b.annualValue - a.annualValue)
  const lost = scored.filter(c => c.sinceDays > 90)

  const served = month[0]?.served ?? 0
  const waitNow = month[0]?.wait_n ? (month[0].wait_sum ?? 0) / month[0].wait_n : null
  const baseline = org?.pilotBaselineWaitMin ?? null
  const hoursSaved = baseline != null && waitNow != null && baseline > waitNow ? Math.round(((baseline - waitNow) * served) / 60) : null

  return {
    valuesConfigured: values.configured, visitValue: values.average, suggestion: values.suggestion,
    noShows: noShows.length, lostAmount,
    atRisk: { count: atRisk.length, value: atRisk.reduce((a, c) => a + c.annualValue, 0), list: atRisk.slice(0, 50).map(c => ({ id: c.id, name: c.name, phone: c.phone, visits: c.visits, intervalDays: c.intervalDays, sinceDays: c.sinceDays, annualValue: c.annualValue, reachable: !!c.consentAt && !c.optedOutAt })) },
    lost: { count: lost.length, value: lost.reduce((a, c) => a + c.annualValue, 0) },
    timeSaved: { baselineMin: baseline, currentMin: waitNow != null ? Math.round(waitNow) : null, served, hours: hoursSaved, workDays: hoursSaved != null ? Math.round(hoursSaved / 8) : null }
  }
}

/** Avant / après Lerena : relevé de départ comparé aux 30 derniers jours. */
export async function beforeAfter(orgId: string, siteIds: string[] | null, now = new Date()) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, logo: true, pilotStartedAt: true, pilotBaselineWaitMin: true, pilotBaselineDaily: true, createdAt: true } })
  if (!org) return null
  const start = org.pilotStartedAt ?? org.createdAt
  const from30 = new Date(now.getTime() - 30 * DAY)
  const rows = await prisma.$queryRaw<{ recent: boolean; n: number; served: number; wait_sum: number | null; wait_n: number; rating_sum: number | null; rating_n: number; absent: number; days: number }[]>`
    SELECT (t."createdAt" >= ${from30}) AS recent, count(*)::int AS n, count(*) FILTER (WHERE t.status = 'COMPLETED')::int AS served,
      sum(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait_sum,
      count(*) FILTER (WHERE t."calledAt" >= t."queuedAt")::int AS wait_n,
      sum(t."npsScore")::float8 AS rating_sum, count(t."npsScore")::int AS rating_n,
      count(*) FILTER (WHERE t.status = 'ABSENT')::int AS absent, count(DISTINCT date_trunc('day', t."createdAt"))::int AS days
    FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
    WHERE b."organizationId" = ${orgId} AND (${siteIds}::text[] IS NULL OR b.id = ANY(${siteIds ?? []})) AND t."createdAt" >= ${start} AND t.status <> 'CANCELLED'
    GROUP BY 1`
  const recent = rows.find(r => r.recent)
  const all = { n: rows.reduce((a, r) => a + r.n, 0), served: rows.reduce((a, r) => a + r.served, 0), waitSum: rows.reduce((a, r) => a + (r.wait_sum ?? 0), 0), waitN: rows.reduce((a, r) => a + r.wait_n, 0) }
  const waitRecent = recent?.wait_n ? Math.round((recent.wait_sum ?? 0) / recent.wait_n) : null
  const waitSince = all.waitN ? all.waitSum / all.waitN : null
  const baseline = org.pilotBaselineWaitMin
  return {
    orgName: org.name, logo: org.logo, startedAt: start, baselineSet: baseline != null,
    before: { waitMin: baseline, dailyVisitors: org.pilotBaselineDaily },
    after: {
      waitMin: waitRecent,
      dailyVisitors: recent?.days ? Math.round(recent.n / recent.days) : null,
      satisfaction: recent?.rating_n ? Math.round(((recent.rating_sum ?? 0) / recent.rating_n) * 10) / 10 : null,
      absentRate: recent?.n ? Math.round((recent.absent / recent.n) * 100) : null
    },
    waitGainPct: baseline && waitRecent != null ? Math.round(((baseline - waitRecent) / baseline) * 100) : null,
    hoursSaved: baseline != null && waitSince != null && baseline > waitSince ? Math.round(((baseline - waitSince) * all.served) / 60) : null,
    servedSince: all.served
  }
}
