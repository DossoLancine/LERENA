import { cache } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES, type Role } from '@/lib/constants'
import { effectiveRole, permissionsOf, type AccessRole, type Permission } from '@/lib/access-catalog'

export interface SessionUser {
  id: string
  role: Role
  name: string | null
}

// Utilisateur connecté, mis en cache pour toute la durée d'une requête
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions)
  const user = session?.user as { id?: string; role?: Role; name?: string | null } | undefined
  if (!user?.id) return null
  return { id: user.id, role: user.role ?? 'CLIENT', name: user.name ?? null }
})

export interface MemberContext {
  userId: string
  role: Role
  orgId: string
  /** Rôle détaillé (Propriétaire, Directeur régional, Accueil…). */
  accessRole: AccessRole
  permissions: Permission[]
  /** Sites autorisés ; null = tous les sites de l'établissement. */
  siteIds: string[] | null
  can: (permission: Permission) => boolean
}

// Organisation du membre connecté. Jamais de repli sur un autre établissement :
// sans adhésion (ou accès expiré, suspendu), l'accès est refusé.
const getMemberContext = cache(async (): Promise<MemberContext | null> => {
  const user = await getSessionUser()
  if (!user || !STAFF_ROLES.includes(user.role)) return null

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, organizationId: true, role: true, accessRole: true, customRoleId: true, siteIds: true, regionIds: true, expiresAt: true, disabledAt: true }
  })
  if (!membership) return null
  if (membership.disabledAt || (membership.expiresAt && membership.expiresAt.getTime() <= Date.now())) return null

  const accessRole = effectiveRole(membership.accessRole, membership.role)
  const custom = membership.customRoleId
    ? await prisma.customRole.findFirst({ where: { id: membership.customRoleId, organizationId: membership.organizationId }, select: { baseRole: true, permissions: true } })
    : null
  const permissions = permissionsOf(accessRole, custom)

  // Périmètre : sites choisis + sites des régions choisies ; rien de choisi = tout l'établissement
  let siteIds: string[] | null = null
  if (membership.siteIds.length || membership.regionIds.length) {
    const inRegions = membership.regionIds.length
      ? await prisma.branch.findMany({ where: { organizationId: membership.organizationId, regionId: { in: membership.regionIds } }, select: { id: true } })
      : []
    siteIds = Array.from(new Set([...membership.siteIds, ...inRegions.map(b => b.id)]))
  }

  const set = new Set(permissions)
  return { userId: user.id, role: user.role, orgId: membership.organizationId, accessRole, permissions, siteIds, can: (p: Permission) => set.has(p) }
})

/** Membre de l'établissement connecté, quel que soit son écran (utilisé par le filtre de sites). */
export async function getMemberAccess() {
  return getMemberContext()
}

/**
 * Tableau de bord du responsable. Sans droit demandé : consultation (tous les rôles du tableau de bord) ;
 * avec un droit (modification, export…) : refusé si le rôle ne l'a pas.
 */
export async function getManagerContext(permission?: Permission) {
  const ctx = await getMemberContext()
  if (ctx?.role !== 'MANAGER') return null
  return !permission || ctx.can(permission) ? ctx : null
}

// Agents de guichet et responsables (écran /agent)
export async function getStaffContext(permission?: Permission) {
  const ctx = await getMemberContext()
  if (!ctx || (ctx.role !== 'AGENT' && ctx.role !== 'MANAGER')) return null
  return !permission || ctx.can(permission) ? ctx : null
}

// Accueil (écran /reception) : agents d'accueil et responsables
export async function getReceptionContext(permission?: Permission) {
  const ctx = await getMemberContext()
  if (!ctx || (ctx.role !== 'RECEPTION' && ctx.role !== 'MANAGER')) return null
  return !permission || ctx.can(permission) ? ctx : null
}

export interface NetworkContext {
  userId: string
  name: string | null
  networkId: string
  role: 'ORG_ADMIN' | 'VIEWER'
  canEdit: boolean
}

// Réseau de l'administrateur d'organisation (ou du lecteur) connecté
export const getNetworkContext = cache(async (): Promise<NetworkContext | null> => {
  const user = await getSessionUser()
  if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'VIEWER')) return null
  const membership = await prisma.networkMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { networkId: true, role: true }
  })
  if (!membership) return null
  const role = membership.role === 'ORG_ADMIN' ? 'ORG_ADMIN' : 'VIEWER'
  return { userId: user.id, name: user.name, networkId: membership.networkId, role, canEdit: role === 'ORG_ADMIN' }
})

// Équipe Lerena : accès à toute la plateforme
export async function getSuperAdmin() {
  const user = await getSessionUser()
  return user?.role === 'SUPER_ADMIN' ? user : null
}

// Identifiants des files d'attente d'une organisation
export async function getOrgQueueIds(orgId: string) {
  // Membre limité à certains sites : seulement leurs files
  const ctx = await getMemberContext()
  const allowed = ctx && ctx.orgId === orgId ? ctx.siteIds : null
  const queues = await prisma.queue.findMany({
    where: { branch: { organizationId: orgId, ...(allowed ? { id: { in: allowed } } : {}) } },
    select: { id: true }
  })
  return queues.map(q => q.id)
}
