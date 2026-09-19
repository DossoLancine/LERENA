'use server'

import { prisma } from "@/lib/prisma"

export async function getTVQueue(orgId: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: {
          include: {
            queues: {
              include: {
                tickets: {
                  where: {
                    status: { in: ['WAITING', 'CALLED', 'SERVING'] }
                  },
                  orderBy: { number: 'asc' },
                  include: { service: true, user: true }
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
      counter: t.guestPhone?.startsWith('G-') ? t.guestPhone.replace('G-', '') : 'Guichet 1'
    })

    // Sort: CALLED and SERVING first, then WAITING
    const active = allTickets
      .filter(t => t.status === 'CALLED' || t.status === 'SERVING')
      .map(mapTicket)

    const waiting = allTickets
      .filter(t => t.status === 'WAITING')
      .slice(0, 8)
      .map(mapTicket)

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
      active,
      waiting,
      tvVideoUrl: playlist[0]?.url || org.tvVideoUrl || null,
      playlist,
      tvMode: org.tvMode || 'HYBRID',
      tvQueueDuration: org.tvQueueDuration || 30,
      tvVideoDuration: org.tvVideoDuration || 30,
      promotions: org.promotions || []
    }

  } catch (error) {
    console.error("Get TV queue error:", error)
    return null
  }
}
