'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { metricsByOrg } from '@/lib/metrics'
import { parseSectorServices, type SectorService } from '@/lib/platform'
import { ICONS, SECTOR_COLORS } from '@/lib/icons'
import { provisionOrganization, createStaffAccount, createNetworkAccount } from '@/lib/provisioning'
import { ACTIVE_TICKET_STATUSES, startOfToday } from '@/lib/constants'

// Administration de la plateforme (/admin), réservée à l'équipe ATTENDS (SUPER_ADMIN).
// Tout ce qui varie d'un pays ou d'un secteur à l'autre se règle ici, en base, pas dans le code.

const DENIED = { success: false as const, error: 'Accès réservé à l’administration de la plateforme' }
const fail = (error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : 'Opération impossible' })

// ---- Établissements ----

export async function getAdminOrganizations() {
  if (!(await getSuperAdmin())) return null
  const since = new Date(Date.now() - 30 * 86400_000)
  const [orgs, networks, sectors] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, city: true, isActive: true, createdAt: true, category: true,
        network: { select: { id: true, name: true } },
        sector: { select: { icon: true, color: true } },
        _count: { select: { members: true, devices: true } }
      }
    }),
    prisma.network.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.sector.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true } })
  ])
  const stats = await metricsByOrg(orgs.map(o => o.id), since, new Date(Date.now() + 60_000))
  return {
    networks,
    sectors,
    orgs: orgs.map(o => ({
      id: o.id, name: o.name, city: o.city, isActive: o.isActive, category: o.category,
      createdAt: o.createdAt.toISOString(),
      networkId: o.network?.id ?? null, networkName: o.network?.name ?? null,
      icon: o.sector?.icon ?? 'building', color: o.sector?.color ?? 'orange',
      members: o._count.members, devices: o._count.devices,
      tickets30d: stats.get(o.id)?.tickets ?? 0,
      waitingNow: stats.get(o.id)?.waitingNow ?? 0
    }))
  }
}

/** Mise en service d'un client : établissement, services du secteur et compte du responsable en une fois. */
export async function onboardOrganization(data: {
  name: string; sectorId: string; networkId?: string | null; city?: string; address?: string; phone?: string
  manager: { name: string; email: string; phone?: string }
}) {
  if (!(await getSuperAdmin())) return DENIED
  if (!data.name?.trim()) return { success: false as const, error: 'Le nom de l’établissement est requis' }
  if (!data.manager?.name?.trim() || !data.manager?.email?.trim()) return { success: false as const, error: 'Le responsable (nom et e-mail) est requis' }

  try {
    // Vérifie le compte avant de créer quoi que ce soit, pour ne pas laisser d'établissement orphelin
    const email = data.manager.email.trim().toLowerCase()
    const taken = await prisma.user.findUnique({ where: { email }, select: { memberships: { select: { id: true } }, role: true } })
    if (taken && (taken.memberships.length > 0 || !['CLIENT', 'MANAGER'].includes(taken.role))) {
      return { success: false as const, error: 'Cet e-mail est déjà utilisé par un autre établissement' }
    }

    const org = await provisionOrganization({ ...data, networkId: data.networkId || null })
    const account = await createStaffAccount(org.id, { ...data.manager, role: 'MANAGER' })
    await audit({ action: 'ORG_CREATED', targetType: 'Organization', targetId: org.id, organizationId: org.id, details: `${org.name} · responsable ${account.email}` })
    revalidatePath('/admin')
    revalidatePath('/explore')
    return { success: true as const, orgId: org.id, services: org.services, email: account.email, tempPassword: account.tempPassword }
  } catch (error) {
    return fail(error)
  }
}

export async function setOrganizationNetwork(orgId: string, networkId: string | null) {
  if (!(await getSuperAdmin())) return DENIED
  try {
    await prisma.organization.update({ where: { id: orgId }, data: { networkId: networkId || null } })
    await audit({ action: 'ORG_NETWORK_CHANGED', targetType: 'Organization', targetId: orgId, organizationId: orgId, details: networkId ?? 'aucun réseau' })
    revalidatePath('/admin')
    return { success: true as const }
  } catch (error) {
    return fail(error)
  }
}

// ---- Réseaux ----

export async function getAdminNetworks() {
  if (!(await getSuperAdmin())) return null
  const networks = await prisma.network.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, sector: true,
      _count: { select: { organizations: true } },
      members: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, user: { select: { name: true, email: true } } } }
    }
  })
  return networks.map(n => ({
    id: n.id, name: n.name, sector: n.sector, sites: n._count.organizations,
    members: n.members.map(m => ({ id: m.id, role: m.role, name: m.user.name, email: m.user.email }))
  }))
}

export async function createNetwork(data: { name: string; sector?: string; admin: { name: string; email: string } }) {
  if (!(await getSuperAdmin())) return DENIED
  if (!data.name?.trim()) return { success: false as const, error: 'Le nom du réseau est requis' }
  try {
    const network = await prisma.network.create({ data: { name: data.name.trim().slice(0, 80), sector: data.sector?.trim() || null } })
    try {
      const account = await createNetworkAccount(network.id, { ...data.admin, role: 'ORG_ADMIN' })
      await audit({ action: 'NETWORK_CREATED', targetType: 'Network', targetId: network.id, details: `${network.name} · admin ${account.email}` })
      revalidatePath('/admin/networks')
      return { success: true as const, email: account.email, tempPassword: account.tempPassword }
    } catch (error) {
      // Pas de réseau sans administrateur
      await prisma.network.delete({ where: { id: network.id } })
      throw error
    }
  } catch (error) {
    return fail(error)
  }
}

export async function addNetworkMember(networkId: string, data: { name: string; email: string; role: 'ORG_ADMIN' | 'VIEWER' }) {
  if (!(await getSuperAdmin())) return DENIED
  if (data.role !== 'ORG_ADMIN' && data.role !== 'VIEWER') return { success: false as const, error: 'Rôle invalide' }
  try {
    const account = await createNetworkAccount(networkId, data)
    await audit({ action: 'MEMBER_ADDED', targetType: 'Network', targetId: networkId, details: `${account.email} (${data.role})` })
    revalidatePath('/admin/networks')
    return { success: true as const, email: account.email, tempPassword: account.tempPassword }
  } catch (error) {
    return fail(error)
  }
}

// ---- Secteurs ----

export async function getAdminSectors() {
  if (!(await getSuperAdmin())) return null
  const sectors = await prisma.sector.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { organizations: true } } }
  })
  return {
    icons: Object.entries(ICONS).map(([key, v]) => ({ key, label: v.label })),
    colors: Object.entries(SECTOR_COLORS).map(([key, v]) => ({ key, label: v.label })),
    sectors: sectors.map(s => ({
      id: s.id, slug: s.slug, name: s.name, description: s.description, icon: s.icon, color: s.color,
      sortOrder: s.sortOrder, isActive: s.isActive, organizations: s._count.organizations,
      services: parseSectorServices(s.services)
    }))
  }
}

const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)

async function uniqueSlug(base: string) {
  for (let i = 0; i < 50; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (!(await prisma.sector.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
  return `${base}-${Date.now()}`
}

export async function saveSector(data: {
  id?: string; name: string; description?: string | null; icon: string; color: string
  sortOrder?: number; isActive?: boolean; services: SectorService[]
}) {
  if (!(await getSuperAdmin())) return DENIED
  const name = data.name?.trim()
  if (!name) return { success: false as const, error: 'Le nom du secteur est requis' }
  if (!ICONS[data.icon]) return { success: false as const, error: 'Pictogramme inconnu' }
  if (!SECTOR_COLORS[data.color]) return { success: false as const, error: 'Couleur inconnue' }
  const services = parseSectorServices(data.services).map(s => ({ ...s, icon: s.icon && ICONS[s.icon] ? s.icon : undefined })).slice(0, 20)

  try {
    const values = {
      name: name.slice(0, 60),
      description: data.description?.trim() || null,
      icon: data.icon,
      color: data.color,
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive ?? true,
      services: services as unknown as object
    }
    const sector = data.id
      ? await prisma.sector.update({ where: { id: data.id }, data: values })
      : await prisma.sector.create({ data: { ...values, slug: await uniqueSlug(slugify(name) || 'secteur') } })

    // Le nom du secteur sert de catégorie affichée : on le répercute sur les établissements
    if (data.id) await prisma.organization.updateMany({ where: { sectorId: sector.id }, data: { category: sector.name } })

    await audit({ action: data.id ? 'SECTOR_UPDATED' : 'SECTOR_CREATED', targetType: 'Sector', targetId: sector.id, details: sector.name })
    revalidatePath('/admin/sectors')
    revalidatePath('/explore')
    revalidatePath('/home')
    return { success: true as const, id: sector.id }
  } catch (error) {
    return fail(error)
  }
}

// ---- Réglages de la plateforme ----

export async function getAdminSettings() {
  if (!(await getSuperAdmin())) return null
  return prisma.platformConfig.upsert({ where: { id: 'default' }, update: {}, create: { id: 'default' } })
}

export async function updatePlatformSettings(data: {
  appName: string; defaultCountryCode: string; defaultCity?: string | null
  defaultLat?: number | null; defaultLng?: number | null; demoMode: boolean
}) {
  if (!(await getSuperAdmin())) return DENIED
  const code = data.defaultCountryCode?.trim()
  if (!/^\+\d{1,4}$/.test(code)) return { success: false as const, error: 'Indicatif invalide (ex : +225)' }
  const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  const lat = num(data.defaultLat)
  const lng = num(data.defaultLng)
  if ((lat != null && Math.abs(lat) > 90) || (lng != null && Math.abs(lng) > 180)) return { success: false as const, error: 'Coordonnées invalides' }

  try {
    const values = { appName: data.appName?.trim().slice(0, 40) || 'ATTENDS', defaultCountryCode: code, defaultCity: data.defaultCity?.trim() || null, defaultLat: lat, defaultLng: lng, demoMode: !!data.demoMode }
    await prisma.platformConfig.upsert({ where: { id: 'default' }, update: values, create: { id: 'default', ...values } })
    await audit({ action: 'PLATFORM_SETTINGS_UPDATED', targetType: 'PlatformConfig', details: `mode démo ${values.demoMode ? 'activé' : 'désactivé'}` })
    revalidatePath('/', 'layout')
    return { success: true as const }
  } catch (error) {
    return fail(error)
  }
}

// ---- Santé et journal ----

export async function getPlatformHealth() {
  if (!(await getSuperAdmin())) return null
  const t0 = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const dbLatencyMs = Date.now() - t0
  const onlineSince = new Date(Date.now() - 2 * 60_000)

  const [orgs, users, ticketsToday, activeTickets, devices, devicesOnline, pushSubs] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.ticket.count({ where: { createdAt: { gte: startOfToday() } } }),
    prisma.ticket.count({ where: { status: { in: ACTIVE_TICKET_STATUSES } } }),
    prisma.device.count({ where: { organizationId: { not: null } } }),
    prisma.device.count({ where: { organizationId: { not: null }, lastSeenAt: { gte: onlineSince } } }),
    prisma.pushSubscription.count()
  ])

  // Services externes : seulement « configuré ou non », jamais les valeurs
  const services = [
    { name: 'Base de données', ok: true, detail: `Réponse en ${dbLatencyMs} ms` },
    { name: 'Temps réel', ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL, detail: 'Mises à jour instantanées des écrans' },
    { name: 'Notifications push', ok: !!process.env.VAPID_PRIVATE_KEY, detail: `${pushSubs} appareil(s) abonné(s)` },
    { name: 'SMS', ok: false, detail: 'Fournisseur pas encore branché' }
  ]

  return {
    checkedAt: new Date().toISOString(),
    services,
    counts: { orgs, users, ticketsToday, activeTickets, devices, devicesOnline }
  }
}

export async function getAuditLog(page = 1, action?: string) {
  if (!(await getSuperAdmin())) return null
  const take = 50
  const current = Math.max(1, Math.floor(page) || 1)
  const where = action ? { action } : {}
  const [rows, total, actions] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (current - 1) * take, take }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } })
  ])
  const orgIds = Array.from(new Set(rows.map(r => r.organizationId).filter((x): x is string => !!x)))
  const orgs = await prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
  const orgName = new Map(orgs.map(o => [o.id, o.name]))
  return {
    page: current,
    pages: Math.max(1, Math.ceil(total / take)),
    total,
    actions: actions.map(a => a.action),
    rows: rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), orgName: r.organizationId ? orgName.get(r.organizationId) ?? null : null }))
  }
}
