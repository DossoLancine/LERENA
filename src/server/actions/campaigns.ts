'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { hasFeature, smsAllowance } from '@/lib/billing'
import { audit } from '@/lib/audit'
import { appUrl } from '@/lib/messaging'
import { SEGMENTS, type CustomerSegment } from '@/lib/customer-segments'
import { MAX_BODY, normalizeSms } from '@/lib/campaign-text'
import { audienceWhere, inSendingHours, MAX_RECIPIENTS, messageValuesFor, processCampaign, type CampaignTarget } from '@/lib/campaigns'

// Campagnes SMS : réservées au responsable, forfaits avec « Messages et campagnes SMS ».

const upgrade = 'Les campagnes SMS sont incluses à partir du forfait Pro (Abonnement).'

async function campaignContext() {
  const ctx = await getManagerContext('campaigns.manage')
  if (!ctx) return null
  return { ...ctx, enabled: await hasFeature(ctx.orgId, 'CRM_CAMPAIGNS').catch(() => false) }
}

function cleanTarget(t: CampaignTarget): CampaignTarget {
  return {
    segment: t.segment && SEGMENTS.includes(t.segment) ? t.segment : 'all',
    tagId: typeof t.tagId === 'string' && t.tagId ? t.tagId : null,
    customerIds: Array.isArray(t.customerIds) ? t.customerIds.filter(x => typeof x === 'string').slice(0, MAX_RECIPIENTS) : []
  }
}

const balanceOf = async (orgId: string) => {
  const a = await smsAllowance(orgId)
  return { includedLeft: a.includedLeft, credits: a.credits, total: a.includedLeft + a.credits }
}

/** Liste des campagnes, solde de SMS et visiteurs joignables. */
export async function getCampaigns() {
  const ctx = await campaignContext()
  if (!ctx) return null
  if (!ctx.enabled) return { enabled: false as const }
  const [campaigns, reachable, total, balance] = await Promise.all([
    prisma.campaign.findMany({
      where: { organizationId: ctx.orgId }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, name: true, status: true, scheduledAt: true, finishedAt: true, recipients: true, sent: true, failed: true, skipped: true, unsubscribed: true, createdByName: true, createdAt: true }
    }),
    prisma.customer.count({ where: audienceWhere(ctx.orgId, {}, ctx.siteIds) }),
    prisma.customer.count({ where: { organizationId: ctx.orgId } }),
    balanceOf(ctx.orgId)
  ])
  return { enabled: true as const, campaigns, reachable, total, balance }
}

/** Données de l'éditeur : segments et étiquettes avec le nombre de visiteurs joignables, solde, exemple d'aperçu. */
export async function getComposer() {
  const ctx = await campaignContext()
  if (!ctx) return null
  if (!ctx.enabled) return { enabled: false as const }
  const [org, tags, segmentCounts, balance, sample] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
    prisma.customerTag.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    Promise.all(SEGMENTS.map(s => prisma.customer.count({ where: audienceWhere(ctx.orgId, { segment: s }, ctx.siteIds) }))),
    balanceOf(ctx.orgId),
    prisma.customer.findFirst({ where: audienceWhere(ctx.orgId, {}, ctx.siteIds), orderBy: { lastSeenAt: 'desc' }, select: { id: true } })
  ])
  const orgName = org?.name ?? ''
  const values = sample ? await messageValuesFor(sample.id, ctx.orgId, orgName) : null
  return {
    enabled: true as const,
    orgName,
    link: `${appUrl().replace(/^https?:\/\//, '')}/org/${ctx.orgId}`,
    appBase: appUrl(),
    tags,
    segmentCounts: Object.fromEntries(SEGMENTS.map((s, i) => [s, segmentCounts[i]])) as Record<CustomerSegment, number>,
    balance,
    sample: values,
    sendingHours: inSendingHours()
  }
}

/** Nombre de destinataires d'une cible (accord donné, pas de STOP). */
export async function countAudience(target: CampaignTarget) {
  const ctx = await campaignContext()
  if (!ctx?.enabled) return 0
  return prisma.customer.count({ where: audienceWhere(ctx.orgId, cleanTarget(target), ctx.siteIds) })
}

/** Recherche de visiteurs joignables pour une sélection à la main. */
export async function searchReachable(q: string) {
  const ctx = await campaignContext()
  if (!ctx?.enabled) return []
  const term = q.trim().slice(0, 60)
  if (term.length < 2) return []
  const digits = term.replace(/\D/g, '').replace(/^0+/, '')
  return prisma.customer.findMany({
    where: { ...audienceWhere(ctx.orgId, {}, ctx.siteIds), OR: [{ name: { contains: term, mode: 'insensitive' } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] },
    take: 10, orderBy: { lastSeenAt: 'desc' }, select: { id: true, name: true, phone: true }
  })
}

export async function createCampaign(input: { name: string; body: string; target: CampaignTarget; scheduledAt?: string | null }) {
  const ctx = await campaignContext()
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (!ctx.enabled) return { success: false as const, error: upgrade }
  const body = normalizeSms(input.body).trim()
  if (body.length < 10) return { success: false as const, error: 'Le message est trop court' }
  if (body.length > MAX_BODY) return { success: false as const, error: `${MAX_BODY} caractères au maximum` }
  const name = input.name.trim().slice(0, 80) || body.slice(0, 40)
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : new Date()
  if (Number.isNaN(scheduledAt.getTime())) return { success: false as const, error: 'Date d’envoi invalide' }
  if (scheduledAt.getTime() > Date.now() + 90 * 86400_000) return { success: false as const, error: 'Programmez l’envoi dans les 90 jours' }

  const target = cleanTarget(input.target)
  const audience = await prisma.customer.findMany({ where: audienceWhere(ctx.orgId, target, ctx.siteIds), select: { id: true }, take: MAX_RECIPIENTS })
  if (audience.length === 0) return { success: false as const, error: 'Aucun visiteur de cette cible n’a accepté de recevoir vos messages' }
  const balance = await balanceOf(ctx.orgId)
  if (balance.total < audience.length) return { success: false as const, error: `Il vous reste ${balance.total} SMS pour ${audience.length} destinataires : achetez un pack dans Abonnement → Boutique` }

  const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } })
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: ctx.orgId, name, body, target: target as object, scheduledAt, recipients: audience.length,
      createdById: ctx.userId, createdByName: me?.name ?? null,
      sends: { createMany: { data: audience.map(c => ({ customerId: c.id })) } }
    },
    select: { id: true }
  })
  await audit({ action: 'CAMPAIGN_CREATED', targetType: 'Campaign', targetId: campaign.id, organizationId: ctx.orgId, details: `${audience.length} destinataires` })
  // Envoi immédiat : un premier lot part tout de suite, la suite au fil de la page de suivi et des tâches automatiques
  if (scheduledAt.getTime() <= Date.now()) await processCampaign(campaign.id, 40).catch(error => console.error('Campaign send error:', error))
  return { success: true as const, id: campaign.id }
}

/** Suivi d'une campagne ; envoie le lot suivant tant que la page est ouverte. */
export async function getCampaign(id: string) {
  const ctx = await campaignContext()
  if (!ctx?.enabled) return null
  const found = await prisma.campaign.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true } })
  if (!found) return null
  await processCampaign(id, 30).catch(error => console.error('Campaign send error:', error))
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true, name: true, body: true, target: true, status: true, scheduledAt: true, startedAt: true, finishedAt: true,
      recipients: true, sent: true, failed: true, skipped: true, unsubscribed: true, createdByName: true, createdAt: true,
      sends: { orderBy: [{ sentAt: { sort: 'desc', nulls: 'last' } }], take: 200, select: { id: true, status: true, error: true, sentAt: true, customer: { select: { id: true, name: true, phone: true } } } }
    }
  })
  if (!campaign) return null
  const target = campaign.target as CampaignTarget
  const tag = target.tagId ? await prisma.customerTag.findUnique({ where: { id: target.tagId }, select: { name: true } }) : null
  return { ...campaign, targetLabel: { segment: target.segment ?? 'all', tag: tag?.name ?? null, selection: target.customerIds?.length ?? 0 }, sendingHours: inSendingHours() }
}

/** Annule une campagne programmée ou en cours : les SMS pas encore partis ne partent pas. */
export async function cancelCampaign(id: string) {
  const ctx = await campaignContext()
  if (!ctx?.enabled) return { success: false as const, error: 'Non autorisé' }
  const res = await prisma.campaign.updateMany({ where: { id, organizationId: ctx.orgId, status: { in: ['SCHEDULED', 'SENDING'] } }, data: { status: 'CANCELLED', finishedAt: new Date() } })
  if (res.count === 0) return { success: false as const, error: 'Cette campagne est déjà terminée' }
  await prisma.campaignRecipient.updateMany({ where: { campaignId: id, status: 'PENDING' }, data: { status: 'SKIPPED', error: 'Campagne annulée' } })
  const skipped = await prisma.campaignRecipient.count({ where: { campaignId: id, status: 'SKIPPED' } })
  await prisma.campaign.update({ where: { id }, data: { skipped } })
  await audit({ action: 'CAMPAIGN_CANCELLED', targetType: 'Campaign', targetId: id, organizationId: ctx.orgId })
  return { success: true as const }
}
