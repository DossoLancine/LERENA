'use server'

import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { issueTicket } from "@/lib/ticketing"
import { notifyOrg } from "@/lib/realtime"
import { revalidatePath } from "next/cache"

export async function joinQueue(serviceId: string, orgId: string, priority: string = 'STANDARD', userLat?: number, userLng?: number) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) throw new Error("UNAUTHORIZED")

    // Session obsolète (compte supprimé après une réinitialisation de la base)
    const validUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, phone: true } })
    if (!validUser) throw new Error("SESSION_EXPIRED")

    const ticket = await issueTicket({
      orgId, serviceId, priority, lat: userLat, lng: userLng,
      owner: { userId: sessionUser.id, name: sessionUser.name || 'Client', phone: validUser.phone }
    })
    return { success: true, ticketId: ticket.id }
  } catch (error: any) {
    console.error("Join Queue error:", error)
    return { success: false, error: error.message }
  }
}

export async function getUserTickets() {
  try {
    const user = await getSessionUser()
    if (!user) return []

    const tickets = await prisma.ticket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        queue: { include: { branch: { include: { organization: true } } } },
        service: true
      }
    })
    return tickets
  } catch (error) {
    console.error("Get user tickets error:", error)
    return []
  }
}

export async function getTicketById(id: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        queue: {
          include: { branch: { include: { organization: true } } }
        },
        service: true
      }
    })

    if (!ticket) return null;

    // Calculer la position réelle dynamiquement (nombre de tickets WAITING créés avant celui-ci dans la même file)
    let realPosition = ticket.position;
    if (ticket.status === 'WAITING') {
      const earlierWaitingTickets = await prisma.ticket.count({
        where: {
          queueId: ticket.queueId,
          status: 'WAITING',
          createdAt: {
            lt: ticket.createdAt
          }
        }
      });
      realPosition = earlierWaitingTickets + 1;
    } else {
      realPosition = 0; // S'il n'est plus en attente (CALLED, SERVING, etc.), il n'y a plus d'attente
    }

    return {
      ...ticket,
      initialPosition: ticket.position, // Position at creation
      position: realPosition,           // Current dynamic position
      orgName: ticket.queue?.branch?.organization?.name || 'Établissement Inconnu',
      serviceName: ticket.service?.name || 'Service Inconnu',
    }
  } catch (error) {
    console.error("Get ticket error:", error)
    return null
  }
}

// Le client quitte la file : son ticket est annulé et libère sa place
export async function leaveQueue(ticketId: string) {
  try {
    const user = await getSessionUser()
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true, queue: { select: { branch: { select: { organizationId: true } } } } }
    })
    if (!ticket || (ticket.userId && ticket.userId !== user?.id)) {
      return { success: false, error: "Ticket introuvable" }
    }
    if (ticket.status !== 'WAITING' && ticket.status !== 'CALLED') {
      return { success: false, error: "Ce ticket n'est plus dans la file" }
    }

    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CANCELLED' } })

    const orgId = ticket.queue.branch.organizationId
    await notifyOrg(orgId)
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath('/tickets')
    return { success: true }
  } catch (error: any) {
    console.error("Leave queue error:", error)
    return { success: false, error: error.message }
  }
}
