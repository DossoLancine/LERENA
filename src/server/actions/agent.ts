'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getStaffContext, getOrgQueueIds } from "@/lib/session"
import { ACTIVE_TICKET_STATUSES, encodeCounter, startOfToday, type TicketStatus } from "@/lib/constants"
import { notifyOrg } from "@/lib/realtime"
import { sendPushToTicket } from "@/lib/push"

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

    await notifyOrg(ctx.orgId)
    if (status === 'CALLED') await notifyCalledAndNext(currentTicket, counterName)
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

// Alertes push : le client appelé, puis les deux suivants de la même file
async function notifyCalledAndNext(
  ticket: { id: string; queueId: string; displayNum: string },
  counterName?: string
) {
  const next = await prisma.ticket.findMany({
    where: { queueId: ticket.queueId, status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, displayNum: true }
  })

  await Promise.allSettled([
    sendPushToTicket(ticket.id, {
      title: "C'est votre tour !",
      body: `Ticket ${ticket.displayNum} : présentez-vous au ${counterName || 'guichet'}.`,
      url: `/ticket/${ticket.id}`,
      tag: `ticket-${ticket.id}`,
      urgent: true
    }),
    ...next.map((t, i) => sendPushToTicket(t.id, {
      title: i === 0 ? 'Vous êtes le prochain' : 'Votre tour approche',
      body: i === 0
        ? `Ticket ${t.displayNum} : rapprochez-vous du guichet.`
        : `Ticket ${t.displayNum} : plus qu'une personne devant vous.`,
      url: `/ticket/${t.id}`,
      tag: `ticket-${t.id}`
    }))
  ])
}

export async function getAgentStats() {
  const fallback = { servedToday: 0, avgMin: 15, orgId: null as string | null }
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
      orgId: ctx.orgId,
      servedToday,
      avgMin: avgSec ? Math.max(1, Math.round(avgSec / 60)) : 12
    }
  } catch (error) {
    console.error("Get agent stats error:", error)
    return fallback
  }
}
