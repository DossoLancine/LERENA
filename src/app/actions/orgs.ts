'use server'

import { prisma } from "@/lib/prisma"

export async function getOrganizations(search?: string) {
  try {
    const orgs = await prisma.organization.findMany({
      where: search ? {
        OR: [
          { name: { contains: search } },
          { category: { contains: search } }
        ]
      } : undefined,
      include: {
        branches: {
          include: {
            queues: true
          }
        }
      }
    })

    // Formatting for the UI mapping with real DB stats
    const formattedOrgs = await Promise.all(orgs.map(async org => {
      const totalWait = org.branches.reduce((acc, branch) => {
        return acc + branch.queues.reduce((qAcc, q) => qAcc + (q.currentNum * 15), 0)
      }, 0)

      // Fetch real NPS rating for this org
      const stats = await prisma.ticket.aggregate({
        where: {
          npsScore: { not: null },
          service: { branch: { organizationId: org.id } }
        },
        _avg: { npsScore: true },
        _count: { npsScore: true }
      });
      const rating = stats._avg.npsScore ? Number(stats._avg.npsScore.toFixed(1)) : 0;
      const reviewCount = stats._count.npsScore || 0;

      let icon = "health"
      let color = "bg-blue-50 text-blue-600"
      
      if (org.category === 'Pharmacie') { icon = "pharmacy"; color = "bg-green-50 text-green-600" }
      else if (org.category === 'Beauté') { icon = "beauty"; color = "bg-pink-50 text-pink-600" }
      else if (org.category === 'Restauration') { icon = "food"; color = "bg-orange-50 text-orange-600" }
      else if (org.category === 'Banque') { icon = "bank"; color = "bg-gray-50 text-gray-600" }

      return {
        id: org.id,
        name: org.name,
        category: org.category,
        distance: "1.2 km",
        waitRange: totalWait > 0 ? `${totalWait}-${totalWait + 10} min` : "0-10 min",
        isOpen: org.isActive,
        rating: rating,
        reviewCount: reviewCount,
        address: org.address || "Abidjan",
        icon,
        color
      }
    }))
    
    return formattedOrgs;
  } catch (error) {
    console.error("Failed to fetch organizations:", error)
    return []
  }
}

export async function getOrganizationById(id: string) {
  try {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        branches: {
          include: {
            services: true,
            queues: true
          }
        }
      }
    })

    if (!org) return null;

    // Fetch real NPS rating for this org
    const stats = await prisma.ticket.aggregate({
      where: {
        npsScore: { not: null },
        service: { branch: { organizationId: org.id } }
      },
      _avg: { npsScore: true },
      _count: { npsScore: true }
    });
    const rating = stats._avg.npsScore ? Number(stats._avg.npsScore.toFixed(1)) : 0;
    const reviewCount = stats._count.npsScore || 0;

    // Ajouter les métadonnées UI avec les vrais scores
    return {
      ...org,
      isOpen: org.isActive,
      closeTime: "18:00",
      rating: rating,
      reviewCount: reviewCount,
      distance: "1.2 km",
      address: org.address || "Abidjan, CI"
    }
  } catch (error) {
    console.error("Failed to fetch organization:", error)
    return null
  }
}
