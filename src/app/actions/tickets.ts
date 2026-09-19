'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function joinQueue(serviceId: string, orgId: string, priorityLevel: string = 'STANDARD') {
  try {
    const session = await getServerSession(authOptions)
    
    // Find the queue associated with the service (via branch)
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { branch: { include: { queues: true } } }
    })

    if (!service || service.branch.queues.length === 0) {
      throw new Error("Service ou file d'attente introuvable")
    }

    const queue = service.branch.queues[0] // Assume first queue for MVP

    // Get last ticket number in queue
    const lastTicket = await prisma.ticket.findFirst({
      where: { queueId: queue.id },
      orderBy: { number: 'desc' }
    })

    const newNumber = (lastTicket?.number || 0) + 1
    const displayNum = `${queue.prefix}-${newNumber.toString().padStart(3, '0')}`

    // Calculate position
    const currentWaiters = await prisma.ticket.count({
      where: { queueId: queue.id, status: 'WAITING' }
    })

    const position = currentWaiters + 1

    // Calculate priorityScore
    let priorityScore = 1;
    if (priorityLevel === 'VIP') priorityScore = 3;
    else if (priorityLevel === 'PRIORITY') priorityScore = 2;

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        queueId: queue.id,
        serviceId: service.id,
        userId: (session?.user as any)?.id || null, // Guest if no user
        guestName: session?.user ? null : 'Guest',
        number: newNumber,
        displayNum,
        priorityScore,
        status: 'WAITING',
        position: position
      }
    })

    // Update current queue currentNum
    await prisma.queue.update({
      where: { id: queue.id },
      data: { currentNum: { increment: 1 } }
    })

    revalidatePath(`/org/${orgId}`)
    
    return { success: true, ticketId: ticket.id }
  } catch (error: any) {
    console.error("Join Queue error:", error)
    return { success: false, error: error.message }
  }
}

export async function getUserTickets() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return []
    
    const tickets = await prisma.ticket.findMany({
      where: { userId: (session.user as any).id },
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
    return ticket
  } catch (error) {
    console.error("Get ticket error:", error)
    return null
  }
}
