'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getAgentQueue() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || ((session.user as any).role !== 'AGENT' && (session.user as any).role !== 'MANAGER')) {
      throw new Error("Unauthorized")
    }

    const userId = (session.user as any).id

    // Trouver l'organisation de l'agent
    const membership = await prisma.organizationMember.findFirst({
      where: { userId },
      include: {
        organization: {
          include: {
            branches: {
              include: { queues: true }
            }
          }
        }
      }
    })

    let queueIds: string[] = []
    if (membership?.organization) {
      queueIds = membership.organization.branches.flatMap(b => b.queues.map(q => q.id))
    } else {
      const firstOrg = await prisma.organization.findFirst({
        include: {
          branches: {
            include: { queues: true }
          }
        }
      })
      if (firstOrg) {
        queueIds = firstOrg.branches.flatMap(b => b.queues.map(q => q.id))
      }
    }

    if (queueIds.length === 0) return []

    const tickets = await prisma.ticket.findMany({
      where: { 
        queueId: { in: queueIds },
        status: { in: ['WAITING', 'CALLED', 'SERVING'] }
      },
      orderBy: [
        { priorityScore: 'desc' },
        { number: 'asc' }
      ],
      include: { 
        service: true, 
        user: true,
        session: true 
      }
    })

    return tickets
  } catch (error) {
    console.error("Get agent queue error:", error)
    return []
  }
}

export async function updateTicketStatus(
  ticketId: string, 
  status: 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'ABSENT',
  counterName?: string
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any).role !== 'AGENT' && (session.user as any).role !== 'MANAGER')) {
      throw new Error("Unauthorized")
    }

    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { queue: { include: { branch: true } } }
    })

    if (!currentTicket) throw new Error("Ticket introuvable")

    const now = new Date()
    const updateData: any = { status }

    if (status === 'CALLED') {
      updateData.calledAt = now
      if (counterName) {
        // Enregistre le guichet assigné pour la TV et le client
        updateData.guestPhone = `G-${counterName}`
      }
    } else if (status === 'SERVING') {
      updateData.startedAt = currentTicket.startedAt || now
    } else if (status === 'COMPLETED') {
      updateData.completedAt = now

      // Enregistrement de la session de service pour l'AHT et les analytiques
      const started = currentTicket.startedAt || currentTicket.calledAt || now
      const durationSec = Math.max(1, Math.round((now.getTime() - started.getTime()) / 1000))
      const waitSec = currentTicket.createdAt ? Math.max(0, Math.round((started.getTime() - new Date(currentTicket.createdAt).getTime()) / 1000)) : 0

      const agentId = (session.user as any).id || currentTicket.userId

      try {
        await prisma.serviceSession.upsert({
          where: { ticketId: currentTicket.id },
          update: {
            completedAt: now,
            durationSeconds: durationSec,
          },
          create: {
            ticketId: currentTicket.id,
            serviceId: currentTicket.serviceId,
            agentId: agentId,
            startedAt: started,
            completedAt: now,
            durationSeconds: durationSec,
            waitSeconds: waitSec,
            hour: now.getHours(),
            dayOfWeek: now.getDay()
          }
        })
      } catch (sessionErr) {
        console.error("ServiceSession creation error:", sessionErr)
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData
    })

    revalidatePath('/agent')
    revalidatePath('/dashboard')
    revalidatePath(`/ticket/${ticket.id}`)

    const orgId = currentTicket.queue?.branch?.organizationId
    if (orgId) {
      revalidatePath(`/tv/${orgId}`)
    }

    return { success: true }
  } catch (error) {
    console.error("Update ticket status error:", error)
    return { success: false }
  }
}

export async function getAgentStats() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any).role !== 'AGENT' && (session.user as any).role !== 'MANAGER')) {
      return { servedToday: 0, avgMin: 15 }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const completedToday = await prisma.ticket.count({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: today }
      }
    })

    const sessionsToday = await prisma.serviceSession.findMany({
      where: {
        completedAt: { gte: today },
        durationSeconds: { gt: 0 }
      },
      select: { durationSeconds: true }
    })

    let avgMin = 12
    if (sessionsToday.length > 0) {
      const totalSec = sessionsToday.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0)
      avgMin = Math.max(1, Math.round(totalSec / sessionsToday.length / 60))
    }

    return {
      servedToday: completedToday,
      avgMin
    }
  } catch (error) {
    console.error("Get agent stats error:", error)
    return { servedToday: 0, avgMin: 15 }
  }
}
