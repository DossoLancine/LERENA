import { prisma } from '@/lib/prisma'
import { appUrl, sendEmail } from '@/lib/messaging'
import { notify } from '@/lib/notifications'
import { effectiveRole, permissionsOf } from '@/lib/access-catalog'
import { headline, REPORT_KINDS, summarize, type ReportData, type ReportKind, type SiteFigures, type Summary } from '@/lib/report-summary'
import { moneyView } from '@/lib/direction'

// Rapports préparés par Lerena (aucune IA extérieure) : quotidien (facultatif), hebdomadaire le lundi, mensuel le 1er,
// à 8 h (heure d'Abidjan = UTC). Archivés dans l'application, annoncés par notification, envoyés par e-mail
// aux directeurs (selon leurs préférences) et aux adresses ajoutées. Chacun reçoit la synthèse de ses seuls sites.

const DAY = 86400_000
const SEND_HOUR = 8

export const ALERT_DEFAULTS = {
  waitHigh: { on: true, min: 45 },
  queueLong: { on: true, max: 30 },
  noCall: { on: true, min: 20 },
  complaintBurst: { on: true, count: 3 }
}
export type AlertSettings = typeof ALERT_DEFAULTS

export async function reportSettings(orgId: string) {
  const s = await prisma.reportSettings.findUnique({ where: { organizationId: orgId } })
  const alerts = (s?.alerts ?? {}) as Partial<AlertSettings>
  return {
    daily: s?.daily ?? false, weekly: s?.weekly ?? true, monthly: s?.monthly ?? true, extraEmails: s?.extraEmails ?? [],
    alerts: {
      waitHigh: { ...ALERT_DEFAULTS.waitHigh, ...alerts.waitHigh },
      queueLong: { ...ALERT_DEFAULTS.queueLong, ...alerts.queueLong },
      noCall: { ...ALERT_DEFAULTS.noCall, ...alerts.noCall },
      complaintBurst: { ...ALERT_DEFAULTS.complaintBurst, ...alerts.complaintBurst }
    }
  }
}

const midnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

/** Période couverte par un rapport émis à cette date, et la période précédente de même durée. */
export function periodFor(kind: ReportKind, now = new Date()) {
  const today = midnight(now)
  if (kind === 'DAILY') return { start: new Date(today.getTime() - DAY), end: today, prevStart: new Date(today.getTime() - 2 * DAY) }
  if (kind === 'WEEKLY') {
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY)
    return { start: new Date(monday.getTime() - 7 * DAY), end: monday, prevStart: new Date(monday.getTime() - 14 * DAY) }
  }
  if (kind === 'MONTHLY') {
    const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    return { start, end: first, prevStart: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 2, 1)) }
  }
  return { start: new Date(today.getTime() - 7 * DAY), end: new Date(now), prevStart: new Date(today.getTime() - 14 * DAY) }
}

/** Chiffres par site sur une période (quatre requêtes groupées). */
export async function siteFigures(orgId: string, from: Date, to: Date): Promise<SiteFigures[]> {
  const [branches, tickets, appts, complaints, peaks] = await Promise.all([
    prisma.branch.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.$queryRaw<{ id: string; tickets: number; served: number; absent: number; wait_sum: number | null; wait_count: number; rating_sum: number | null; rating_count: number }[]>`
      SELECT q."branchId" AS id, count(*)::int AS tickets,
        count(*) FILTER (WHERE t.status = 'COMPLETED')::int AS served,
        count(*) FILTER (WHERE t.status = 'ABSENT')::int AS absent,
        sum(EXTRACT(EPOCH FROM (t."calledAt" - t."queuedAt")) / 60) FILTER (WHERE t."calledAt" IS NOT NULL AND t."calledAt" >= t."queuedAt")::float8 AS wait_sum,
        count(*) FILTER (WHERE t."calledAt" IS NOT NULL AND t."calledAt" >= t."queuedAt")::int AS wait_count,
        sum(t."npsScore")::float8 AS rating_sum, count(t."npsScore")::int AS rating_count
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
      WHERE b."organizationId" = ${orgId} AND t."createdAt" >= ${from} AND t."createdAt" < ${to} AND t.status <> 'CANCELLED'
      GROUP BY q."branchId"`,
    prisma.$queryRaw<{ id: string; total: number; no_shows: number }[]>`
      SELECT "branchId" AS id, count(*) FILTER (WHERE status <> 'CANCELLED')::int AS total, count(*) FILTER (WHERE status = 'NO_SHOW')::int AS no_shows
      FROM "Appointment" WHERE "organizationId" = ${orgId} AND "scheduledDate" >= ${from} AND "scheduledDate" < ${to} AND "scheduledDate" < now()
      GROUP BY "branchId"`,
    prisma.$queryRaw<{ id: string; n: number }[]>`
      SELECT q."branchId" AS id, count(*)::int AS n FROM "Complaint" c JOIN "Ticket" t ON t.id = c."ticketId" JOIN "Queue" q ON q.id = t."queueId"
      WHERE c."organizationId" = ${orgId} AND c."createdAt" >= ${from} AND c."createdAt" < ${to} GROUP BY q."branchId"`,
    prisma.$queryRaw<{ id: string; hour: number; n: number }[]>`
      SELECT q."branchId" AS id, EXTRACT(HOUR FROM t."createdAt")::int AS hour, count(*)::int AS n
      FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
      WHERE b."organizationId" = ${orgId} AND t."createdAt" >= ${from} AND t."createdAt" < ${to} GROUP BY 1, 2`
  ])
  return branches.map(b => {
    const t = tickets.find(x => x.id === b.id)
    const a = appts.find(x => x.id === b.id)
    const top = peaks.filter(p => p.id === b.id).sort((x, y) => y.n - x.n)[0]
    return {
      id: b.id, name: b.name,
      tickets: t?.tickets ?? 0, served: t?.served ?? 0, absent: t?.absent ?? 0,
      waitSum: Math.round(t?.wait_sum ?? 0), waitCount: t?.wait_count ?? 0,
      ratingSum: t?.rating_sum ?? 0, ratingCount: t?.rating_count ?? 0,
      appointments: a?.total ?? 0, noShows: a?.no_shows ?? 0,
      complaints: complaints.find(x => x.id === b.id)?.n ?? 0,
      peakHour: top?.hour ?? null
    }
  })
}

/** Destinataires internes : directeurs et responsables qui voient les statistiques, avec leur périmètre. */
async function reportReaders(orgId: string) {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId, disabledAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { userId: true, role: true, accessRole: true, siteIds: true, regionIds: true }
  })
  const branches = await prisma.branch.findMany({ where: { organizationId: orgId }, select: { id: true, regionId: true } })
  return members
    .map(m => ({ ...m, accessRole: effectiveRole(m.accessRole, m.role) }))
    .filter(m => ['OWNER', 'DG', 'REGIONAL', 'SITE_MANAGER'].includes(m.accessRole) && permissionsOf(m.accessRole).includes('stats.view'))
    .map(m => ({
      userId: m.userId,
      siteIds: m.siteIds.length || m.regionIds.length ? Array.from(new Set([...m.siteIds, ...branches.filter(b => b.regionId && m.regionIds.includes(b.regionId)).map(b => b.id)])) : null
    }))
}

const fmtDay = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })
export const periodLabel = (kind: ReportKind, start: Date, end: Date) =>
  kind === 'DAILY' ? fmtDay(start) : kind === 'MONTHLY' ? start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : `du ${fmtDay(start)} au ${fmtDay(new Date(end.getTime() - 1))}`

function emailHtml(title: string, orgName: string, s: Summary, url: string) {
  const kpi = (label: string, value: string) => `<td style="padding:12px;border:1px solid #eee;border-radius:8px"><div style="font-size:12px;color:#6b7280">${label}</div><div style="font-size:22px;font-weight:700;color:#111827">${value}</div></td>`
  const v = (n: number | null, unit = '') => (n == null ? '—' : `${String(n).replace('.', ',')}${unit}`)
  const lines = s.lines.map(l => `<li style="margin:4px 0;color:${l.tone === 'bad' ? '#b91c1c' : l.tone === 'good' ? '#15803d' : '#374151'}">${l.text}</li>`).join('')
  const watch = s.watch.length ? `<p style="font-weight:600;margin:16px 0 4px">Sites à surveiller</p><ul>${s.watch.map(w => `<li>${w.name} : ${w.reasons.join(', ')}</li>`).join('')}</ul>` : ''
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827">
    <p style="color:#c2410c;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">${orgName}</p>
    <h1 style="font-size:20px;margin:4px 0 16px">${title}</h1>
    <table style="border-collapse:separate;border-spacing:6px;width:100%"><tr>${kpi('Visiteurs', String(s.now.visitors))}${kpi('Attente moyenne', v(s.now.avgWait, ' min'))}</tr>
    <tr>${kpi('Satisfaction', v(s.now.satisfaction, '/5'))}${kpi('Absences aux RDV', v(s.now.noShowRate, ' %'))}</tr></table>
    <ul style="padding-left:18px">${lines}</ul>${watch}
    <p style="margin-top:20px"><a href="${url}" style="background:#c2410c;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Voir le rapport complet</a></p>
    <p style="font-size:11px;color:#9ca3af;margin-top:24px">Lerena · rapports réglables dans Rapports → Réglages</p></div>`
}

/** Crée le rapport (s'il n'existe pas déjà) et l'annonce ; renvoie son identifiant. */
export async function issueReport(orgId: string, kind: ReportKind, now = new Date(), onlyUserId?: string) {
  const p = periodFor(kind, now)
  const settings = await reportSettings(orgId)
  const [sites, previous, org] = await Promise.all([
    siteFigures(orgId, p.start, p.end),
    siteFigures(orgId, p.prevStart, p.start),
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
  ])
  const money = await moneyView(orgId, null, now).catch(() => null)
  const data: ReportData = {
    sites, previous, waitAlertMin: settings.alerts.waitHigh.min,
    ...(money?.valuesConfigured ? { money: { lostAmount: money.lostAmount, noShows: money.noShows, atRisk: money.atRisk.count, atRiskValue: money.atRisk.value } } : {})
  }
  let reportId: string
  if (kind === 'SAMPLE') {
    reportId = (await prisma.report.create({ data: { organizationId: orgId, kind, periodStart: now, periodEnd: p.end, data: data as object }, select: { id: true } })).id
  } else {
    const created = await prisma.report.create({ data: { organizationId: orgId, kind, periodStart: p.start, periodEnd: p.end, data: data as object }, select: { id: true } }).catch(() => null)
    if (!created) return null // déjà émis (autre passage des tâches automatiques)
    reportId = created.id
  }
  const url = `/dashboard/reports/${reportId}`
  const title = `${REPORT_KINDS[kind].label} · ${periodLabel(kind, p.start, p.end)}`

  const readers = (await reportReaders(orgId)).filter(r => !onlyUserId || r.userId === onlyUserId)
  for (const r of readers) {
    const s = summarize(data, r.siteIds)
    const bad = s.lines.filter(l => l.tone === 'bad').length
    await notify({ event: 'REPORT_READY', orgId, userIds: [r.userId], url, title, body: `${headline(s)}${bad ? ` · ${bad} point${bad > 1 ? 's' : ''} d’attention` : ''}` })
  }
  // Adresses ajoutées (DG, DAF hors de l'équipe) : e-mail complet, vue de tout l'établissement
  if (!onlyUserId) {
    const s = summarize(data, null)
    for (const to of settings.extraEmails) {
      await sendEmail({ to, subject: title, text: `${title}\n\n${headline(s)}\n\n${s.lines.map(l => `• ${l.text}`).join('\n')}\n\n${appUrl()}${url}`, html: emailHtml(title, org?.name ?? '', s, `${appUrl()}${url}`), purpose: 'REPORT', organizationId: orgId })
    }
  }
  return reportId
}

/** Tâche automatique : rapports dus de tous les établissements actifs. */
export async function runReportJobs(now = new Date()) {
  if (now.getUTCHours() < SEND_HOUR) return { reports: 0 }
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true } })
  let issued = 0
  for (const o of orgs) {
    const s = await reportSettings(o.id)
    const due: ReportKind[] = []
    if (s.daily) due.push('DAILY')
    if (s.weekly && now.getUTCDay() === 1) due.push('WEEKLY')
    if (s.monthly && now.getUTCDate() === 1) due.push('MONTHLY')
    for (const kind of due) {
      const p = periodFor(kind, now)
      const exists = await prisma.report.findUnique({ where: { organizationId_kind_periodStart: { organizationId: o.id, kind, periodStart: p.start } }, select: { id: true } })
      if (exists) continue
      if (await issueReport(o.id, kind, now).catch(error => { console.error('Report error:', error); return null })) issued++
    }
  }
  return { reports: issued }
}
