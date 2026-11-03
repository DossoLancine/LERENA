'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { issueReport, periodLabel, reportSettings, ALERT_DEFAULTS, type AlertSettings } from '@/lib/reports'
import { headline, REPORT_KINDS, summarize, type ReportData, type ReportKind } from '@/lib/report-summary'

// Rapports : archive, rapport complet (selon le périmètre du lecteur), réglages des envois et des alertes.

export async function listReports() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  const rows = await prisma.report.findMany({ where: { organizationId: ctx.orgId }, orderBy: { createdAt: 'desc' }, take: 60 })
  return rows.map(r => {
    const kind = r.kind as ReportKind
    const s = summarize(r.data as unknown as ReportData, ctx.siteIds)
    return {
      id: r.id, kind, label: REPORT_KINDS[kind]?.label ?? 'Rapport', period: kind === 'SAMPLE' ? `généré le ${r.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })}` : periodLabel(kind, r.periodStart, r.periodEnd),
      headline: headline(s), bad: s.lines.filter(l => l.tone === 'bad').length, createdAt: r.createdAt
    }
  })
}

export async function getReport(id: string) {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  const [r, org] = await Promise.all([
    prisma.report.findFirst({ where: { id, organizationId: ctx.orgId } }),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true, logo: true } })
  ])
  if (!r) return null
  const kind = r.kind as ReportKind
  return {
    id: r.id, kind, label: REPORT_KINDS[kind]?.label ?? 'Rapport',
    period: kind === 'SAMPLE' ? REPORT_KINDS.SAMPLE.period : periodLabel(kind, r.periodStart, r.periodEnd),
    createdAt: r.createdAt, orgName: org?.name ?? '', logo: org?.logo ?? null,
    scoped: !!ctx.siteIds,
    summary: summarize(r.data as unknown as ReportData, ctx.siteIds)
  }
}

/** « M'envoyer un exemple maintenant » : rapport des 7 derniers jours, pour soi seul. */
export async function sendSampleReport() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const id = await issueReport(ctx.orgId, 'SAMPLE', new Date(), ctx.userId)
  return id ? { success: true as const, id } : { success: false as const, error: 'Rapport impossible à générer' }
}

export async function getReportSettings() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  return { ...(await reportSettings(ctx.orgId)), canEdit: ctx.can('settings.manage') }
}

export async function saveReportSettings(input: { daily: boolean; weekly: boolean; monthly: boolean; extraEmails: string[]; alerts: AlertSettings }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const emails = Array.from(new Set((input.extraEmails ?? []).map(e => e.trim().toLowerCase()).filter(Boolean)))
  const bad = emails.find(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  if (bad) return { success: false as const, error: `Adresse invalide : ${bad}` }
  if (emails.length > 10) return { success: false as const, error: '10 adresses au maximum' }
  const n = (v: unknown, min: number, max: number, def: number) => Math.min(max, Math.max(min, Math.round(Number(v)) || def))
  const a = input.alerts ?? ALERT_DEFAULTS
  const alerts: AlertSettings = {
    waitHigh: { on: !!a.waitHigh?.on, min: n(a.waitHigh?.min, 5, 240, 45) },
    queueLong: { on: !!a.queueLong?.on, max: n(a.queueLong?.max, 3, 500, 30) },
    noCall: { on: !!a.noCall?.on, min: n(a.noCall?.min, 5, 120, 20) },
    complaintBurst: { on: !!a.complaintBurst?.on, count: n(a.complaintBurst?.count, 2, 20, 3) }
  }
  const data = { daily: !!input.daily, weekly: !!input.weekly, monthly: !!input.monthly, extraEmails: emails, alerts }
  await prisma.reportSettings.upsert({ where: { organizationId: ctx.orgId }, update: data, create: { organizationId: ctx.orgId, ...data } })
  await audit({ action: 'REPORT_SETTINGS_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId, details: `${[data.daily && 'jour', data.weekly && 'semaine', data.monthly && 'mois'].filter(Boolean).join(', ') || 'aucun rapport'} · ${emails.length} adresse(s)` })
  return { success: true as const }
}
