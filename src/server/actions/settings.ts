'use server'

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"
import { getManagerContext, getOrgQueueIds } from "@/lib/session"
import { ACTIVE_TICKET_STATUSES } from "@/lib/constants"
import { priorityText } from "@/lib/priority-text"
import { audit } from "@/lib/audit"
import { notifyOrg } from "@/lib/realtime"
import { tempPassword } from "@/lib/passwords"

// Toutes les actions de ce fichier agissent uniquement sur l'organisation du manager connecté.
// Le paramètre orgId reçu de l'interface est vérifié, jamais utilisé tel quel.
async function requireOwnOrg(orgId?: string) {
  const ctx = await getManagerContext()
  if (!ctx) return null
  if (orgId && orgId !== ctx.orgId) return null
  return ctx
}

const DENIED = { success: false as const, error: 'Accès non autorisé' }

// 1. Récupérer tous les paramètres de l'organisation
export async function getOrganizationSettings() {
  try {
    const ctx = await requireOwnOrg()
    if (!ctx) return DENIED

    const org = await prisma.organization.findUnique({
      where: { id: ctx.orgId },
      include: {
        branches: {
          include: {
            queues: true,
            services: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        promotions: true
      }
    })

    if (!org) {
      return { success: false, error: 'Organisation introuvable' }
    }

    return { success: true, data: org }
  } catch (error: any) {
    console.error('getOrganizationSettings error:', error)
    return { success: false, error: error.message || 'Erreur serveur' }
  }
}

// 2. Mettre à jour les informations de l'organisation
export async function updateOrganizationProfile(orgId: string, data: {
  name: string
  sectorId?: string | null
  description?: string
  address?: string
  city?: string
  phone?: string
  email?: string
  isActive?: boolean
  bookingMode?: string
  tvVideoUrl?: string | null
  tvMode?: string
  tvQueueDuration?: number
  tvVideoDuration?: number
}) {
  try {
    const ctx = await requireOwnOrg(orgId)
    if (!ctx) return DENIED

    // Le secteur vient de la liste gérée en base ; son nom sert de catégorie affichée
    const sector = data.sectorId ? await prisma.sector.findFirst({ where: { id: data.sectorId, isActive: true }, select: { id: true, name: true } }) : null

    const updated = await prisma.organization.update({
      where: { id: ctx.orgId },
      data: {
        name: data.name,
        ...(sector ? { sectorId: sector.id, category: sector.name } : {}),
        description: data.description || null,
        address: data.address || null,
        city: data.city || null,
        phone: data.phone || null,
        email: data.email || null,
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
        ...(data.bookingMode ? { bookingMode: data.bookingMode } : {}),
        ...(typeof data.tvVideoUrl !== 'undefined' ? { tvVideoUrl: data.tvVideoUrl } : {}),
        ...(data.tvMode ? { tvMode: data.tvMode } : {}),
        ...(data.tvQueueDuration !== undefined ? { tvQueueDuration: Number(data.tvQueueDuration) || 30 } : {}),
        ...(data.tvVideoDuration !== undefined ? { tvVideoDuration: Number(data.tvVideoDuration) || 30 } : {})
      }
    })

    await notifyOrg(ctx.orgId)
    revalidatePath('/dashboard')
    revalidatePath(`/org/${ctx.orgId}`)
    revalidatePath(`/tv/${ctx.orgId}`)
    revalidatePath('/explore')
    revalidatePath('/')

    return { success: true, data: updated }
  } catch (error: any) {
    console.error('updateOrganizationProfile error:', error)
    return { success: false, error: error.message || 'Erreur lors de la mise à jour' }
  }
}

// 3. Ajouter un membre / agent à l'organisation
export async function addMemberToOrganization(orgId: string, data: {
  name: string
  email: string
  password?: string
  phone?: string
  role?: 'RECEPTION' | 'AGENT' | 'MANAGER'
}) {
  try {
    const ctx = await requireOwnOrg(orgId)
    if (!ctx) return DENIED

    const email = data.email.trim().toLowerCase()
    const role = data.role || 'AGENT'

    let user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { select: { organizationId: true } } }
    })

    if (user && user.memberships.some(m => m.organizationId !== ctx.orgId)) {
      return { success: false, error: 'Ce compte appartient déjà à un autre établissement' }
    }

    let generatedPassword: string | null = null
    if (!user) {
      // Sans mot de passe saisi, un mot de passe provisoire aléatoire est créé et affiché une seule fois
      const chosen = data.password?.trim()
      if (chosen && chosen.length < 8) return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' }
      if (!chosen) generatedPassword = tempPassword()
      const defaultPassword = chosen || generatedPassword!
      user = await prisma.user.create({
        data: {
          email,
          name: data.name,
          phone: data.phone || null,
          password: await bcrypt.hash(defaultPassword, 10),
          role
        },
        include: { memberships: { select: { organizationId: true } } }
      })
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role,
          ...(data.name ? { name: data.name } : {}),
          ...(data.phone ? { phone: data.phone } : {})
        }
      })
    }

    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: ctx.orgId
        }
      },
      update: { role },
      create: {
        userId: user.id,
        organizationId: ctx.orgId,
        role
      }
    })

    await audit({ action: 'MEMBER_ADDED', targetType: 'User', targetId: user.id, organizationId: ctx.orgId, details: `${email} (${role})` })
    revalidatePath('/dashboard')
    return { success: true, user: { id: user.id, name: user.name, email: user.email, role }, tempPassword: generatedPassword }
  } catch (error: any) {
    console.error('addMemberToOrganization error:', error)
    return { success: false, error: error.message || 'Erreur lors de l’ajout du collaborateur' }
  }
}

// 4. Retirer un agent / membre de l'organisation
export async function removeMemberFromOrganization(memberId: string) {
  try {
    const ctx = await requireOwnOrg()
    if (!ctx) return DENIED

    const res = await prisma.organizationMember.deleteMany({
      where: { id: memberId, organizationId: ctx.orgId, userId: { not: ctx.userId } }
    })
    if (res.count === 0) return { success: false, error: 'Membre introuvable' }
    await audit({ action: 'MEMBER_REMOVED', targetType: 'OrganizationMember', targetId: memberId, organizationId: ctx.orgId })

    revalidatePath('/dashboard')
    return { success: true }
  } catch (error: any) {
    console.error('removeMemberFromOrganization error:', error)
    return { success: false, error: error.message || 'Erreur lors de la suppression' }
  }
}

// 5. Configurer la file d'attente (préfixe, statut)
export async function updateQueueConfig(queueId: string, data: {
  name?: string
  prefix?: string
  status?: string
}) {
  try {
    const ctx = await requireOwnOrg()
    if (!ctx) return DENIED

    const queue = await prisma.queue.findFirst({
      where: { id: queueId, branch: { organizationId: ctx.orgId } },
      select: { id: true }
    })
    if (!queue) return { success: false, error: 'File introuvable' }

    const updated = await prisma.queue.update({
      where: { id: queue.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.prefix !== undefined ? { prefix: data.prefix } : {}),
        ...(data.status !== undefined ? { status: data.status } : {})
      }
    })

    await notifyOrg(ctx.orgId)
    revalidatePath('/dashboard')
    return { success: true, data: updated }
  } catch (error: any) {
    console.error('updateQueueConfig error:', error)
    return { success: false, error: error.message || 'Erreur de configuration' }
  }
}

// 6. Réinitialiser la file du jour (clôture des tickets non servis)
export async function resetDailyQueue(orgId: string) {
  try {
    const ctx = await requireOwnOrg(orgId)
    if (!ctx) return DENIED

    const queueIds = await getOrgQueueIds(ctx.orgId)

    const res = await prisma.ticket.updateMany({
      where: {
        queueId: { in: queueIds },
        status: { in: ACTIVE_TICKET_STATUSES }
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    })

    await audit({ action: 'QUEUE_RESET', organizationId: ctx.orgId, details: `${res.count} tickets clôturés` })
    await notifyOrg(ctx.orgId)
    revalidatePath('/dashboard')
    revalidatePath('/agent')
    revalidatePath(`/tv/${ctx.orgId}`)

    return { success: true, count: res.count }
  } catch (error: any) {
    console.error('resetDailyQueue error:', error)
    return { success: false, error: error.message || 'Erreur lors de la réinitialisation' }
  }
}

// 7. Exporter l'historique des tickets en format structuré pour CSV
export async function exportTicketsHistory(orgId: string) {
  try {
    const ctx = await requireOwnOrg(orgId)
    if (!ctx) return DENIED

    const tickets = await prisma.ticket.findMany({
      where: { queue: { branch: { organizationId: ctx.orgId } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        service: { select: { name: true } },
        user: { select: { name: true, phone: true } }
      }
    })

    await audit({ action: 'DATA_EXPORTED', organizationId: ctx.orgId, details: `${tickets.length} tickets` })
    return {
      success: true,
      tickets: tickets.map(t => ({
        id: t.id,
        number: t.displayNum,
        service: t.service?.name || 'N/A',
        client: t.guestName || t.user?.name || 'Anonyme',
        phone: t.user?.phone || 'N/A',
        status: t.status,
        priority: priorityText(t.priorityScore, t.priorityReason) ?? 'Standard',
        nps: t.npsScore ? `${t.npsScore}/5` : 'Non noté',
        date: t.createdAt.toISOString()
      }))
    }
  } catch (error: any) {
    console.error('exportTicketsHistory error:', error)
    return { success: false, error: error.message || 'Erreur export' }
  }
}
