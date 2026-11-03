'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getManagerContext, getOrgQueueIds } from "@/lib/session"
import { branchFilter, siteQueueIds, siteScope } from '@/lib/sites'
import { counterLabel, startOfToday } from "@/lib/constants"
import { notifyOrg } from "@/lib/realtime"

export async function getManagerStats() {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return null

    const today = startOfToday()
    const ticketScope = { queue: { branch: await branchFilter(ctx.orgId) }, createdAt: { gte: today } }

    const [org, byStatus] = await Promise.all([
      prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { id: true, name: true, isActive: true } }),
      prisma.ticket.groupBy({ by: ['status'], where: ticketScope, _count: { _all: true } })
    ])
    if (!org) return null

    const count = (status: string) => byStatus.find(s => s.status === status)?._count._all ?? 0

    return {
      todayTickets: byStatus.reduce((acc, s) => acc + s._count._all, 0),
      currentWaiting: count('WAITING'),
      completedTickets: count('COMPLETED'),
      isOpen: org.isActive,
      orgId: org.id,
      orgName: org.name
    }
  } catch (error) {
    console.error("Manager stats error:", error)
    return null
  }
}

// orgId est conservé pour compatibilité ; seule l'organisation du manager connecté est modifiée
export async function toggleOrganizationStatus(_orgId: string, isOpen: boolean) {
  try {
    const ctx = await getManagerContext('queue.manage')
    if (!ctx) return { success: false }

    await prisma.organization.update({
      where: { id: ctx.orgId },
      data: { isActive: isOpen }
    })
    await notifyOrg(ctx.orgId)

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

    const queueIds = await siteQueueIds(ctx.orgId, await siteScope(ctx.orgId))

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
      counter: counterLabel(t.counterName),
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
      where: { branch: await branchFilter(ctx.orgId) },
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

/** Guichets en direct : client au guichet, agent qui l'a appelé, passages du jour. */
export async function getCounterBoard() {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return []

    const today = startOfToday()
    const [counters, active, served] = await Promise.all([
      prisma.counter.findMany({
        where: { branch: await branchFilter(ctx.orgId) },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        select: { id: true, name: true, isActive: true }
      }),
      prisma.ticket.findMany({
        where: { status: { in: ['CALLED', 'SERVING', 'ON_HOLD'] }, queue: { branch: await branchFilter(ctx.orgId) } },
        select: {
          id: true, displayNum: true, status: true, counterName: true, calledAt: true, startedAt: true,
          service: { select: { name: true } },
          events: { where: { type: 'CALLED' }, orderBy: { createdAt: 'desc' }, take: 1, select: { actorId: true } }
        }
      }),
      prisma.ticket.groupBy({
        by: ['counterName'],
        where: { status: 'COMPLETED', completedAt: { gte: today }, queue: { branch: await branchFilter(ctx.orgId) } },
        _count: { _all: true }
      })
    ])

    const actorIds = Array.from(new Set(active.map(t => t.events[0]?.actorId).filter((x): x is string => !!x)))
    const agents = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : []

    return counters.map(c => {
      const ticket = active.find(t => t.counterName === c.name && t.status !== 'ON_HOLD')
      const actorId = ticket?.events[0]?.actorId
      return {
        id: c.id,
        name: c.name,
        isActive: c.isActive,
        servedToday: served.find(s => s.counterName === c.name)?._count._all ?? 0,
        onHold: active.filter(t => t.counterName === c.name && t.status === 'ON_HOLD').length,
        agentName: agents.find(a => a.id === actorId)?.name ?? null,
        ticket: ticket
          ? { num: ticket.displayNum, status: ticket.status, service: ticket.service.name, since: (ticket.startedAt ?? ticket.calledAt)?.toISOString() ?? null }
          : null
      }
    })
  } catch (error) {
    console.error('getCounterBoard error:', error)
    return []
  }
}
