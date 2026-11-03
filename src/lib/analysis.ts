import { prisma } from '@/lib/prisma'
import { anonymize, themeBreakdown } from '@/lib/feedback-themes'
import { reportSettings } from '@/lib/reports'

// Assistant d'analyse intégré : tout est calculé sur les données de l'établissement, sans service extérieur.
// Anomalies du jour (comparées à l'habitude du même jour et de la même heure), prévision de demain heure par heure
// avec les guichets nécessaires, thèmes des avis sur 8 semaines, recommandations par règles. Heures d'Abidjan (UTC).

const DAY = 86400_000
const WEEKS = 8

export interface Insight { tone: 'good' | 'bad' | 'neutral'; text: string; action?: { label: string; href: string } }

const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']

/** Sites de l'établissement dans le périmètre du lecteur. */
async function sitesIn(orgId: string, siteIds: string[] | null) {
  return prisma.branch.findMany({ where: { organizationId: orgId, isActive: true, ...(siteIds ? { id: { in: siteIds } } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } })
}

/** Visiteurs attendus demain par site et par heure, guichets nécessaires et disponibles. */
export async function forecastTomorrow(orgId: string, siteIds: string[] | null, now = new Date()) {
  const sites = await sitesIn(orgId, siteIds)
  if (!sites.length) return { weekday: '', sites: [] }
  const ids = sites.map(s => s.id)
  const tomorrow = new Date(midnight(now).getTime() + DAY)
  const weekday = tomorrow.getUTCDay()
  const from = new Date(tomorrow.getTime() - WEEKS * 7 * DAY)
  const [hourly, service, counters, defaults] = await Promise.all([
    prisma.$queryRaw<{ site: string; day: Date; hour: number; n: number }[]>`
      SELECT q."branchId" AS site, date_trunc('day', t."createdAt") AS day, EXTRACT(HOUR FROM t."createdAt")::int AS hour, count(*)::int AS n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId"
      WHERE q."branchId" = ANY(${ids}) AND t."createdAt" >= ${from} AND t."createdAt" < ${midnight(now)} AND EXTRACT(DOW FROM t."createdAt") = ${weekday} AND t.status <> 'CANCELLED'
      GROUP BY 1, 2, 3`,
    prisma.$queryRaw<{ site: string; minutes: number | null }[]>`
      SELECT q."branchId" AS site, avg(EXTRACT(EPOCH FROM (t."completedAt" - t."startedAt")) / 60)::float8 AS minutes
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId"
      WHERE q."branchId" = ANY(${ids}) AND t.status = 'COMPLETED' AND t."startedAt" IS NOT NULL AND t."completedAt" > t."startedAt"
        AND t."completedAt" - t."startedAt" < interval '2 hours' AND t."createdAt" >= ${new Date(now.getTime() - 28 * DAY)}
      GROUP BY 1`,
    prisma.counter.groupBy({ by: ['branchId'], where: { branchId: { in: ids }, isActive: true }, _count: { _all: true } }),
    prisma.service.groupBy({ by: ['branchId'], where: { branchId: { in: ids }, isActive: true }, _avg: { avgDurationMin: true } })
  ])
  return {
    weekday: DAYS_FR[weekday],
    sites: sites.map(s => {
      const rows = hourly.filter(h => h.site === s.id)
      const days = new Set(rows.map(r => new Date(r.day).toISOString().slice(0, 10))).size
      // Durée mesurée au guichet ; si elle est irréaliste (tickets clôturés d'un coup), durée réglée pour les services
      const measured = service.find(x => x.site === s.id)?.minutes ?? null
      const svc = measured != null && measured >= 1 ? measured : defaults.find(d => d.branchId === s.id)?._avg.avgDurationMin ?? 10
      const available = counters.find(c => c.branchId === s.id)?._count._all ?? 0
      const hours = Array.from({ length: 24 }, (_, h) => {
        const total = rows.filter(r => r.hour === h).reduce((a, r) => a + r.n, 0)
        const expected = days ? Math.round((total / days) * 10) / 10 : 0
        return { hour: h, expected, counters: expected ? Math.max(1, Math.ceil((expected * svc) / 60)) : 0 }
      }).filter(x => x.expected > 0)
      const peak = [...hours].sort((a, b) => b.expected - a.expected)[0] ?? null
      return { id: s.id, name: s.name, daysOfHistory: days, serviceMin: Math.round(svc), available, hours, peak, total: Math.round(hours.reduce((a, h) => a + h.expected, 0)) }
    })
  }
}

/** Aujourd'hui comparé à l'habitude (même jour de la semaine, jusqu'à la même heure, 8 dernières semaines). */
async function anomaliesToday(orgId: string, siteIds: string[] | null, now: Date): Promise<Insight[]> {
  const sites = await sitesIn(orgId, siteIds)
  if (!sites.length) return []
  const ids = sites.map(s => s.id)
  const today = midnight(now)
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const rows = await prisma.$queryRaw<{ site: string; today: boolean; n: number; wait: number | null; days: number }[]>`
    SELECT q."branchId" AS site, (t."createdAt" >= ${today}) AS today, count(*)::int AS n,
      avg(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait,
      count(DISTINCT date_trunc('day', t."createdAt"))::int AS days
    FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId"
    WHERE q."branchId" = ANY(${ids}) AND t.status <> 'CANCELLED' AND t."createdAt" >= ${new Date(today.getTime() - WEEKS * 7 * DAY)}
      AND EXTRACT(DOW FROM t."createdAt") = ${now.getUTCDay()}
      AND (EXTRACT(HOUR FROM t."createdAt") * 60 + EXTRACT(MINUTE FROM t."createdAt")) <= ${minutes}
    GROUP BY 1, 2`
  const out: Insight[] = []
  for (const s of sites) {
    const t = rows.find(r => r.site === s.id && r.today)
    const h = rows.find(r => r.site === s.id && !r.today)
    if (!t || !h || h.days < 2) continue
    const usual = h.n / h.days
    const label = sites.length > 1 ? ` à ${s.name}` : ''
    if (t.n >= 10 && t.n >= usual * 1.5) out.push({ tone: 'bad', text: `Affluence inhabituelle${label} : ${t.n} visiteurs depuis ce matin, contre ${Math.round(usual)} un ${DAYS_FR[now.getUTCDay()]} ordinaire à cette heure.`, action: { label: 'Voir la file', href: '/dashboard/queue' } })
    else if (usual >= 10 && t.n <= usual * 0.5) out.push({ tone: 'neutral', text: `Journée calme${label} : ${t.n} visiteurs depuis ce matin, contre ${Math.round(usual)} d’habitude.` })
    if (t.wait != null && h.wait != null && t.wait >= 15 && t.wait >= h.wait * 1.5) {
      out.push({ tone: 'bad', text: `Attente${label} ${Math.round(t.wait / h.wait * 10) / 10} fois plus longue que d’habitude : ${Math.round(t.wait)} min contre ${Math.round(h.wait)} min.`, action: { label: 'Voir les guichets', href: '/dashboard/counters' } })
    }
  }
  return out
}

/** Commentaires des 8 dernières semaines (avis négatifs et notes commentées), anonymisés. */
export async function recentComments(orgId: string, siteIds: string[] | null, now = new Date()) {
  const since = new Date(now.getTime() - WEEKS * 7 * DAY)
  const [tickets, staff] = await Promise.all([
    prisma.ticket.findMany({
      where: { npsComment: { not: null }, npsScore: { not: null }, createdAt: { gte: since }, queue: { branch: { organizationId: orgId, ...(siteIds ? { id: { in: siteIds } } : {}) } } },
      orderBy: { createdAt: 'desc' }, take: 400,
      select: { npsComment: true, npsScore: true, guestName: true, customer: { select: { name: true } }, user: { select: { name: true } } }
    }),
    prisma.organizationMember.findMany({ where: { organizationId: orgId }, select: { user: { select: { name: true } } } })
  ])
  const staffNames = staff.map(m => m.user.name).filter((n): n is string => !!n)
  return tickets.map(t => ({
    rating: t.npsScore!,
    comment: anonymize(t.npsComment!, [...staffNames, t.guestName, t.customer?.name, t.user?.name].filter((n): n is string => !!n))
  }))
}

/** Tout ce que l'assistant a à dire, pour le périmètre du lecteur. */
export async function getAnalysis(orgId: string, siteIds: string[] | null, now = new Date()) {
  const [forecast, anomalies, comments, settings, org, week] = await Promise.all([
    forecastTomorrow(orgId, siteIds, now),
    anomaliesToday(orgId, siteIds, now),
    recentComments(orgId, siteIds, now),
    reportSettings(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { smsTurnAlerts: true, apptNoShowBlock: true } }),
    prisma.$queryRaw<{ recent: boolean; wait: number | null; absent: number; n: number }[]>`
      SELECT (t."createdAt" >= ${new Date(now.getTime() - 7 * DAY)}) AS recent,
        avg(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" >= t."queuedAt")::float8 AS wait,
        count(*) FILTER (WHERE t.status = 'ABSENT')::int AS absent, count(*)::int AS n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
      WHERE b."organizationId" = ${orgId} AND (${siteIds}::text[] IS NULL OR b.id = ANY(${siteIds ?? []}))
        AND t."createdAt" >= ${new Date(now.getTime() - 35 * DAY)} AND t.status <> 'CANCELLED'
      GROUP BY 1`
  ])
  const themes = themeBreakdown(comments)
  const insights: Insight[] = [...anomalies]

  // Cette semaine comparée aux quatre précédentes
  const recent = week.find(w => w.recent)
  const before = week.find(w => !w.recent)
  if (recent?.wait != null && before?.wait != null && before.wait > 0) {
    const diff = Math.round(recent.wait - before.wait)
    if (diff <= -3) insights.push({ tone: 'good', text: `L’attente moyenne de la semaine baisse : ${Math.round(recent.wait)} min contre ${Math.round(before.wait)} min les quatre semaines précédentes.` })
    if (diff >= 3) insights.push({ tone: 'bad', text: `L’attente moyenne de la semaine monte : ${Math.round(recent.wait)} min contre ${Math.round(before.wait)} min les quatre semaines précédentes.` })
  }

  // Recommandations par règles
  const recos: Insight[] = []
  for (const s of forecast.sites) {
    const busy = s.hours.filter(h => h.counters > s.available && s.available > 0)
    if (busy.length && s.daysOfHistory >= 2) {
      const first = busy[0], last = busy[busy.length - 1]
      const need = Math.max(...busy.map(h => h.counters))
      recos.push({ tone: 'neutral', text: `Demain (${forecast.weekday})${forecast.sites.length > 1 ? ` à ${s.name}` : ''}, de ${first.hour} h à ${last.hour + 1} h, prévoyez ${need} guichets ouverts (vous en avez ${s.available}) : environ ${Math.round(Math.max(...busy.map(h => h.expected)))} visiteurs par heure attendus.`, action: { label: 'Planning', href: '/dashboard/planning' } })
    }
  }
  const absentRate = recent && recent.n ? recent.absent / recent.n : 0
  if (absentRate >= 0.1 && !org?.smsTurnAlerts) recos.push({ tone: 'neutral', text: `${Math.round(absentRate * 100)} % des visiteurs appelés étaient absents cette semaine : activez le SMS « bientôt votre tour » pour ceux qui n’ont pas l’application.`, action: { label: 'Activer', href: '/dashboard/settings/notifications' } })
  const topBad = themes.negative.themes[0]
  if (topBad && themes.negative.classified >= 3) {
    const advice: Record<string, string> = {
      WAIT: 'renforcez les guichets aux heures de pointe ou ouvrez des rendez-vous pour lisser l’affluence',
      WELCOME: 'faites un point d’équipe sur l’accueil et la politesse',
      ORIENTATION: 'affichez mieux les services à l’entrée et vérifiez l’orientation à l’accueil',
      COMFORT: 'vérifiez la propreté, la ventilation et le nombre de places assises',
      PRICE: 'affichez les tarifs à l’entrée et à l’accueil',
      APP: 'vérifiez les SMS et l’affichage du ticket (Console → Messages)'
    }
    recos.push({ tone: 'neutral', text: `Ce qui déplaît le plus : ${topBad.label.toLowerCase()} (${topBad.share} % des avis commentés) : ${advice[topBad.id] ?? 'regardez les avis concernés'}.`, action: { label: 'Voir les avis', href: '/dashboard/feedback' } })
  }
  if (org && org.apptNoShowBlock === 0) {
    const noShows = await prisma.appointment.count({ where: { organizationId: orgId, status: 'NO_SHOW', scheduledDate: { gte: new Date(now.getTime() - 30 * DAY) }, ...(siteIds ? { branchId: { in: siteIds } } : {}) } })
    if (noShows >= 5) recos.push({ tone: 'neutral', text: `${noShows} rendez-vous manqués ce mois-ci : vous pouvez bloquer la réservation en ligne après plusieurs absences.`, action: { label: 'Règles des RDV', href: '/dashboard/settings/appointments' } })
  }
  if (!insights.length) insights.push({ tone: 'good', text: 'Rien d’inhabituel aujourd’hui par rapport à vos journées ordinaires.' })

  return { insights, recommendations: recos, forecast, themes, waitAlertMin: settings.alerts.waitHigh.min, commentCount: comments.length }
}
