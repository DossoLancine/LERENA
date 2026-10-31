'use server'

import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { distanceKm } from "@/lib/geo"
import { PRIORITY_SCORES, type Priority } from "@/lib/constants"
import { revalidatePath } from "next/cache"

export async function joinQueue(serviceId: string, orgId: string, priority: string = 'STANDARD', userLat?: number, userLng?: number) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) throw new Error("UNAUTHORIZED")

    // Session obsolète (compte supprimé après une réinitialisation de la base)
    const validUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true } })
    if (!validUser) throw new Error("SESSION_EXPIRED")

    // GEOFENCING LOGIC
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw new Error("Établissement introuvable")
    if (!org.isActive) throw new Error("Cet établissement est fermé pour le moment")
    if (org.requireGps) {
      if (!userLat || !userLng) {
        throw new Error("GPS_REQUIRED")
      }
      if (org.lat && org.lng) {
        const distance = distanceKm(userLat, userLng, org.lat, org.lng)
        if (distance > org.maxRadiusKm) {
          throw new Error("OUT_OF_BOUNDS")
        }
      }
    }

    // Le service doit appartenir à l'établissement demandé
    const service = await prisma.service.findFirst({
      where: { id: serviceId, isActive: true, branch: { organizationId: orgId } },
      include: { branch: { include: { queues: true } } }
    })

    if (!service || service.branch.queues.length === 0) {
      throw new Error("Service ou file d'attente introuvable")
    }

    // Match queue to service by name or prefix if possible, fallback to first queue
    const queue = service.branch.queues.find(q => 
      service.name.toLowerCase().includes(q.name.toLowerCase()) || 
      q.name.toLowerCase().includes(service.name.toLowerCase()) ||
      q.prefix.toUpperCase() === service.name.trim()[0]?.toUpperCase()
    ) || service.branch.queues[0]

    // Numéro attribué de façon atomique : deux clients simultanés ne reçoivent jamais le même
    const lastTicket = await prisma.ticket.findFirst({
      where: { queueId: queue.id },
      orderBy: { number: 'desc' },
      select: { number: true }
    })
    if (lastTicket && queue.currentNum < lastTicket.number) {
      await prisma.queue.update({ where: { id: queue.id }, data: { currentNum: lastTicket.number } })
    }

    const priorityScore = PRIORITY_SCORES[priority as Priority] ?? PRIORITY_SCORES.STANDARD

    const ticket = await prisma.$transaction(async (tx) => {
      const { currentNum: newNumber } = await tx.queue.update({
        where: { id: queue.id },
        data: { currentNum: { increment: 1 } },
        select: { currentNum: true }
      })
      const waiting = await tx.ticket.count({ where: { queueId: queue.id, status: 'WAITING' } })

      return tx.ticket.create({
        data: {
          queueId: queue.id,
          serviceId: service.id,
          userId: sessionUser.id,
          guestName: sessionUser.name || 'Client',
          number: newNumber,
          displayNum: `${queue.prefix}${newNumber.toString().padStart(3, '0')}`,
          priorityScore,
          status: 'WAITING',
          position: waiting + 1
        }
      })
    })

    revalidatePath(`/org/${orgId}`)
    revalidatePath(`/tv/${orgId}`)
    revalidatePath('/dashboard')
    revalidatePath('/agent')
    
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
