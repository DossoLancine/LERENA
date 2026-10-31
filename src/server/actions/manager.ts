'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getManagerContext, getOrgQueueIds } from "@/lib/session"
import { decodeCounter, startOfToday } from "@/lib/constants"

export async function getManagerStats() {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return null

    const today = startOfToday()
    const ticketScope = { queue: { branch: { organizationId: ctx.orgId } }, createdAt: { gte: today } }

    const [org, byStatus] = await Promise.all([
      prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { id: true, isActive: true } }),
      prisma.ticket.groupBy({ by: ['status'], where: ticketScope, _count: { _all: true } })
    ])
    if (!org) return null

    const count = (status: string) => byStatus.find(s => s.status === status)?._count._all ?? 0

    return {
      todayTickets: byStatus.reduce((acc, s) => acc + s._count._all, 0),
      currentWaiting: count('WAITING'),
      completedTickets: count('COMPLETED'),
      isOpen: org.isActive,
      orgId: org.id
    }
  } catch (error) {
    console.error("Manager stats error:", error)
    return null
  }
}

// orgId est conservé pour compatibilité ; seule l'organisation du manager connecté est modifiée
export async function toggleOrganizationStatus(_orgId: string, isOpen: boolean) {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return { success: false }

    await prisma.organization.update({
      where: { id: ctx.orgId },
      data: { isActive: isOpen }
    })

    revalidatePath('/dashboard')
    revalidatePath('/')
    revalidatePath('/explore')

    return { success: true }
  } catch (error) {
    console.error("Toggle org status error:", error)
    return { success: false }
  }
}

export async function getLiveQueue() {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return []

    const queueIds = await getOrgQueueIds(ctx.orgId)

    const tickets = await prisma.ticket.findMany({
      where: { queueId: { in: queueIds } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 50,
      include: {
        service: { select: { name: true } },
        user: { select: { name: true } },
        session: { select: { agent: { select: { name: true } } } }
      }
    })

    return tickets.map(t => ({
      id: t.id,
      num: t.displayNum,
      name: t.guestName || t.user?.name || 'Visiteur',
      service: t.service?.name || 'Général',
      status: t.status,
      wait: Math.max(0, Math.round((Date.now() - t.createdAt.getTime()) / 60000)),
      agentName: t.session?.agent?.name || null,
      counter: decodeCounter(t.guestPhone),
      claimedPromoTitle: t.claimedPromoTitle || null,
      claimedPromoPrice: t.claimedPromoPrice || null,
      createdAt: t.createdAt.toISOString()
    }))
  } catch (error) {
    console.error("Get live queue error:", error)
    return []
  }
}

export async function getOrganizationServices() {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return []

    const services = await prisma.service.findMany({
      where: { branch: { organizationId: ctx.orgId } },
      orderBy: { createdAt: 'asc' }
    })
    const serviceIds = services.map(s => s.id)

    const [waiting, completedToday, durations] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['serviceId'],
        where: { serviceId: { in: serviceIds }, status: 'WAITING' },
        _count: { _all: true }
      }),
      prisma.ticket.groupBy({
        by: ['serviceId'],
        where: { serviceId: { in: serviceIds }, status: 'COMPLETED', completedAt: { gte: startOfToday() } },
        _count: { _all: true }
      }),
      prisma.serviceSession.groupBy({
        by: ['serviceId'],
        where: { serviceId: { in: serviceIds }, durationSeconds: { gt: 0 } },
        _avg: { durationSeconds: true }
      })
    ])

    return services.map(s => {
      const avgSec = durations.find(d => d.serviceId === s.id)?._avg.durationSeconds
      return {
        id: s.id,
        name: s.name,
        description: s.description || null,
        isActive: s.isActive !== false,
        count: waiting.find(w => w.serviceId === s.id)?._count._all ?? 0,
        completedToday: completedToday.find(c => c.serviceId === s.id)?._count._all ?? 0,
        avgMin: avgSec ? Math.round(avgSec / 60) || s.avgDurationMin : s.avgDurationMin,
        agents: 1
      }
    })
  } catch (error) {
    console.error("Get organization services error:", error)
    return []
  }
}
