'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// Helper multi-tenant pour le manager
async function getManagerOrgId() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'MANAGER') return null

  const userId = (session.user as any).id
  const member = await prisma.organizationMember.findFirst({
    where: { userId },
    select: { organizationId: true }
  })

  if (member?.organizationId) return member.organizationId

  const firstOrg = await prisma.organization.findFirst({ select: { id: true } })
  return firstOrg?.id || null
}

// ---- NPS ----
export async function submitNPS(ticketId: string, score: number) {
  try {
    if (score < 1 || score > 5) return { success: false }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { npsScore: score }
    })
    revalidatePath(`/ticket/${ticketId}`)
    return { success: true }
  } catch (error) {
    console.error("NPS submit error:", error)
    return { success: false }
  }
}

// ---- Promotions (public: pour la page ticket) ----
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

// ---- Réclamation d'une offre par le Client (Le "Juste Milieu" Universel) ----
export async function claimTicketPromotion(ticketId: string, promoId: string) {
  try {
    const promo = await prisma.promotion.findUnique({
      where: { id: promoId }
    })

    if (!promo || !promo.isActive) {
      return { success: false, error: "Cette offre n'est plus disponible" }
    }

    // Associer l'offre au ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        claimedPromoTitle: promo.title,
        claimedPromoPrice: promo.price || 'Offre Spéciale'
      }
    })

    // Incrémenter le compteur de réclamations pour le ROI Manager
    await prisma.promotion.update({
      where: { id: promoId },
      data: {
        claimsCount: { increment: 1 }
      }
    })

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

// Annuler la réclamation
export async function cancelTicketPromotion(ticketId: string) {
  try {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        claimedPromoTitle: null,
        claimedPromoPrice: null
      }
    })
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath('/agent')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// ---- Promotions Management (Manager SaaS Multi-Tenant) ----
export async function getManagerPromotions() {
  const orgId = await getManagerOrgId()
  if (!orgId) return []

  return prisma.promotion.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createPromotion(data: {
  title: string
  description?: string
  imageUrl?: string
  price?: string
}) {
  const orgId = await getManagerOrgId()
  if (!orgId) return { success: false, error: "Non autorisé" }

  await prisma.promotion.create({
    data: { ...data, organizationId: orgId }
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePromotion(id: string) {
  const orgId = await getManagerOrgId()
  if (!orgId) return { success: false, error: "Non autorisé" }

  // Sécurité multi-tenant : vérifier que la promo appartient à l'organisation du manager
  await prisma.promotion.deleteMany({
    where: { id, organizationId: orgId }
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function getAvgNPS() {
  const orgId = await getManagerOrgId()
  if (!orgId) return null

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      branches: {
        include: {
          queues: {
            include: {
              tickets: {
                where: { npsScore: { not: null } }
              }
            }
          }
        }
      }
    }
  })
  if (!org) return null

  const scores = org.branches.flatMap(b => b.queues.flatMap(q => q.tickets.map(t => t.npsScore!)))
  if (scores.length === 0) return null

  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}
