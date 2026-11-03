import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appUrl, sendSmsWithStatus } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { SEGMENTS, segmentWhere, type CustomerSegment } from '@/lib/customer-segments'
import { firstNameOf, renderMessage, stopFooter } from '@/lib/campaign-text'

// Campagnes SMS (CRM, forfaits avec « Messages et campagnes ») : uniquement aux visiteurs qui ont donné leur accord
// et ne l'ont pas retiré, avec lien de désinscription. Envoi par lots, entre 8 h et 20 h (heure d'Abidjan = UTC).

export interface CampaignTarget {
  segment?: CustomerSegment
  tagId?: string | null
  customerIds?: string[]
}

export const SEND_HOURS = [8, 20] as const
export const MAX_RECIPIENTS = 5000
const STUCK_MS = 10 * 60_000

export const inSendingHours = (d = new Date()) => d.getUTCHours() >= SEND_HOURS[0] && d.getUTCHours() < SEND_HOURS[1]

/** Visiteurs joignables par campagne : accord donné, pas de « STOP », numéro connu. */
export function audienceWhere(orgId: string, target: CampaignTarget): Prisma.CustomerWhereInput {
  const segment = target.segment && SEGMENTS.includes(target.segment) ? target.segment : 'all'
  return {
    organizationId: orgId,
    consentAt: { not: null },
    optedOutAt: null,
    phone: { not: null },
    ...segmentWhere(segment),
    ...(target.tagId ? { tags: { some: { tagId: target.tagId } } } : {}),
    ...(target.customerIds?.length ? { id: { in: target.customerIds.slice(0, MAX_RECIPIENTS) } } : {})
  }
}

/** Lien court de désinscription propre à chaque fiche. */
export async function ensureUnsubToken(customerId: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { unsubToken: true } })
  if (c?.unsubToken) return c.unsubToken
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(8).toString('base64url').slice(0, 10)
    const ok = await prisma.customer.updateMany({ where: { id: customerId, unsubToken: null }, data: { unsubToken: token } }).catch(() => ({ count: 0 }))
    if (ok.count) return token
    const again = await prisma.customer.findUnique({ where: { id: customerId }, select: { unsubToken: true } })
    if (again?.unsubToken) return again.unsubToken
  }
  throw new Error('Lien de désinscription impossible à créer')
}

const nextDateLabel = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** Valeurs des variables pour un visiteur : prénom, dernier service, prochain rendez-vous. */
export async function messageValuesFor(customerId: string, orgId: string, orgName: string) {
  const [c, lastTicket, nextAppt] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { name: true } }),
    prisma.ticket.findFirst({ where: { customerId, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' }, select: { service: { select: { name: true } } } }),
    prisma.appointment.findFirst({ where: { customerId, status: 'CONFIRMED', scheduledDate: { gt: new Date() } }, orderBy: { scheduledDate: 'asc' }, select: { scheduledDate: true } })
  ])
  return {
    firstName: firstNameOf(c?.name ?? null),
    orgName,
    link: `${appUrl().replace(/^https?:\/\//, '')}/org/${orgId}`,
    service: lastTicket?.service.name ?? null,
    nextDate: nextAppt ? nextDateLabel(nextAppt.scheduledDate) : null
  }
}

/** Recompte les destinataires par statut ; termine la campagne quand plus rien n'est en attente. */
async function syncCounters(campaignId: string) {
  const groups = await prisma.campaignRecipient.groupBy({ by: ['status'], where: { campaignId }, _count: { _all: true } })
  const n = (s: string) => groups.find(g => g.status === s)?._count._all ?? 0
  const open = n('PENDING') + n('SENDING')
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sent: n('SENT'), failed: n('FAILED'), skipped: n('SKIPPED'), ...(open === 0 ? { status: 'SENT', finishedAt: new Date() } : {}) }
  })
}

/** Envoie un lot d'une campagne due. Appelé par les tâches automatiques et par la page de suivi tant qu'elle est ouverte. */
export async function processCampaign(campaignId: string, budget = 40, now = new Date()) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, status: true, scheduledAt: true, body: true, organizationId: true, updatedAt: true, organization: { select: { name: true } } }
  })
  if (!campaign || !['SCHEDULED', 'SENDING'].includes(campaign.status) || campaign.scheduledAt > now || !inSendingHours(now)) return 0
  if (campaign.status === 'SCHEDULED') {
    const started = await prisma.campaign.updateMany({ where: { id: campaign.id, status: 'SCHEDULED' }, data: { status: 'SENDING', startedAt: now } })
    if (started.count === 0) return 0
  }

  const batch = await prisma.campaignRecipient.findMany({ where: { campaignId, status: 'PENDING' }, take: budget, select: { id: true, customerId: true } })
  let processed = 0
  let outOfSms = false
  for (const r of batch) {
    const claimed = await prisma.campaignRecipient.updateMany({ where: { id: r.id, status: 'PENDING' }, data: { status: 'SENDING' } })
    if (claimed.count === 0) continue
    processed++
    const customer = r.customerId ? await prisma.customer.findUnique({ where: { id: r.customerId }, select: { phone: true, consentAt: true, optedOutAt: true } }) : null
    const phone = normalizePhone(customer?.phone)
    // L'accord a pu être retiré entre la programmation et l'envoi
    if (!customer || !phone || !customer.consentAt || customer.optedOutAt) {
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'SKIPPED', error: 'Accord retiré ou numéro absent' } })
      continue
    }
    const values = await messageValuesFor(r.customerId!, campaign.organizationId, campaign.organization.name)
    const text = renderMessage(campaign.body, values) + stopFooter(appUrl(), await ensureUnsubToken(r.customerId!))
    const status = await sendSmsWithStatus({ to: phone, text, purpose: 'CAMPAIGN', organizationId: campaign.organizationId })
    if (status === 'SKIPPED') {
      outOfSms = true
      await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: 'SKIPPED', error: 'Plus de SMS disponibles' } })
      break
    }
    await prisma.campaignRecipient.update({ where: { id: r.id }, data: status === 'FAILED' ? { status: 'FAILED', error: 'Refusé par l’opérateur' } : { status: 'SENT', sentAt: new Date() } })
  }

  // Plus de SMS : le reste de la campagne n'est pas envoyé (rachat d'un pack puis nouvelle campagne)
  if (outOfSms) await prisma.campaignRecipient.updateMany({ where: { campaignId, status: 'PENDING' }, data: { status: 'SKIPPED', error: 'Plus de SMS disponibles' } })
  // Envois interrompus (coupure pendant un lot) : comptés en échec après 10 minutes
  if (batch.length === 0 && now.getTime() - campaign.updatedAt.getTime() > STUCK_MS) {
    await prisma.campaignRecipient.updateMany({ where: { campaignId, status: 'SENDING' }, data: { status: 'FAILED', error: 'Envoi interrompu' } })
  }
  await syncCounters(campaignId)
  return processed
}

/** Campagnes dues de tous les établissements (tâches automatiques, toutes les 5 minutes au plus). */
export async function runCampaignJobs(now = new Date()) {
  if (!inSendingHours(now)) return { campaignSms: 0 }
  const due = await prisma.campaign.findMany({ where: { status: { in: ['SCHEDULED', 'SENDING'] }, scheduledAt: { lte: now } }, orderBy: { scheduledAt: 'asc' }, take: 10, select: { id: true } })
  let total = 0
  for (const c of due) {
    if (total >= 150) break
    total += await processCampaign(c.id, 150 - total, now)
  }
  return { campaignSms: total }
}

/** Désinscription (lien STOP ou réponse « STOP ») : plus aucun message d'information de l'établissement. */
export async function optOutCustomers(where: Prisma.CustomerWhereInput) {
  const customers = await prisma.customer.findMany({ where: { ...where, optedOutAt: null }, select: { id: true } })
  if (customers.length === 0) return 0
  const ids = customers.map(c => c.id)
  await prisma.customer.updateMany({ where: { id: { in: ids } }, data: { optedOutAt: new Date(), consentAt: null, consentChannel: null } })
  // Attribuée à la dernière campagne reçue par chaque visiteur
  for (const id of ids) {
    const last = await prisma.campaignRecipient.findFirst({ where: { customerId: id, status: 'SENT' }, orderBy: { sentAt: 'desc' }, select: { campaignId: true } })
    if (last) await prisma.campaign.update({ where: { id: last.campaignId }, data: { unsubscribed: { increment: 1 } } })
  }
  return ids.length
}
