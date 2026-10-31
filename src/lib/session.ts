import { cache } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { STAFF_ROLES, type Role } from '@/lib/constants'

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
}

// Organisation du membre connecté. Jamais de repli sur un autre établissement :
// sans adhésion, l'accès est refusé.
const getMemberContext = cache(async (): Promise<MemberContext | null> => {
  const user = await getSessionUser()
  if (!user || !STAFF_ROLES.includes(user.role)) return null

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { organizationId: true }
  })
  if (!membership) return null

  return { userId: user.id, role: user.role, orgId: membership.organizationId }
})

export async function getManagerContext() {
  const ctx = await getMemberContext()
  return ctx?.role === 'MANAGER' ? ctx : null
}

// Agents de guichet et responsables (écran /agent)
export async function getStaffContext() {
  const ctx = await getMemberContext()
  return ctx && (ctx.role === 'AGENT' || ctx.role === 'MANAGER') ? ctx : null
}

// Accueil (écran /reception) : agents d'accueil et responsables
export async function getReceptionContext() {
  const ctx = await getMemberContext()
  return ctx && (ctx.role === 'RECEPTION' || ctx.role === 'MANAGER') ? ctx : null
}

// Identifiants des files d'attente d'une organisation
export async function getOrgQueueIds(orgId: string) {
  const queues = await prisma.queue.findMany({
    where: { branch: { organizationId: orgId } },
    select: { id: true }
  })
  return queues.map(q => q.id)
}
