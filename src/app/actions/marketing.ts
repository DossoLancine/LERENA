'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// ---- NPS ----
export async function submitNPS(ticketId: string, score: number) {
  try {
    if (score < 1 || score > 5) return { success: false }
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { npsScore: score }
    })
    return { success: true }
  } catch (error) {
    console.error("NPS submit error:", error)
    return { success: false }
  }
}

// ---- Promotions (public: for ticket page) ----
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

// ---- Promotions Management (Manager only) ----
export async function getManagerPromotions() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'MANAGER') return []

  const org = await prisma.organization.findFirst()
  if (!org) return []

  return prisma.promotion.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'desc' }
  })
}

export async function createPromotion(data: {
  title: string
  description?: string
  imageUrl?: string
  price?: string
}) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'MANAGER') return { success: false }

  const org = await prisma.organization.findFirst()
  if (!org) return { success: false }

  await prisma.promotion.create({
    data: { ...data, organizationId: org.id }
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function deletePromotion(id: string) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'MANAGER') return { success: false }

  await prisma.promotion.delete({ where: { id } })
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getAvgNPS() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'MANAGER') return null

  const org = await prisma.organization.findFirst({
    include: { branches: { include: { queues: { include: { tickets: { where: { npsScore: { not: null } } } } } } } }
  })
  if (!org) return null

  const scores = org.branches.flatMap(b => b.queues.flatMap(q => q.tickets.map(t => t.npsScore!)))
  if (scores.length === 0) return null

  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}
