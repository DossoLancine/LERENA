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

    // Since we don't have a direct link between Agent and Queue in MVP,
    // we fetch tickets for the first queue available in the system for demo, 
    // or we fetch all waiting/called/serving tickets for their org.
    // Assuming the user is assigned to org1. (We could add orgId to User)
    
    // For MVP, just get the first queue's tickets
    const firstQueue = await prisma.queue.findFirst()
    if (!firstQueue) return []

    const tickets = await prisma.ticket.findMany({
      where: { 
        queueId: firstQueue.id,
        status: { in: ['WAITING', 'CALLED', 'SERVING'] }
      },
      orderBy: [
        { priorityScore: 'desc' },
        { number: 'asc' }
      ],
      include: { service: true, user: true }
    })

    return tickets
  } catch (error) {
    console.error("Get agent queue error:", error)
    return []
  }
}

export async function updateTicketStatus(ticketId: string, status: 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'ABSENT') {
  try {
    const session = await getServerSession(authOptions)
    if (!session || ((session.user as any).role !== 'AGENT' && (session.user as any).role !== 'MANAGER')) {
      throw new Error("Unauthorized")
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status }
    })

    revalidatePath('/agent')
    // We should also revalidate the ticket page for the user
    revalidatePath(`/ticket/${ticket.id}`)

    return { success: true }
  } catch (error) {
    console.error("Update ticket status error:", error)
    return { success: false }
  }
}
