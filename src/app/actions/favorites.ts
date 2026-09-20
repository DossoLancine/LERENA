'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function toggleFavorite(orgId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'UNAUTHORIZED' }
    }

    const userId = (session.user as any).id

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
    const session = await getServerSession(authOptions)
    if (!session?.user) return false

    const userId = (session.user as any).id
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
    const session = await getServerSession(authOptions)
    if (!session?.user) return []

    const userId = (session.user as any).id

    const favorites = await prisma.favorite.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            branches: {
              include: { queues: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedFavs = await Promise.all(favorites.map(async (fav) => {
      const org = fav.organization

      const totalWait = org.branches.reduce((acc, branch) => {
        return acc + branch.queues.reduce((qAcc, q) => qAcc + (q.currentNum * 15), 0)
      }, 0)
      
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
        distance: "1.2 km",
        waitMin: totalWait,
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
