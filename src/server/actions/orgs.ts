'use server'

import { prisma } from "@/lib/prisma"
import { distanceKm, formatDistance } from "@/lib/geo"
import { sectorColor } from "@/lib/icons"
import { priorityOptions } from "@/lib/priorities"

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
        sector: { select: { slug: true, icon: true, color: true } },
        branches: {
          select: {
            queues: { select: { id: true } },
            services: { where: { isActive: true }, select: { avgDurationMin: true } }
          }
        }
      }
    })

    // Requêtes groupées (pas de N+1) : notes NPS et personnes en attente par file
    const [allNpsStats, waitingByQueue] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['queueId'],
        where: { npsScore: { not: null } },
        _avg: { npsScore: true },
        _count: { npsScore: true }
      }),
      prisma.ticket.groupBy({
        by: ['queueId'],
        where: { status: 'WAITING' },
        _count: { _all: true }
      })
    ])
    const waitingMap = new Map(waitingByQueue.map(w => [w.queueId, w._count._all]))

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
      // Attente estimée = personnes en file × durée moyenne des services de l'établissement
      const waitingCount = org.branches.reduce((acc, b) => acc + b.queues.reduce((q, queue) => q + (waitingMap.get(queue.id) ?? 0), 0), 0)
      const durations = org.branches.flatMap(b => b.services.map(sv => sv.avgDurationMin))
      const avgDuration = durations.length ? durations.reduce((a, d) => a + d, 0) / durations.length : 15
      const waitMin = Math.round(waitingCount * avgDuration)

      const nps = orgNpsMap.get(org.id)
      const rating = nps && nps.count > 0 ? Number((nps.totalScore / nps.count).toFixed(1)) : 0
      const reviewCount = nps?.count || 0

      // Pictogramme et couleur viennent du secteur choisi en base
      const palette = sectorColor(org.sector?.color)

      let distanceNum = Infinity;
      let distanceStr = "";
      if (userLat && userLng && org.lat && org.lng) {
        distanceNum = distanceKm(userLat, userLng, org.lat, org.lng);
        distanceStr = formatDistance(distanceNum);
      }

      return {
        id: org.id,
        name: org.name,
        category: org.category,
        sectorSlug: org.sector?.slug ?? null,
        distanceNum,
        distance: distanceStr,
        waitMin,
        waitingCount,
        waitRange: waitMin > 0 ? `${waitMin}-${waitMin + 10} min` : "0-10 min",
        isOpen: org.isActive,
        lat: org.lat,
        lng: org.lng,
        rating,
        reviewCount,
        address: org.address ?? "",
        icon: org.sector?.icon ?? "building",
        color: palette.soft,
        colorHex: palette.hex,
        // Mise en avant payée : en tête de liste avec le badge « À la une »
        featured: !!org.featuredUntil && org.featuredUntil.getTime() > Date.now(),
        // Logo servi à part (/api/logo) pour garder la liste légère ; ?v= change à chaque modification
        logoUrl: org.logo ? `/api/logo/${org.id}?v=${org.updatedAt.getTime()}` : null,
        brandColor: org.brandColor
      }
    })

    if (userLat && userLng) {
      formattedOrgs.sort((a, b) => Number(b.featured) - Number(a.featured) || a.distanceNum - b.distanceNum);
    }

    // Les établissements à la une passent devant (le tri reste stable pour les autres)
    formattedOrgs.sort((a, b) => Number(b.featured) - Number(a.featured));
    return formattedOrgs;
  } catch (error) {
    console.error("Failed to fetch organizations:", error)
    return []
  }
}

export async function getOrganizationById(id: string, userLat?: number, userLng?: number) {
  try {
    const [org, stats, waitingByService, priorities] = await Promise.all([
      prisma.organization.findUnique({
        where: { id },
        include: {
          sector: { select: { slug: true, icon: true, color: true } },
          branches: { include: { services: true, queues: true, businessHours: true } }
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
      }),
      // Personnes réellement en attente, par service
      prisma.ticket.groupBy({
        by: ['serviceId'],
        where: { status: 'WAITING', service: { branch: { organizationId: id } } },
        _count: { _all: true }
      }),
      // Motifs proposés dans l'application (vide si l'établissement ne l'autorise pas)
      priorityOptions(id, 'app')
    ])

    if (!org) return null;

    const waitingMap = new Map(waitingByService.map(w => [w.serviceId, w._count._all]))
    const branches = org.branches.map(b => ({
      ...b,
      services: b.services.map(svc => {
        const waitingCount = waitingMap.get(svc.id) ?? 0
        return { ...svc, waitingCount, waitMin: waitingCount * svc.avgDurationMin }
      })
    }))
    const allServices = branches.flatMap(b => b.services)
    const waitingCount = allServices.reduce((acc, svc) => acc + svc.waitingCount, 0)
    const waitMin = allServices.reduce((acc, svc) => acc + svc.waitMin, 0)

    const rating = stats._avg.npsScore ? Number(stats._avg.npsScore.toFixed(1)) : 0;
    const reviewCount = stats._count.npsScore || 0;

    // Heure de fermeture du jour, d'après les horaires saisis par l'établissement
    const today = org.branches.flatMap(b => b.businessHours).find(h => h.dayOfWeek === new Date().getDay())
    const closeTime = today && !today.isClosed ? today.closeTime : null
    const openTime = today && !today.isClosed ? today.openTime : null
    const busy = await busyHoursToday(id, openTime, closeTime)

    let distanceStr = "À proximité";
    let distanceNum = Infinity;
    if (userLat && userLng && org.lat && org.lng) {
      distanceNum = distanceKm(userLat, userLng, org.lat, org.lng);
      distanceStr = formatDistance(distanceNum);
    }

    return {
      ...org,
      branches,
      priorities,
      waitingCount,
      waitMin,
      isOpen: org.isActive,
      closeTime,
      openTime,
      busy,
      sectorIcon: org.sector?.icon ?? "building",
      rating,
      reviewCount,
      distanceNum,
      distance: distanceStr,
      address: org.address ?? ""
    }
  } catch (error) {
    console.error("Failed to fetch organization:", error)
    return null
  }
}

/**
 * Affluence du jour, heure par heure : moyenne des 4 derniers mêmes jours de la semaine, et le réel d'aujourd'hui.
 * Sert la courbe « Affluence » de la fiche et le conseil « meilleur moment pour venir ».
 */
async function busyHoursToday(orgId: string, openTime: string | null, closeTime: string | null) {
  const now = new Date()
  const dow = now.getUTCDay()
  const since = new Date(now.getTime() - 28 * 86400_000)
  const startOfDay = new Date(now.toISOString().slice(0, 10) + 'T00:00:00Z')
  const rows = await prisma.$queryRaw<{ h: number; past: bigint; today: bigint }[]>`
    SELECT extract(hour from t."createdAt")::int AS h,
           count(*) FILTER (WHERE t."createdAt" < ${startOfDay}) AS past,
           count(*) FILTER (WHERE t."createdAt" >= ${startOfDay}) AS today
    FROM "Ticket" t JOIN "Queue" q ON q.id = t."queueId" JOIN "Branch" b ON b.id = q."branchId"
    WHERE b."organizationId" = ${orgId} AND t."createdAt" >= ${since} AND extract(dow from t."createdAt") = ${dow}
    GROUP BY 1`
  const from = openTime ? Number(openTime.slice(0, 2)) : 7
  const to = closeTime ? Math.max(from + 1, Number(closeTime.slice(0, 2)) + (closeTime.slice(3) === '00' ? 0 : 1)) : 18
  const byHour = new Map(rows.map(r => [r.h, r]))
  const hours = Array.from({ length: Math.max(1, to - from) }, (_, i) => {
    const h = from + i
    const r = byHour.get(h)
    return { hour: h, usual: r ? Math.round((Number(r.past) / 4) * 10) / 10 : 0, today: r ? Number(r.today) : 0 }
  })
  const total = hours.reduce((sum, h) => sum + h.usual + h.today, 0)
  if (total === 0) return null
  // Meilleur moment : l'heure la plus calme parmi celles qui restent aujourd'hui
  const left = hours.filter(h => h.hour > now.getUTCHours())
  const best = left.length ? left.reduce((a, b) => (b.usual < a.usual ? b : a)) : null
  return { hours, nowHour: now.getUTCHours(), bestHour: best?.hour ?? null }
}
