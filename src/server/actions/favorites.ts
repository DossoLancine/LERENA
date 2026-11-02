'use server'

import { prisma } from "@/lib/prisma"
import { getSessionUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { sectorColor } from '@/lib/icons'

export async function toggleFavorite(orgId: string) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' }
    }

    const userId = user.id

    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId
        }
      }
    })

    if (existingFavorite) {
      await prisma.favorite.delete({
        where: { id: existingFavorite.id }
      })
      revalidatePath(`/org/${orgId}`)
      revalidatePath('/favorites')
      return { success: true, isFavorite: false }
    } else {
      await prisma.favorite.create({
        data: {
          userId,
          organizationId: orgId
        }
      })
      revalidatePath(`/org/${orgId}`)
      revalidatePath('/favorites')
      return { success: true, isFavorite: true }
    }
  } catch (error: any) {
    console.error("Toggle favorite error:", error)
    return { success: false, error: error.message }
  }
}

export async function checkIsFavorite(orgId: string) {
  try {
    const user = await getSessionUser()
    if (!user) return false

    const userId = user.id
    const count = await prisma.favorite.count({
      where: {
        userId,
        organizationId: orgId
      }
    })
    return count > 0
  } catch (error) {
    return false
  }
}

export async function getMyFavorites() {
  try {
    const user = await getSessionUser()
    if (!user) return []

    const userId = user.id

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            sector: { select: { icon: true, color: true } },
            branches: {
              select: { services: { where: { isActive: true }, select: { avgDurationMin: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedFavs = await Promise.all(favorites.map(async (fav) => {
      const org = fav.organization

      // Attente réelle : personnes en file × durée moyenne des services
      const durations = org.branches.flatMap(b => b.services.map(sv => sv.avgDurationMin))
      const avgDuration = durations.length ? durations.reduce((a, d) => a + d, 0) / durations.length : 15
      const waiting = await prisma.ticket.count({ where: { status: 'WAITING', queue: { branch: { organizationId: org.id } } } })
      const totalWait = Math.round(waiting * avgDuration)
      
      const stats = await prisma.ticket.aggregate({
        where: {
          npsScore: { not: null },
          service: { branch: { organizationId: org.id } }
        },
        _avg: { npsScore: true }
      });
      const rating = stats._avg.npsScore ? Number(stats._avg.npsScore.toFixed(1)) : 0;

      return {
        id: org.id,
        name: org.name,
        category: org.category,
        icon: org.sector?.icon ?? 'building',
        color: sectorColor(org.sector?.color).soft,
        colorHex: sectorColor(org.sector?.color).hex,
        brandColor: org.brandColor,
        logoUrl: org.logo ? `/api/logo/${org.id}?v=${org.updatedAt.getTime()}` : null,
        address: org.address,
        waitMin: totalWait,
        waitingCount: waiting,
        isOpen: org.isActive,
        rating
      }
    }))

    return formattedFavs
  } catch (error) {
    console.error("Get my favorites error:", error)
    return []
  }
}
