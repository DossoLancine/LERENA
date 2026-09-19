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

export async function getLiveQueue() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'MANAGER') {
      throw new Error("Unauthorized")
    }

    const org = await prisma.organization.findFirst({
      include: {
        branches: {
          include: {
            queues: true
          }
        }
      }
    })

    if (!org) return []

    const queueIds = org.branches.flatMap(b => b.queues.map(q => q.id))

    const tickets = await prisma.ticket.findMany({
      where: {
        queueId: { in: queueIds }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ],
      take: 50,
      include: {
        service: true,
        user: true,
        session: {
          include: {
            agent: true
          }
        }
      }
    })

    return tickets.map(t => {
      const waitMin = Math.max(0, Math.round((Date.now() - new Date(t.createdAt).getTime()) / 60000))
      return {
        id: t.id,
        num: t.displayNum,
        name: t.guestName || t.user?.name || 'Visiteur',
        service: t.service?.name || 'Général',
        status: t.status,
        wait: waitMin,
        agentName: t.session?.agent?.name || null,
        counter: (t as any).guestPhone?.startsWith('G-') ? (t as any).guestPhone.replace('G-', '') : 'Guichet 1',
        createdAt: t.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error("Get live queue error:", error)
    return []
  }
}

export async function getOrganizationServices() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any).role !== 'MANAGER') {
      throw new Error("Unauthorized")
    }

    const org = await prisma.organization.findFirst({
      include: {
        branches: {
          include: {
            services: {
              include: {
                tickets: true,
                sessions: true
              }
            }
          }
        }
      }
    })

    if (!org) return []

    const services = org.branches.flatMap(b => b.services)

    return services.map(s => {
      const waitingCount = s.tickets.filter(t => t.status === 'WAITING').length
      const completedTickets = s.tickets.filter(t => t.status === 'COMPLETED')
      
      let realAvg = s.avgDurationMin
      if (s.sessions && s.sessions.length > 0) {
        const durations = s.sessions.filter(sess => sess.durationSeconds && sess.durationSeconds > 0)
        if (durations.length > 0) {
          const sum = durations.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0)
          realAvg = Math.round(sum / durations.length / 60) || s.avgDurationMin
        }
      }

      return {
        id: s.id,
        name: s.name,
        count: waitingCount,
        completedToday: completedTickets.length,
        avgMin: realAvg,
        agents: 1
      }
    })
  } catch (error) {
    console.error("Get organization services error:", error)
    return []
  }
}
