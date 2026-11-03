'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getManagerContext, getMemberAccess } from '@/lib/session'
import { audit } from '@/lib/audit'
import { tempPassword } from '@/lib/passwords'
import { sendCredentialsEmail } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { ACCESS_ROLES, ALL_PERMISSIONS, effectiveRole, isAccessRole, permissionsOf, type AccessRole, type Permission } from '@/lib/access-catalog'

// Équipe et accès : rôles, périmètre (sites, régions), accès temporaires, rôles sur mesure, régions.
// Garde-fous : on ne donne jamais plus de droits qu'on n'en a ; seul un Propriétaire nomme un Propriétaire ;
// il reste toujours au moins un Propriétaire actif ; personne ne modifie son propre accès.

type Fail = { success: false; error: string }
const fail = (error: string): Fail => ({ success: false, error })
const DENIED = fail('Non autorisé')

/** Droits et périmètre de la personne connectée (menu, écrans). */
export async function getMyAccess() {
  const ctx = await getMemberAccess()
  if (!ctx) return null
  return { accessRole: ctx.accessRole, label: ACCESS_ROLES[ctx.accessRole].label, permissions: ctx.permissions, scoped: !!ctx.siteIds }
}

async function teamContext() {
  return getManagerContext('team.manage')
}

export async function getTeam() {
  const ctx = await teamContext()
  if (!ctx) return null
  const [members, sites, regions, customRoles] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: ctx.orgId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, role: true, accessRole: true, customRoleId: true, siteIds: true, regionIds: true, expiresAt: true, disabledAt: true, createdAt: true,
        user: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, twoFactorEnabled: true } }
      }
    }),
    prisma.branch.findMany({ where: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, regionId: true } }),
    prisma.region.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, _count: { select: { branches: true } } } }),
    prisma.customRole.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, baseRole: true, permissions: true } })
  ])
  // Un responsable limité à ses sites ne voit que l'équipe de ses sites (et les membres sans périmètre restent hors de sa main)
  const visible = ctx.siteIds
    ? members.filter(m => m.siteIds.length && m.siteIds.every(s => ctx.siteIds!.includes(s)))
    : members
  return {
    me: { userId: ctx.userId, accessRole: ctx.accessRole, permissions: ctx.permissions, scoped: !!ctx.siteIds },
    members: visible.map(m => ({ ...m, accessRole: effectiveRole(m.accessRole, m.role), isMe: m.user.id === ctx.userId })),
    sites, regions: regions.map(r => ({ id: r.id, name: r.name, sites: r._count.branches })), customRoles
  }
}

interface AccessInput {
  accessRole: string
  customRoleId?: string | null
  siteIds?: string[]
  regionIds?: string[]
  expiresAt?: string | null
}

/** Vérifie qu'un accès peut être accordé par la personne connectée ; renvoie l'accès nettoyé. */
async function checkGrant(ctx: NonNullable<Awaited<ReturnType<typeof teamContext>>>, input: AccessInput) {
  if (!isAccessRole(input.accessRole)) return fail('Rôle inconnu')
  const role: AccessRole = input.accessRole
  if (role === 'OWNER' && ctx.accessRole !== 'OWNER') return fail('Seul un propriétaire peut nommer un propriétaire')
  const custom = input.customRoleId
    ? await prisma.customRole.findFirst({ where: { id: input.customRoleId, organizationId: ctx.orgId }, select: { id: true, baseRole: true, permissions: true } })
    : null
  if (input.customRoleId && !custom) return fail('Rôle sur mesure introuvable')
  if (custom && custom.baseRole !== role) return fail('Le rôle sur mesure ne correspond pas au rôle choisi')
  const granted = permissionsOf(role, custom)
  const missing = granted.filter(p => !ctx.can(p))
  if (missing.length) return fail('Vous ne pouvez pas donner des droits que vous n’avez pas')

  const allSites = await prisma.branch.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, regionId: true } })
  const siteIds = Array.from(new Set((input.siteIds ?? []).filter(id => allSites.some(s => s.id === id))))
  const regionIds = Array.from(new Set(input.regionIds ?? []))
  if (regionIds.length) {
    const ok = await prisma.region.count({ where: { organizationId: ctx.orgId, id: { in: regionIds } } })
    if (ok !== regionIds.length) return fail('Région introuvable')
  }
  // Périmètre : un membre limité ne peut accorder qu'à l'intérieur de ses propres sites
  if (ctx.siteIds) {
    const covered = [...siteIds, ...allSites.filter(s => s.regionId && regionIds.includes(s.regionId)).map(s => s.id)]
    if (covered.length === 0 || covered.some(id => !ctx.siteIds!.includes(id))) return fail('Choisissez des sites de votre périmètre')
  }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now())) return fail('La date de fin d’accès est déjà passée')
  return { success: true as const, role, customRoleId: custom?.id ?? null, siteIds, regionIds, expiresAt }
}

async function activeOwners(orgId: string, exceptMemberId?: string) {
  return prisma.organizationMember.count({
    where: { organizationId: orgId, accessRole: 'OWNER', disabledAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], ...(exceptMemberId ? { id: { not: exceptMemberId } } : {}) }
  })
}

/** Membre modifiable par la personne connectée (pas soi-même ; un propriétaire seulement par un propriétaire). */
async function editableMember(ctx: NonNullable<Awaited<ReturnType<typeof teamContext>>>, memberId: string) {
  const m = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: ctx.orgId }, select: { id: true, userId: true, role: true, accessRole: true, siteIds: true } })
  if (!m) return fail('Membre introuvable')
  if (m.userId === ctx.userId) return fail('Vous ne pouvez pas modifier votre propre accès')
  const role = effectiveRole(m.accessRole, m.role)
  if (role === 'OWNER' && ctx.accessRole !== 'OWNER') return fail('Seul un propriétaire peut modifier un propriétaire')
  if (ctx.siteIds && (!m.siteIds.length || m.siteIds.some(s => !ctx.siteIds!.includes(s)))) return fail('Ce membre est hors de votre périmètre')
  return { success: true as const, member: m, role }
}

export async function inviteMember(input: AccessInput & { name: string; email: string; phone?: string }) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  const grant = await checkGrant(ctx, input)
  if (!grant.success) return grant
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('E-mail invalide')
  const name = input.name.trim().slice(0, 80)
  if (!name) return fail('Indiquez le nom')
  const accessClass = ACCESS_ROLES[grant.role].accessClass

  let user = await prisma.user.findUnique({ where: { email }, include: { memberships: { select: { organizationId: true } } } })
  if (user && user.memberships.some(m => m.organizationId !== ctx.orgId)) return fail('Ce compte appartient déjà à un autre établissement')
  if (user && user.memberships.length) return fail('Cette personne fait déjà partie de l’équipe')
  let password: string | null = null
  if (!user) {
    password = tempPassword()
    user = await prisma.user.create({
      data: { email, name, phone: normalizePhone(input.phone) ?? null, password: await bcrypt.hash(password, 10), role: accessClass, mustChangePassword: true },
      include: { memberships: { select: { organizationId: true } } }
    })
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { role: accessClass } })
  }
  await prisma.organizationMember.create({
    data: { userId: user.id, organizationId: ctx.orgId, role: accessClass, accessRole: grant.role, customRoleId: grant.customRoleId, siteIds: grant.siteIds, regionIds: grant.regionIds, expiresAt: grant.expiresAt }
  })
  await audit({ action: 'MEMBER_ADDED', targetType: 'User', targetId: user.id, organizationId: ctx.orgId, details: `${email} · ${ACCESS_ROLES[grant.role].label}${grant.expiresAt ? ` · jusqu’au ${grant.expiresAt.toISOString().slice(0, 10)}` : ''}` })
  if (password) await sendCredentialsEmail({ to: email, name, password, organizationId: ctx.orgId })
  return { success: true as const, tempPassword: password, email, name }
}

export async function updateMemberAccess(memberId: string, input: AccessInput) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  const target = await editableMember(ctx, memberId)
  if (!target.success) return target
  const grant = await checkGrant(ctx, input)
  if (!grant.success) return grant
  if (target.role === 'OWNER' && grant.role !== 'OWNER' && (await activeOwners(ctx.orgId, memberId)) === 0) return fail('Il doit rester au moins un propriétaire')
  const accessClass = ACCESS_ROLES[grant.role].accessClass
  await prisma.$transaction([
    prisma.organizationMember.update({ where: { id: memberId }, data: { role: accessClass, accessRole: grant.role, customRoleId: grant.customRoleId, siteIds: grant.siteIds, regionIds: grant.regionIds, expiresAt: grant.expiresAt } }),
    prisma.user.update({ where: { id: target.member.userId }, data: { role: accessClass, sessionVersion: { increment: 1 } } })
  ])
  await audit({ action: 'MEMBER_ACCESS_CHANGED', targetType: 'OrganizationMember', targetId: memberId, organizationId: ctx.orgId, details: `${ACCESS_ROLES[target.role].label} → ${ACCESS_ROLES[grant.role].label} · ${grant.siteIds.length || grant.regionIds.length ? `${grant.siteIds.length} site(s), ${grant.regionIds.length} région(s)` : 'tous les sites'}` })
  return { success: true as const }
}

/** Suspendre ou rétablir un accès (sans supprimer le compte ni son historique). */
export async function setMemberDisabled(memberId: string, disabled: boolean) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  const target = await editableMember(ctx, memberId)
  if (!target.success) return target
  if (disabled && target.role === 'OWNER' && (await activeOwners(ctx.orgId, memberId)) === 0) return fail('Il doit rester au moins un propriétaire')
  await prisma.$transaction([
    prisma.organizationMember.update({ where: { id: memberId }, data: { disabledAt: disabled ? new Date() : null } }),
    // Déconnexion immédiate de toutes ses sessions
    prisma.user.update({ where: { id: target.member.userId }, data: { sessionVersion: { increment: 1 } } })
  ])
  await audit({ action: disabled ? 'MEMBER_DISABLED' : 'MEMBER_ENABLED', targetType: 'OrganizationMember', targetId: memberId, organizationId: ctx.orgId })
  return { success: true as const }
}

export async function removeMember(memberId: string) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  const target = await editableMember(ctx, memberId)
  if (!target.success) return target
  if (target.role === 'OWNER' && (await activeOwners(ctx.orgId, memberId)) === 0) return fail('Il doit rester au moins un propriétaire')
  await prisma.$transaction([
    prisma.organizationMember.delete({ where: { id: memberId } }),
    prisma.user.update({ where: { id: target.member.userId }, data: { sessionVersion: { increment: 1 } } })
  ])
  await audit({ action: 'MEMBER_REMOVED', targetType: 'OrganizationMember', targetId: memberId, organizationId: ctx.orgId })
  return { success: true as const }
}

// ---- Rôles sur mesure ----

export async function saveCustomRole(input: { id?: string; name: string; baseRole: string; permissions: string[] }) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  if (!isAccessRole(input.baseRole) || input.baseRole === 'OWNER') return fail('Rôle de base invalide')
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 40)
  if (!name) return fail('Indiquez un nom')
  const base = new Set(ACCESS_ROLES[input.baseRole].permissions)
  const permissions = input.permissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p) && base.has(p as Permission))
  if (permissions.some(p => !ctx.can(p))) return fail('Vous ne pouvez pas donner des droits que vous n’avez pas')
  try {
    const role = input.id
      ? await prisma.customRole.update({ where: { id: (await prisma.customRole.findFirstOrThrow({ where: { id: input.id, organizationId: ctx.orgId }, select: { id: true } })).id }, data: { name, permissions } })
      : await prisma.customRole.create({ data: { organizationId: ctx.orgId, name, baseRole: input.baseRole, permissions } })
    await audit({ action: 'CUSTOM_ROLE_SAVED', targetType: 'CustomRole', targetId: role.id, organizationId: ctx.orgId, details: `${name} (${permissions.length} droits)` })
    return { success: true as const, id: role.id }
  } catch {
    return fail('Un rôle porte déjà ce nom')
  }
}

export async function deleteCustomRole(id: string) {
  const ctx = await teamContext()
  if (!ctx) return DENIED
  const used = await prisma.organizationMember.count({ where: { organizationId: ctx.orgId, customRoleId: id } })
  if (used) return fail(`${used} membre${used > 1 ? 's utilisent' : ' utilise'} ce rôle : changez d’abord leur rôle`)
  const res = await prisma.customRole.deleteMany({ where: { id, organizationId: ctx.orgId } })
  return res.count ? { success: true as const } : fail('Rôle introuvable')
}

// ---- Régions ----

export async function saveRegion(input: { id?: string; name: string; siteIds: string[] }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx || ctx.siteIds) return DENIED
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 60)
  if (!name) return fail('Indiquez un nom')
  try {
    const region = input.id
      ? await prisma.region.update({ where: { id: (await prisma.region.findFirstOrThrow({ where: { id: input.id, organizationId: ctx.orgId }, select: { id: true } })).id }, data: { name } })
      : await prisma.region.create({ data: { organizationId: ctx.orgId, name } })
    await prisma.$transaction([
      prisma.branch.updateMany({ where: { organizationId: ctx.orgId, regionId: region.id, id: { notIn: input.siteIds } }, data: { regionId: null } }),
      prisma.branch.updateMany({ where: { organizationId: ctx.orgId, id: { in: input.siteIds } }, data: { regionId: region.id } })
    ])
    await audit({ action: 'REGION_SAVED', targetType: 'Region', targetId: region.id, organizationId: ctx.orgId, details: `${name} · ${input.siteIds.length} site(s)` })
    return { success: true as const }
  } catch {
    return fail('Une région porte déjà ce nom')
  }
}

export async function deleteRegion(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx || ctx.siteIds) return DENIED
  const res = await prisma.region.deleteMany({ where: { id, organizationId: ctx.orgId } })
  return res.count ? { success: true as const } : fail('Région introuvable')
}
