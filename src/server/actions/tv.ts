'use server'

import { prisma } from "@/lib/prisma"
import { ACTIVE_TICKET_STATUSES, counterLabel } from "@/lib/constants"

/** File affichée par l'écran : celle de son site (siteId), ou de tout l'établissement. */
export async function getTVQueue(orgId: string, siteId?: string | null) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: {
          where: siteId ? { id: siteId } : undefined,
          include: {
            queues: {
              include: {
                tickets: {
                  where: {
                    status: { in: ACTIVE_TICKET_STATUSES }
                  },
                  orderBy: [{ priorityScore: 'desc' }, { queuedAt: 'asc' }],
                  include: {
                    service: { select: { name: true } },
                    user: { select: { name: true } }
                  }
                }
              }
            }
          }
        },
        promotions: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!org) return null

    // Flatten all active tickets for this organization
    const allTickets = org.branches.flatMap(b => 
      b.queues.flatMap(q => q.tickets)
    )

    const mapTicket = (t: any) => ({
      ...t,
      counter: counterLabel(t.counterName)
    })

    // Sort: CALLED and SERVING first, then WAITING
    const active = allTickets
      .filter(t => t.status === 'CALLED' || t.status === 'SERVING')
      .map(mapTicket)

    const waiting = allTickets
      .filter(t => t.status === 'WAITING')
      .sort((a, b) => b.priorityScore - a.priorityScore || a.queuedAt.getTime() - b.queuedAt.getTime())
      .slice(0, 8)
      .map(mapTicket)

    // Derniers appels (2 dernières heures), pour ceux qui ont manqué l'annonce
    const recentCalls = await prisma.ticket.findMany({
      where: { queue: { branch: siteId ? { id: siteId, organizationId: orgId } : { organizationId: orgId } }, calledAt: { gte: new Date(Date.now() - 2 * 3600_000) } },
      orderBy: { calledAt: 'desc' },
      take: 6,
      select: { id: true, displayNum: true, counterName: true, calledAt: true }
    })

    let playlist: Array<{ id: string; title: string; url: string }> = []
    if (org.tvVideoUrl && org.tvVideoUrl.trim()) {
      try {
        if (org.tvVideoUrl.trim().startsWith('[')) {
          playlist = JSON.parse(org.tvVideoUrl)
        } else {
          playlist = [{ id: '1', title: 'Vidéo principale', url: org.tvVideoUrl.trim() }]
        }
      } catch (e) {
        playlist = [{ id: '1', title: 'Vidéo principale', url: org.tvVideoUrl.trim() }]
      }
    }

    return {
      orgId: org.id,
      orgName: org.name,
      siteName: siteId ? org.branches[0]?.name ?? null : null,
      active,
      waiting,
      tvVideoUrl: playlist[0]?.url || org.tvVideoUrl || null,
      playlist,
      tvMode: org.tvMode || 'HYBRID',
      tvQueueDuration: org.tvQueueDuration || 30,
      tvVideoDuration: org.tvVideoDuration || 30,
      promotions: org.promotions || [],
      recentCalls: recentCalls.map(t => ({ id: t.id, displayNum: t.displayNum, counter: counterLabel(t.counterName), calledAt: t.calledAt!.toISOString() })),
      updatedAt: new Date().toISOString()
    }

  } catch (error) {
    console.error("Get TV queue error:", error)
    return null
  }
}
