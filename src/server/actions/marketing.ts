'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getManagerContext, getSessionUser } from "@/lib/session"
import { branchFilter } from '@/lib/sites'
import { notifyOrg } from "@/lib/realtime"
import { assertFeature, checkLimit } from '@/lib/billing'
import { recordRating } from '@/lib/complaints'

// Ticket du client connecté (les tickets sans compte restent modifiables via leur lien)
async function getOwnTicket(ticketId: string) {
  const [user, ticket] = await Promise.all([
    getSessionUser(),
    prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true, queue: { select: { branch: { select: { organizationId: true } } } } }
    })
  ])
  if (!ticket) return null
  if (ticket.userId && ticket.userId !== user?.id) return null
  return { id: ticket.id, status: ticket.status, orgId: ticket.queue.branch.organizationId }
}

// ---- NPS ----
export async function submitNPS(ticketId: string, score: number, extra?: { comment?: string | null; reason?: string | null }) {
  try {
    if (!Number.isInteger(score) || score < 1 || score > 5) return { success: false }
    const ticket = await getOwnTicket(ticketId)
    if (!ticket || ticket.status !== 'COMPLETED') return { success: false }

    // Note, commentaire et motif ; un avis négatif part dans « Avis à traiter » de l'établissement
    await recordRating(ticket.id, score, extra ?? {})
    revalidatePath(`/ticket/${ticketId}`)
    return { success: true }
  } catch (error) {
    console.error("NPS submit error:", error)
    return { success: false }
  }
}

// ---- Accord pour les messages d'information de l'établissement (depuis le ticket) ----

/** État de l'accord du visiteur de ce ticket (null si le ticket n'a pas de numéro rattaché). */
export async function getTicketConsent(ticketId: string) {
  const ticket = await getOwnTicket(ticketId)
  if (!ticket) return null
  const t = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { customer: { select: { phone: true, consentAt: true, organization: { select: { name: true } } } } } })
  if (!t?.customer?.phone) return null
  return { orgName: t.customer.organization.name, consent: !!t.customer.consentAt }
}

export async function setTicketConsent(ticketId: string, consent: boolean) {
  const ticket = await getOwnTicket(ticketId)
  if (!ticket) return { success: false }
  const t = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { customerId: true } })
  if (!t?.customerId) return { success: false }
  await prisma.customer.update({
    where: { id: t.customerId },
    data: consent ? { consentAt: new Date(), consentChannel: 'APP', optedOutAt: null } : { consentAt: null, consentChannel: null }
  })
  return { success: true }
}

export async function getAvgNPS() {
  const ctx = await getManagerContext()
  if (!ctx) return null

  const stats = await prisma.ticket.aggregate({
    where: { npsScore: { not: null }, queue: { branch: await branchFilter(ctx.orgId) } },
    _avg: { npsScore: true }
  })
  const avg = stats._avg.npsScore
  return avg ? Math.round(avg * 10) / 10 : null
}
