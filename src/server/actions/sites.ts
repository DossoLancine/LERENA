'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext, getReceptionContext } from '@/lib/session'
import { ALL_SITES, SITE_COOKIE, listSites, siteScope } from '@/lib/sites'
import { audit } from '@/lib/audit'
import { notifyOrg } from '@/lib/realtime'
import { assertCanAddSite, checkLimit } from '@/lib/billing'

// Sites (agences, antennes) d'un établissement : liste, site actif, création et modification.

const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  dayOfWeek: day, openTime: '08:00', closeTime: day === 6 ? '12:00' : '17:00', isClosed: day === 0
}))

async function memberCtx() {
  return (await getManagerContext()) ?? (await getReceptionContext())
}

/** Sites de l'établissement et site actif sur cet appareil (null = tous les sites). */
export async function getSitesOverview() {
  const ctx = await memberCtx()
  if (!ctx) return null
  const [sites, active, waiting] = await Promise.all([
    listSites(ctx.orgId),
    siteScope(ctx.orgId),
    prisma.ticket.groupBy({ by: ['queueId'], where: { status: 'WAITING', queue: { branch: { organizationId: ctx.orgId } } }, _count: { _all: true } })
  ])
  const queues = await prisma.queue.findMany({ where: { id: { in: waiting.map(w => w.queueId) } }, select: { id: true, branchId: true } })
  const counts = await prisma.branch.findMany({
    where: { organizationId: ctx.orgId },
    select: { id: true, _count: { select: { services: true, counters: true, devices: true } } }
  })
  return {
    activeId: active,
    canManage: !!(await getManagerContext()),
    sites: sites.map(s => ({
      ...s,
      services: counts.find(c => c.id === s.id)?._count.services ?? 0,
      counters: counts.find(c => c.id === s.id)?._count.counters ?? 0,
      devices: counts.find(c => c.id === s.id)?._count.devices ?? 0,
      waiting: waiting.filter(w => queues.find(q => q.id === w.queueId)?.branchId === s.id).reduce((n, w) => n + w._count._all, 0)
    }))
  }
}

/** Change le site actif sur cet appareil (ou « tous les sites »). */
export async function setActiveSite(siteId: string) {
  const ctx = await memberCtx()
  if (!ctx) return { success: false }
  if (siteId !== ALL_SITES) {
    const ok = await prisma.branch.findFirst({ where: { id: siteId, organizationId: ctx.orgId }, select: { id: true } })
    if (!ok) return { success: false }
  }
  cookies().set(SITE_COOKIE, siteId, { path: '/', maxAge: 365 * 86400, sameSite: 'lax', httpOnly: true, secure: process.env.NODE_ENV === 'production' })
  return { success: true }
}

const clean = (v: string | undefined | null, max = 120) => v?.trim().slice(0, max) || null

/** Nouveau site ; ses services peuvent être copiés depuis le site actif. */
export async function createSite(data: { name: string; address?: string; city?: string; phone?: string; copyServices?: boolean }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const name = clean(data.name, 60)
  if (!name) return { success: false as const, error: 'Donnez un nom au site' }
  if (await prisma.branch.findFirst({ where: { organizationId: ctx.orgId, name } })) return { success: false as const, error: 'Un site porte déjà ce nom' }

  const limit = await checkLimit(() => assertCanAddSite(ctx.orgId))
  if (limit) return { success: false as const, error: limit }

  const source = data.copyServices ? await siteScope(ctx.orgId) : null
  const model = source ? await prisma.branch.findUnique({ where: { id: source }, include: { services: { where: { isActive: true } }, queues: true } }) : null

  const site = await prisma.branch.create({
    data: {
      organizationId: ctx.orgId, name,
      address: clean(data.address), city: clean(data.city, 60), phone: clean(data.phone, 30),
      businessHours: { create: DEFAULT_HOURS },
      ...(model ? {
        services: { create: model.services.map(s => ({ name: s.name, description: s.description, avgDurationMin: s.avgDurationMin, icon: s.icon })) },
        queues: { create: model.queues.map(q => ({ name: q.name, prefix: q.prefix })) }
      } : {})
    },
    select: { id: true, name: true }
  })
  await audit({ action: 'SITE_CREATED', targetType: 'Branch', targetId: site.id, organizationId: ctx.orgId, details: `${site.name}${model ? ` (services copiés de ${model.name})` : ''}` })
  await notifyOrg(ctx.orgId)
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true as const, id: site.id }
}

export async function updateSite(id: string, data: { name?: string; address?: string; city?: string; phone?: string; isActive?: boolean }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const site = await prisma.branch.findFirst({ where: { id, organizationId: ctx.orgId } })
  if (!site) return { success: false, error: 'Site introuvable' }
  const name = data.name !== undefined ? clean(data.name, 60) : site.name
  if (!name) return { success: false, error: 'Donnez un nom au site' }
  await prisma.branch.update({
    where: { id },
    data: {
      name,
      ...(data.address !== undefined ? { address: clean(data.address) } : {}),
      ...(data.city !== undefined ? { city: clean(data.city, 60) } : {}),
      ...(data.phone !== undefined ? { phone: clean(data.phone, 30) } : {}),
      ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {})
    }
  })
  await notifyOrg(ctx.orgId)
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}

/** Suppression : seulement un site jamais utilisé (aucun ticket) et jamais le dernier. */
export async function deleteSite(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const [site, total, tickets] = await Promise.all([
    prisma.branch.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true, name: true } }),
    prisma.branch.count({ where: { organizationId: ctx.orgId } }),
    prisma.ticket.count({ where: { queue: { branchId: id } } })
  ])
  if (!site) return { success: false, error: 'Site introuvable' }
  if (total <= 1) return { success: false, error: 'Un établissement garde toujours au moins un site' }
  if (tickets > 0) return { success: false, error: 'Ce site a déjà servi des visiteurs : désactivez-le plutôt que de le supprimer' }
  await prisma.branch.delete({ where: { id } })
  await audit({ action: 'SITE_DELETED', targetType: 'Branch', targetId: id, organizationId: ctx.orgId, details: site.name })
  if (cookies().get(SITE_COOKIE)?.value === id) cookies().delete(SITE_COOKIE)
  return { success: true }
}
