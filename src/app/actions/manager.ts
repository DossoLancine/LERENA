'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function getManagerStats() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'MANAGER') {
      throw new Error("Unauthorized")
    }

    // In a real app we'd filter by manager's organization ID
    // For MVP, we get the first org stats.
    const org = await prisma.organization.findFirst({
      include: {
        branches: {
          include: {
            queues: {
              include: { tickets: true }
            },
            services: true
          }
        }
      }
    })

    if (!org) throw new Error("No organization found")

    let todayTickets = 0
    let currentWaiting = 0
    let completedTickets = 0

    org.branches.forEach(branch => {
      branch.queues.forEach(queue => {
        queue.tickets.forEach(ticket => {
          todayTickets++
          if (ticket.status === 'WAITING') currentWaiting++
          if (ticket.status === 'COMPLETED') completedTickets++
        })
      })
    })

    return {
      todayTickets,
      currentWaiting,
      completedTickets,
      isOpen: org.isActive,
      orgId: org.id
    }
  } catch (error) {
    console.error("Manager stats error:", error)
    return null
  }
}

export async function toggleOrganizationStatus(orgId: string, isOpen: boolean) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'MANAGER') {
      throw new Error("Unauthorized")
    }

    await prisma.organization.update({
      where: { id: orgId },
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
