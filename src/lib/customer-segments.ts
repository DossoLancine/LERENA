import type { Prisma } from '@prisma/client'

// Segments prêts à l'emploi du fichier visiteurs, communs à la liste et aux campagnes.

export type CustomerSegment = 'all' | 'new' | 'regular' | 'lapsed' | 'noshow' | 'unhappy' | 'shop'
export const SEGMENTS: CustomerSegment[] = ['all', 'new', 'regular', 'lapsed', 'noshow', 'unhappy', 'shop']

const DAY = 86400_000

export function segmentWhere(segment: CustomerSegment): Prisma.CustomerWhereInput {
  const now = Date.now()
  switch (segment) {
    case 'new': return { firstSeenAt: { gte: new Date(now - 30 * DAY) } }
    case 'regular': return { visits: { gte: 3 } }
    case 'lapsed': return { visits: { gte: 1 }, lastSeenAt: { lt: new Date(now - 90 * DAY) } }
    case 'noshow': return { noShows: { gte: 2 } }
    case 'unhappy': return { lastRating: { lte: 2 } }
    case 'shop': return { shopOrders: { some: { status: { in: ['PAID', 'DELIVERED'] } } } }
    default: return {}
  }
}

/** Visiteurs passés par ces sites (ticket ou rendez-vous) ; null = tous les visiteurs de l'établissement. */
export function customerScopeWhere(siteIds: string[] | null): Prisma.CustomerWhereInput {
  if (!siteIds) return {}
  return { OR: [{ tickets: { some: { queue: { branchId: { in: siteIds } } } } }, { appointments: { some: { branchId: { in: siteIds } } } }] }
}
