import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { parseSectorServices } from '@/lib/platform'
import { tempPassword } from '@/lib/passwords'
import { DEFAULT_PRIORITIES } from '@/lib/priorities'

// Création d'établissements à partir des modèles de secteur (services, préfixes, pictogrammes en base).
// Utilisé par l'espace réseau (/org-admin) et l'administration de la plateforme (/admin).

// Horaires de départ, modifiables ensuite par le responsable du site
const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map(day => ({
  dayOfWeek: day,
  openTime: '08:00',
  closeTime: day === 6 ? '12:00' : '17:00',
  isClosed: day === 0
}))

export interface NewSiteInput {
  name: string
  sectorId: string
  networkId?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  email?: string | null
}

/** Crée l'établissement, son site principal, ses horaires et les services du modèle de secteur. */
export async function provisionOrganization(input: NewSiteInput) {
  const sector = await prisma.sector.findUnique({ where: { id: input.sectorId } })
  if (!sector) throw new Error('Secteur introuvable')

  const org = await prisma.organization.create({
    data: {
      name: input.name.trim().slice(0, 80),
      category: sector.name,
      sectorId: sector.id,
      networkId: input.networkId ?? null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      branches: {
        create: {
          name: 'Site principal',
          businessHours: { create: DEFAULT_HOURS }
        }
      },
      // Motifs de priorité de départ, modifiables dans Paramètres → Priorités
      priorityCategories: { create: DEFAULT_PRIORITIES.map((p, i) => ({ ...p, sortOrder: i + 1 })) }
    },
    select: { id: true, name: true }
  })

  const added = await applySectorServices(org.id, sector.id)
  return { ...org, services: added }
}

/** Ajoute les services du modèle de secteur qui manquent encore, avec une file par préfixe. */
export async function applySectorServices(orgId: string, sectorId: string) {
  const [sector, branch] = await Promise.all([
    prisma.sector.findUnique({ where: { id: sectorId }, select: { services: true } }),
    prisma.branch.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      include: { services: { select: { name: true } }, queues: { select: { prefix: true } } }
    })
  ])
  if (!sector || !branch) return 0

  const existing = new Set(branch.services.map(s => s.name.toLowerCase()))
  const prefixes = new Set(branch.queues.map(q => q.prefix.toUpperCase()))
  let added = 0

  for (const tpl of parseSectorServices(sector.services)) {
    if (existing.has(tpl.name.toLowerCase())) continue
    await prisma.service.create({
      data: { branchId: branch.id, name: tpl.name, avgDurationMin: tpl.durationMin, icon: tpl.icon ?? null }
    })
    if (!prefixes.has(tpl.prefix)) {
      await prisma.queue.create({ data: { branchId: branch.id, name: `File ${tpl.name}`, prefix: tpl.prefix } })
      prefixes.add(tpl.prefix)
    }
    added++
  }
  return added
}

/**
 * Crée (ou rattache) le compte d'un collaborateur d'établissement.
 * Retourne le mot de passe provisoire quand un compte est créé : il n'est affiché qu'une fois.
 */
export async function createStaffAccount(orgId: string, data: { name: string; email: string; phone?: string | null; role: 'MANAGER' | 'AGENT' | 'RECEPTION' }) {
  const email = data.email.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Adresse e-mail invalide')

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, memberships: { select: { organizationId: true } } }
  })
  if (existing && existing.memberships.some(m => m.organizationId !== orgId)) {
    throw new Error('Ce compte appartient déjà à un autre établissement')
  }
  if (existing && !['CLIENT', 'AGENT', 'RECEPTION', 'MANAGER'].includes(existing.role)) {
    throw new Error('Ce compte a déjà un rôle d’administration')
  }

  let password: string | null = null
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { role: data.role }, select: { id: true } })
    : await (async () => {
        password = tempPassword()
        return prisma.user.create({
          data: { email, name: data.name.trim(), phone: data.phone?.trim() || null, password: await bcrypt.hash(password, 10), role: data.role, mustChangePassword: true },
          select: { id: true }
        })
      })()

  await prisma.organizationMember.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    update: { role: data.role },
    create: { userId: user.id, organizationId: orgId, role: data.role }
  })
  return { userId: user.id, email, tempPassword: password as string | null }
}

/** Compte d'administration ou de lecture d'un réseau ; mot de passe provisoire renvoyé une seule fois. */
export async function createNetworkAccount(networkId: string, data: { name: string; email: string; role: 'ORG_ADMIN' | 'VIEWER' }) {
  const email = data.email.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Adresse e-mail invalide')

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, memberships: { select: { id: true } }, networkMemberships: { select: { networkId: true } } }
  })
  if (existing && (existing.memberships.length > 0 || !['CLIENT', 'ORG_ADMIN', 'VIEWER'].includes(existing.role))) {
    throw new Error('Ce compte est déjà utilisé par un établissement ou la plateforme')
  }
  if (existing?.networkMemberships.some(m => m.networkId !== networkId)) {
    throw new Error('Ce compte appartient déjà à un autre réseau')
  }

  let password: string | null = null
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { role: data.role }, select: { id: true } })
    : await (async () => {
        password = tempPassword()
        return prisma.user.create({
          data: { email, name: data.name.trim(), password: await bcrypt.hash(password, 10), role: data.role, mustChangePassword: true },
          select: { id: true }
        })
      })()

  await prisma.networkMember.upsert({
    where: { userId_networkId: { userId: user.id, networkId } },
    update: { role: data.role },
    create: { userId: user.id, networkId, role: data.role }
  })
  return { userId: user.id, email, tempPassword: password as string | null }
}
