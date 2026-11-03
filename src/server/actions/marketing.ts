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

// ---- Promotions (public : pour la page ticket) ----
export async function getPromotionsByOrg(orgId: string) {
  try {
    return await prisma.promotion.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: 'desc' }
    })
  } catch {
    return []
  }
}

// ---- Réservation d'une offre par le client depuis son ticket ----
export async function claimTicketPromotion(ticketId: string, promoId: string) {
  try {
    const ticket = await getOwnTicket(ticketId)
    if (!ticket) return { success: false, error: "Ticket introuvable" }

    const promo = await prisma.promotion.findFirst({
      where: { id: promoId, organizationId: ticket.orgId, isActive: true }
    })
    if (!promo) {
      return { success: false, error: "Cette offre n'est plus disponible" }
    }

    const [updatedTicket] = await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          claimedPromoTitle: promo.title,
          claimedPromoPrice: promo.price || 'Offre Spéciale'
        }
      }),
      // Compteur de réservations pour le ROI manager
      prisma.promotion.update({
        where: { id: promo.id },
        data: { claimsCount: { increment: 1 } }
      })
    ])

    await notifyOrg(ticket.orgId)
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath('/agent')
    revalidatePath('/dashboard')

    return {
      success: true,
      claimedPromoTitle: updatedTicket.claimedPromoTitle,
      claimedPromoPrice: updatedTicket.claimedPromoPrice
    }
  } catch (error: any) {
    console.error("Claim promotion error:", error)
    return { success: false, error: error.message || "Erreur lors de l'activation de l'offre" }
  }
}

// Annuler la réservation
export async function cancelTicketPromotion(ticketId: string) {
  try {
    const ticket = await getOwnTicket(ticketId)
    if (!ticket) return { success: false, error: "Ticket introuvable" }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        claimedPromoTitle: null,
        claimedPromoPrice: null
      }
    })
    await notifyOrg(ticket.orgId)
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath('/agent')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ---- Gestion des promotions (manager, multi-tenant) ----
export async function getManagerPromotions() {
  const ctx = await getManagerContext()
  if (!ctx) return []

  return prisma.promotion.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createPromotion(data: {
  title: string
  description?: string
  imageUrl?: string
  price?: string
}) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: "Non autorisé" }
  if (!data.title?.trim()) return { success: false, error: "Le titre est requis" }
  const limit = await checkLimit(() => assertFeature(ctx.orgId, 'TV_ADS'))
  if (limit) return { success: false, error: limit }

  await prisma.promotion.create({
    data: {
      title: data.title.trim(),
      description: data.description || null,
      imageUrl: data.imageUrl || null,
      price: data.price || null,
      organizationId: ctx.orgId
    }
  })

  await notifyOrg(ctx.orgId)
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePromotion(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: "Non autorisé" }

  await prisma.promotion.deleteMany({
    where: { id, organizationId: ctx.orgId }
  })

  await notifyOrg(ctx.orgId)
  revalidatePath('/dashboard')
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
