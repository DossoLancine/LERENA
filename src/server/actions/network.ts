'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getNetworkContext } from '@/lib/session'
import { metricsByOrg, monthRange } from '@/lib/metrics'
import { provisionOrganization, applySectorServices, createStaffAccount } from '@/lib/provisioning'
import { getActiveSectors } from '@/lib/platform'
import { audit } from '@/lib/audit'
import { startOfToday } from '@/lib/constants'

// Espace réseau (/org-admin) : un administrateur pilote tous les sites de son réseau.
// Le lecteur (VIEWER) consulte seulement ; chaque action vérifie que le site appartient au réseau.

async function siteInNetwork(orgId: string, networkId: string) {
  return prisma.organization.findFirst({ where: { id: orgId, networkId }, select: { id: true, name: true, sectorId: true } })
}

/** Vue d'ensemble : sites du réseau avec l'activité du jour, triés par affluence. */
export async function getNetworkOverview() {
  const ctx = await getNetworkContext()
  if (!ctx) return null

  const [network, sites, sectors] = await Promise.all([
    prisma.network.findUnique({ where: { id: ctx.networkId }, select: { name: true } }),
    prisma.organization.findMany({
      where: { networkId: ctx.networkId },
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, city: true, address: true, isActive: true, category: true,
        sector: { select: { id: true, icon: true, color: true } },
        members: { where: { role: 'MANAGER' }, select: { user: { select: { name: true, email: true } } } }
      }
    }),
    getActiveSectors()
  ])

  const today = await metricsByOrg(sites.map(s => s.id), startOfToday(), new Date(Date.now() + 60_000))
  return {
    networkName: network?.name ?? '',
    canEdit: ctx.canEdit,
    sectors: sectors.map(s => ({ id: s.id, name: s.name })),
    sites: sites.map(s => ({
      id: s.id,
      name: s.name,
      city: s.city,
      address: s.address,
      isActive: s.isActive,
      category: s.category,
      sectorId: s.sector?.id ?? null,
      icon: s.sector?.icon ?? 'building',
      color: s.sector?.color ?? 'orange',
      managers: s.members.map(m => m.user.name || m.user.email || ''),
      today: today.get(s.id)!
    }))
  }
}

/** Nouveau site du réseau, prêt à servir : services du secteur, files et horaires créés. */
export async function createNetworkSite(data: { name: string; sectorId: string; city?: string; address?: string; phone?: string }) {
  const ctx = await getNetworkContext()
  if (!ctx?.canEdit) return { success: false as const, error: 'Action réservée à l’administrateur du réseau' }
  if (!data.name?.trim()) return { success: false as const, error: 'Le nom du site est requis' }

  try {
    const org = await provisionOrganization({ ...data, networkId: ctx.networkId })
    await audit({ action: 'SITE_CREATED', targetType: 'Organization', targetId: org.id, organizationId: org.id, details: `${org.name} (${org.services} services)` })
    revalidatePath('/org-admin')
    revalidatePath('/explore')
    return { success: true as const, id: org.id, services: org.services }
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Création impossible' }
  }
}

/** Complète un site avec les services standard de son secteur (sans toucher aux services existants). */
export async function applyTemplateToSite(orgId: string) {
  const ctx = await getNetworkContext()
  if (!ctx?.canEdit) return { success: false as const, error: 'Action réservée à l’administrateur du réseau' }
  const site = await siteInNetwork(orgId, ctx.networkId)
  if (!site) return { success: false as const, error: 'Site introuvable dans votre réseau' }
  if (!site.sectorId) return { success: false as const, error: 'Choisissez d’abord le secteur du site' }

  const added = await applySectorServices(site.id, site.sectorId)
  await audit({ action: 'TEMPLATE_APPLIED', targetType: 'Organization', targetId: site.id, organizationId: site.id, details: `${added} service(s) ajouté(s)` })
  revalidatePath('/org-admin')
  return { success: true as const, added }
}

/** Compte du responsable d'un site ; le mot de passe provisoire est renvoyé une seule fois. */
export async function addSiteManager(orgId: string, data: { name: string; email: string; phone?: string }) {
  const ctx = await getNetworkContext()
  if (!ctx?.canEdit) return { success: false as const, error: 'Action réservée à l’administrateur du réseau' }
  const site = await siteInNetwork(orgId, ctx.networkId)
  if (!site) return { success: false as const, error: 'Site introuvable dans votre réseau' }
  if (!data.name?.trim()) return { success: false as const, error: 'Le nom est requis' }

  try {
    const res = await createStaffAccount(site.id, { ...data, role: 'MANAGER' })
    await audit({ action: 'MEMBER_ADDED', targetType: 'User', targetId: res.userId, organizationId: site.id, details: `${res.email} (MANAGER, par le réseau)` })
    revalidatePath('/org-admin')
    return { success: true as const, email: res.email, tempPassword: res.tempPassword }
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Création impossible' }
  }
}

/** Rapport mensuel du réseau : chiffres par site et totaux, pour impression. */
export async function getNetworkMonthlyReport(month?: string) {
  const ctx = await getNetworkContext()
  if (!ctx) return null
  const range = monthRange(month)

  const [network, sites] = await Promise.all([
    prisma.network.findUnique({ where: { id: ctx.networkId }, select: { name: true } }),
    prisma.organization.findMany({ where: { networkId: ctx.networkId }, orderBy: { name: 'asc' }, select: { id: true, name: true, city: true } })
  ])
  const stats = await metricsByOrg(sites.map(s => s.id), range.from, range.to)
  const rows = sites.map(s => ({ ...s, ...stats.get(s.id)! }))

  const weighted = (key: 'avgWaitMin' | 'avgServiceMin' | 'satisfaction', weight: 'tickets' | 'served' | 'ratings') => {
    const parts = rows.filter(r => r[key] != null && r[weight] > 0)
    const total = parts.reduce((s, r) => s + r[weight], 0)
    return total ? Math.round((parts.reduce((s, r) => s + r[key]! * r[weight], 0) / total) * 10) / 10 : null
  }

  return {
    networkName: network?.name ?? '',
    month: range.month,
    label: range.label,
    rows,
    totals: {
      tickets: rows.reduce((s, r) => s + r.tickets, 0),
      served: rows.reduce((s, r) => s + r.served, 0),
      absent: rows.reduce((s, r) => s + r.absent, 0),
      avgWaitMin: weighted('avgWaitMin', 'tickets'),
      avgServiceMin: weighted('avgServiceMin', 'served'),
      satisfaction: weighted('satisfaction', 'ratings')
    }
  }
}
