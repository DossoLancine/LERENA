'use server'

import { prisma } from "@/lib/prisma"

// Calcule la distance en km entre deux points GPS
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function getOrganizations(search?: string, userLat?: number, userLng?: number) {
  try {
    const orgs = await prisma.organization.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } }
        ]
      } : undefined,
      include: {
        branches: { include: { queues: true } }
      }
    })

    // ✅ FIX N+1: 1 seule requête groupée pour tous les scores NPS
    const allNpsStats = await prisma.ticket.groupBy({
      by: ['queueId'],
      where: { npsScore: { not: null } },
      _avg: { npsScore: true },
      _count: { npsScore: true }
    })

    const queueToOrg = await prisma.queue.findMany({
      where: { id: { in: allNpsStats.map(s => s.queueId) } },
      select: { id: true, branch: { select: { organizationId: true } } }
    })
    const queueOrgMap = new Map(queueToOrg.map(q => [q.id, q.branch.organizationId]))

    const orgNpsMap = new Map<string, { totalScore: number, count: number }>()
    for (const stat of allNpsStats) {
      const orgId = queueOrgMap.get(stat.queueId)
      if (!orgId) continue
      const existing = orgNpsMap.get(orgId) || { totalScore: 0, count: 0 }
      orgNpsMap.set(orgId, {
        totalScore: existing.totalScore + (stat._avg.npsScore || 0) * stat._count.npsScore,
        count: existing.count + stat._count.npsScore
      })
    }

    const formattedOrgs = orgs.map(org => {
      const totalWait = org.branches.reduce((acc, branch) => {
        return acc + branch.queues.reduce((qAcc, q) => qAcc + (q.currentNum * 15), 0)
      }, 0)

      const nps = orgNpsMap.get(org.id)
      const rating = nps && nps.count > 0 ? Number((nps.totalScore / nps.count).toFixed(1)) : 0
      const reviewCount = nps?.count || 0

      let icon = "health"
      let color = "bg-blue-50 text-blue-600"
      if (org.category === 'Pharmacie') { icon = "pharmacy"; color = "bg-green-50 text-green-600" }
      else if (org.category === 'Beauté') { icon = "beauty"; color = "bg-pink-50 text-pink-600" }
      else if (org.category === 'Restauration') { icon = "food"; color = "bg-orange-50 text-orange-600" }
      else if (org.category === 'Banque') { icon = "bank"; color = "bg-gray-50 text-gray-600" }

      let distanceNum = Infinity;
      let distanceStr = "";
      if (userLat && userLng && org.lat && org.lng) {
        distanceNum = calculateDistance(userLat, userLng, org.lat, org.lng);
        distanceStr = distanceNum < 1 ? `${Math.round(distanceNum * 1000)} m` : `${distanceNum.toFixed(1)} km`;
      }

      return {
        id: org.id,
        name: org.name,
        category: org.category,
        distanceNum,
        distance: distanceStr,
        waitRange: totalWait > 0 ? `${totalWait}-${totalWait + 10} min` : "0-10 min",
        isOpen: org.isActive,
        lat: org.lat,
        lng: org.lng,
        rating,
        reviewCount,
        address: org.address || "Abidjan",
        icon,
        color
      }
    })

    if (userLat && userLng) {
      formattedOrgs.sort((a, b) => a.distanceNum - b.distanceNum);
    }

    return formattedOrgs;
  } catch (error) {
    console.error("Failed to fetch organizations:", error)
    return []
  }
}

export async function getOrganizationById(id: string, userLat?: number, userLng?: number) {
  try {
    const [org, stats] = await Promise.all([
      prisma.organization.findUnique({
        where: { id },
        include: {
          branches: { include: { services: true, queues: true } }
        }
      }),
      // ✅ FIX: Parallélisé avec Promise.all pour ne pas attendre l'une après l'autre
      prisma.ticket.aggregate({
        where: {
          npsScore: { not: null },
          service: { branch: { organizationId: id } }
        },
        _avg: { npsScore: true },
        _count: { npsScore: true }
      })
    ])

    if (!org) return null;

    const rating = stats._avg.npsScore ? Number(stats._avg.npsScore.toFixed(1)) : 0;
    const reviewCount = stats._count.npsScore || 0;

    let distanceStr = "À proximité";
    let distanceNum = Infinity;
    if (userLat && userLng && org.lat && org.lng) {
      distanceNum = calculateDistance(userLat, userLng, org.lat, org.lng);
      distanceStr = distanceNum < 1 ? `${Math.round(distanceNum * 1000)} m` : `${distanceNum.toFixed(1)} km`;
    }

    return {
      ...org,
      isOpen: org.isActive,
      closeTime: "18:00",
      rating,
      reviewCount,
      distanceNum,
      distance: distanceStr,
      address: org.address || "Abidjan, CI"
    }
  } catch (error) {
    console.error("Failed to fetch organization:", error)
    return null
  }
}
