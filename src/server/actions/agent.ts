'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getStaffContext, getOrgQueueIds } from "@/lib/session"
import { ACTIVE_TICKET_STATUSES, encodeCounter, startOfToday, type TicketStatus } from "@/lib/constants"

export async function getAgentQueue() {
  try {
    const ctx = await getStaffContext()
    if (!ctx) return []

    const queueIds = await getOrgQueueIds(ctx.orgId)
    if (queueIds.length === 0) return []

    return await prisma.ticket.findMany({
      where: {
        queueId: { in: queueIds },
        status: { in: ACTIVE_TICKET_STATUSES }
      },
      orderBy: [{ priorityScore: 'desc' }, { number: 'asc' }],
      include: {
        service: true,
        // Uniquement le nom : jamais d'e-mail, téléphone ou mot de passe vers le navigateur
        user: { select: { name: true } },
        session: true
      }
    })
  } catch (error) {
    console.error("Get agent queue error:", error)
    return []
  }
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  counterName?: string
) {
  try {
    const ctx = await getStaffContext()
    if (!ctx) return { success: false }

    const currentTicket = await prisma.ticket.findFirst({
      where: { id: ticketId, queue: { branch: { organizationId: ctx.orgId } } }
    })
    if (!currentTicket) return { success: false }

    const now = new Date()
    const updateData: Record<string, unknown> = { status }

    if (status === 'CALLED') {
      updateData.calledAt = now
      // Guichet assigné, affiché sur la TV et chez le client
      if (counterName) updateData.guestPhone = encodeCounter(counterName)
    } else if (status === 'SERVING') {
      updateData.startedAt = currentTicket.startedAt || now
    } else if (status === 'COMPLETED') {
      updateData.completedAt = now

      // Session de service pour l'AHT et les statistiques
      const started = currentTicket.startedAt || currentTicket.calledAt || now
      const durationSec = Math.max(1, Math.round((now.getTime() - started.getTime()) / 1000))
      const waitSec = Math.max(0, Math.round((started.getTime() - currentTicket.createdAt.getTime()) / 1000))

      try {
        await prisma.serviceSession.upsert({
          where: { ticketId: currentTicket.id },
          update: { completedAt: now, durationSeconds: durationSec },
          create: {
            ticketId: currentTicket.id,
            serviceId: currentTicket.serviceId,
            agentId: ctx.userId,
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

    await prisma.ticket.update({ where: { id: ticketId }, data: updateData })

    revalidatePath('/agent')
    revalidatePath('/dashboard')
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath(`/tv/${ctx.orgId}`)

    return { success: true }
  } catch (error) {
    console.error("Update ticket status error:", error)
    return { success: false }
  }
}

export async function getAgentStats() {
  const fallback = { servedToday: 0, avgMin: 15 }
  try {
    const ctx = await getStaffContext()
    if (!ctx) return fallback

    const today = startOfToday()
    const orgScope = { branch: { organizationId: ctx.orgId } }

    const [servedToday, avg] = await Promise.all([
      prisma.ticket.count({
        where: { status: 'COMPLETED', completedAt: { gte: today }, queue: orgScope }
      }),
      prisma.serviceSession.aggregate({
        where: { completedAt: { gte: today }, durationSeconds: { gt: 0 }, service: orgScope },
        _avg: { durationSeconds: true }
      })
    ])

    const avgSec = avg._avg.durationSeconds
    return {
      servedToday,
      avgMin: avgSec ? Math.max(1, Math.round(avgSec / 60)) : 12
    }
  } catch (error) {
    console.error("Get agent stats error:", error)
    return fallback
  }
}
