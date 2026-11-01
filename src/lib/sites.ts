import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Plusieurs sites (agences, antennes) par établissement.
// Le responsable et l'accueil travaillent sur un « site actif », mémorisé par appareil (cookie) :
// un site précis, ou « tous les sites » (vue consolidée, réservée à la consultation).
// Un établissement à un seul site ne voit aucune différence.

export const SITE_COOKIE = 'attends_site'
export const ALL_SITES = 'all'

export async function listSites(orgId: string) {
  return prisma.branch.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, address: true, city: true, lat: true, lng: true, phone: true, isActive: true }
  })
}

async function firstSiteId(orgId: string) {
  const first = await prisma.branch.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  return first?.id ?? null
}

/**
 * Site à afficher : un identifiant de site, ou null pour « tous les sites ».
 * Sans choix (ou choix périmé), le premier site.
 */
export async function siteScope(orgId: string): Promise<string | null> {
  const chosen = cookies().get(SITE_COOKIE)?.value
  if (chosen === ALL_SITES) return null
  if (chosen) {
    const ok = await prisma.branch.findFirst({ where: { id: chosen, organizationId: orgId }, select: { id: true } })
    if (ok) return ok.id
  }
  return firstSiteId(orgId)
}

/** Site où créer quelque chose (service, guichet, horaires…) : le site actif, ou le premier en vue « tous les sites ». */
export async function siteForWrite(orgId: string): Promise<string | null> {
  return (await siteScope(orgId)) ?? firstSiteId(orgId)
}

/** Filtre Prisma « appartient au site actif » (ou à l'établissement en vue consolidée), pour une relation branch. */
export async function branchFilter(orgId: string) {
  const id = await siteScope(orgId)
  return id ? { id, organizationId: orgId } : { organizationId: orgId }
}

/** Files d'attente d'un site (ou de tout l'établissement si branchId est null). */
export async function siteQueueIds(orgId: string, branchId?: string | null) {
  const queues = await prisma.queue.findMany({
    where: branchId ? { branchId, branch: { organizationId: orgId } } : { branch: { organizationId: orgId } },
    select: { id: true }
  })
  return queues.map(q => q.id)
}
