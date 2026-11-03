'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { branchFilter, siteForWrite, scopedBranch } from '@/lib/sites'
import { notifyOrg } from '@/lib/realtime'
import { assertCanAddCounter, checkLimit } from '@/lib/billing'

// Gestion des guichets par le responsable : nom, services traités, actif ou non

// Site où créer les guichets : le site actif du responsable
const mainBranchId = (orgId: string) => siteForWrite(orgId)

export async function getCounters() {
  const ctx = await getManagerContext()
  if (!ctx) return null

  const [counters, services] = await Promise.all([
    prisma.counter.findMany({
      where: { branch: await branchFilter(ctx.orgId) },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isActive: true, serviceIds: true }
    }),
    prisma.service.findMany({
      where: { branch: await branchFilter(ctx.orgId) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, isActive: true }
    })
  ])
  return { counters, services }
}

export async function createCounter(name: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const clean = name.trim().slice(0, 40)
  if (!clean) return { success: false, error: 'Donnez un nom au guichet' }

  const branchId = await mainBranchId(ctx.orgId)
  if (!branchId) return { success: false, error: 'Aucune agence configurée' }

  const limit = await checkLimit(() => assertCanAddCounter(ctx.orgId, branchId))
  if (limit) return { success: false, error: limit }

  const exists = await prisma.counter.findFirst({ where: { branchId, name: clean } })
  if (exists) return { success: false, error: 'Un guichet porte déjà ce nom' }

  await prisma.counter.create({ data: { branchId, name: clean, serviceIds: [] } })
  await notifyOrg(ctx.orgId)
  revalidatePath('/dashboard/counters')
  return { success: true }
}

export async function updateCounter(id: string, data: { name?: string; isActive?: boolean; serviceIds?: string[] }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }

  const counter = await prisma.counter.findFirst({ where: { id, branch: await scopedBranch(ctx.orgId) } })
  if (!counter) return { success: false, error: 'Guichet introuvable' }

  // Seuls les services de l'établissement peuvent être rattachés
  let serviceIds: string[] | undefined
  if (data.serviceIds) {
    const valid = await prisma.service.findMany({
      where: { id: { in: data.serviceIds }, branch: await scopedBranch(ctx.orgId) },
      select: { id: true }
    })
    serviceIds = valid.map(s => s.id)
  }

  const name = data.name?.trim().slice(0, 40)
  try {
    await prisma.counter.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(serviceIds ? { serviceIds } : {})
      }
    })
  } catch {
    return { success: false, error: 'Un guichet porte déjà ce nom' }
  }
  await notifyOrg(ctx.orgId)
  revalidatePath('/dashboard/counters')
  return { success: true }
}

export async function deleteCounter(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  // Les tickets passés gardent le nom du guichet (counterName) : l'historique reste lisible
  const res = await prisma.counter.deleteMany({ where: { id, branch: await scopedBranch(ctx.orgId) } })
  await notifyOrg(ctx.orgId)
  revalidatePath('/dashboard/counters')
  return { success: res.count > 0 }
}
