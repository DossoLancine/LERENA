import type { Prisma } from '@prisma/client'

// Segments prêts à l'emploi du fichier visiteurs, communs à la liste et aux campagnes.

export type CustomerSegment = 'all' | 'new' | 'regular' | 'lapsed' | 'noshow' | 'unhappy'
export const SEGMENTS: CustomerSegment[] = ['all', 'new', 'regular', 'lapsed', 'noshow', 'unhappy']

const DAY = 86400_000

export function segmentWhere(segment: CustomerSegment): Prisma.CustomerWhereInput {
  const now = Date.now()
  switch (segment) {
    case 'new': return { firstSeenAt: { gte: new Date(now - 30 * DAY) } }
    case 'regular': return { visits: { gte: 3 } }
    case 'lapsed': return { visits: { gte: 1 }, lastSeenAt: { lt: new Date(now - 90 * DAY) } }
    case 'noshow': return { noShows: { gte: 2 } }
    case 'unhappy': return { lastRating: { lte: 2 } }
    default: return {}
  }
}
