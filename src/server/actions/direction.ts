'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { agentRanking, beforeAfter, moneyView, sectorDefaults, sitesOverview } from '@/lib/direction'

// Vue direction (droit « statistiques »), réglages des objectifs et des valeurs (droit « réglages »).

export async function getDirection(days = 30) {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  const period = [7, 30, 90].includes(days) ? days : 30
  const [sites, ranking, money, org] = await Promise.all([
    sitesOverview(ctx.orgId, ctx.siteIds),
    agentRanking(ctx.orgId, ctx.siteIds, period),
    moneyView(ctx.orgId, ctx.siteIds),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })
  ])
  return { orgName: org?.name ?? '', scoped: !!ctx.siteIds, canEdit: ctx.can('settings.manage'), canCampaign: ctx.can('campaigns.manage'), sites, ranking, money }
}

export async function getBeforeAfter() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  return beforeAfter(ctx.orgId, ctx.siteIds)
}

/** Réglages : objectifs par site, valeur des visites, attente relevée avant Lerena. */
export async function getDirectionSettings() {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return null
  const [org, sites, services] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { category: true, defaultVisitValue: true, pilotBaselineWaitMin: true, pilotBaselineDaily: true, pilotStartedAt: true } }),
    prisma.branch.findMany({ where: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, targetWaitMin: true, targetSatisfaction: true } }),
    prisma.service.findMany({ where: { isActive: true, branch: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) } }, orderBy: { name: 'asc' }, select: { id: true, name: true, visitValue: true, branch: { select: { name: true } } } })
  ])
  return {
    defaults: sectorDefaults(org?.category), defaultVisitValue: org?.defaultVisitValue ?? null,
    baseline: { waitMin: org?.pilotBaselineWaitMin ?? null, daily: org?.pilotBaselineDaily ?? null, startedAt: org?.pilotStartedAt ?? null },
    // Le relevé de départ concerne tout l'établissement : réservé à la direction (sans limite de sites)
    canEditBaseline: !ctx.siteIds,
    sites, services: services.map(s => ({ id: s.id, name: s.name, site: s.branch.name, visitValue: s.visitValue }))
  }
}

const int = (v: unknown, min: number, max: number) => { const n = Math.round(Number(v)); return v === '' || v == null || Number.isNaN(n) ? null : Math.min(max, Math.max(min, n)) }

export async function saveDirectionSettings(input: {
  defaultVisitValue: number | null
  sites: { id: string; targetWaitMin: number | null; targetSatisfaction: number | null }[]
  services: { id: string; visitValue: number | null }[]
  baseline?: { waitMin: number | null; daily: number | null }
}) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const siteIds = (await prisma.branch.findMany({ where: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) }, select: { id: true } })).map(b => b.id)
  const serviceIds = (await prisma.service.findMany({ where: { branchId: { in: siteIds } }, select: { id: true } })).map(s => s.id)
  await prisma.$transaction([
    ...(ctx.siteIds ? [] : [prisma.organization.update({ where: { id: ctx.orgId }, data: { defaultVisitValue: int(input.defaultVisitValue, 0, 10_000_000) } })]),
    ...input.sites.filter(s => siteIds.includes(s.id)).map(s => prisma.branch.update({
      where: { id: s.id },
      data: { targetWaitMin: int(s.targetWaitMin, 1, 600), targetSatisfaction: s.targetSatisfaction == null || String(s.targetSatisfaction) === '' ? null : Math.min(5, Math.max(1, Math.round(Number(s.targetSatisfaction) * 10) / 10)) }
    })),
    ...input.services.filter(s => serviceIds.includes(s.id)).map(s => prisma.service.update({ where: { id: s.id }, data: { visitValue: int(s.visitValue, 0, 10_000_000) } }))
  ])
  // Relevé de départ (avant Lerena) : direction seulement ; la date de départ est fixée au premier enregistrement
  if (input.baseline && !ctx.siteIds) {
    const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { pilotStartedAt: true, createdAt: true } })
    await prisma.organization.update({ where: { id: ctx.orgId }, data: { pilotBaselineWaitMin: int(input.baseline.waitMin, 0, 1000), pilotBaselineDaily: int(input.baseline.daily, 0, 100000), pilotStartedAt: org?.pilotStartedAt ?? org?.createdAt ?? new Date() } })
  }
  await audit({ action: 'DIRECTION_SETTINGS_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId })
  return { success: true as const }
}
