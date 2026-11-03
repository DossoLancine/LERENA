'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { notifyOrg } from '@/lib/realtime'

// Motifs de priorité de l'établissement du responsable connecté (Paramètres → Priorités)

export async function listPriorityCategories() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  return prisma.priorityCategory.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, level: true, selfService: true, isActive: true, sortOrder: true }
  })
}

export async function savePriorityCategory(data: { id?: string; label: string; level: number; selfService: boolean; isActive: boolean }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const label = data.label?.trim().slice(0, 60)
  if (!label) return { success: false, error: 'Donnez un nom au motif' }
  const values = { label, level: data.level >= 3 ? 3 : 2, selfService: !!data.selfService, isActive: !!data.isActive }

  if (data.id) {
    const res = await prisma.priorityCategory.updateMany({ where: { id: data.id, organizationId: ctx.orgId }, data: values })
    if (res.count === 0) return { success: false, error: 'Motif introuvable' }
  } else {
    const last = await prisma.priorityCategory.aggregate({ where: { organizationId: ctx.orgId }, _max: { sortOrder: true } })
    await prisma.priorityCategory.create({ data: { ...values, organizationId: ctx.orgId, sortOrder: (last._max.sortOrder ?? 0) + 1 } })
  }
  await audit({ action: 'PRIORITY_UPDATED', targetType: 'PriorityCategory', targetId: data.id, organizationId: ctx.orgId, details: `${label} (niveau ${values.level})` })
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}

/** Supprime un motif ; les tickets déjà émis gardent leur priorité et son libellé. */
export async function deletePriorityCategory(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false }
  const res = await prisma.priorityCategory.deleteMany({ where: { id, organizationId: ctx.orgId } })
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: res.count > 0 }
}

/** Monte ou descend un motif dans la liste proposée aux visiteurs et à l'accueil. */
export async function movePriorityCategory(id: string, direction: -1 | 1) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false }
  const list = await prisma.priorityCategory.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  })
  const i = list.findIndex(p => p.id === id)
  const j = i + direction
  if (i < 0 || j < 0 || j >= list.length) return { success: false }
  ;[list[i], list[j]] = [list[j], list[i]]
  await prisma.$transaction(list.map((p, index) => prisma.priorityCategory.update({ where: { id: p.id }, data: { sortOrder: index + 1 } })))
  return { success: true }
}

/** Le visiteur peut-il choisir une priorité lui-même, dans l'application et à la borne ? */
export async function getVisitorPrioritySettings() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  return prisma.organization.findUnique({
    where: { id: ctx.orgId },
    select: { visitorPriorityApp: true, visitorPriorityKiosk: true }
  })
}

export async function setVisitorPriority(channel: 'app' | 'kiosk', enabled: boolean) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false }
  if (channel !== 'app' && channel !== 'kiosk') return { success: false }
  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: channel === 'app' ? { visitorPriorityApp: !!enabled } : { visitorPriorityKiosk: !!enabled }
  })
  await audit({ action: 'PRIORITY_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId, details: `Choix de priorité par le visiteur ${channel === 'app' ? 'dans l’application' : 'à la borne'} : ${enabled ? 'activé' : 'désactivé'}` })
  await notifyOrg(ctx.orgId)
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}
