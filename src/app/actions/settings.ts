'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

// 1. Récupérer tous les paramètres de l'organisation
export async function getOrganizationSettings() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const org = await prisma.organization.findFirst({
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
  category: string
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
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        name: data.name,
        category: data.category,
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

    revalidatePath('/dashboard')
    revalidatePath(`/org/${orgId}`)
    revalidatePath(`/tv/${orgId}`)
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
  role?: 'AGENT' | 'MANAGER'
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const email = data.email.trim().toLowerCase()
    const role = data.role || 'AGENT'
    const defaultPassword = data.password && data.password.trim() ? data.password : 'password123'
    const hashedPassword = await bcrypt.hash(defaultPassword, 10)

    // Vérifier si l'utilisateur existe déjà
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: data.name,
          phone: data.phone || null,
          password: hashedPassword,
          role: role
        }
      })
    } else {
      // Mettre à jour le rôle si nécessaire
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: role,
          ...(data.name ? { name: data.name } : {}),
          ...(data.phone ? { phone: data.phone } : {})
        }
      })
    }

    // Lier à l'organisation
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId
        }
      },
      update: { role },
      create: {
        userId: user.id,
        organizationId: orgId,
        role
      }
    })

    revalidatePath('/dashboard')
    return { success: true, user }
  } catch (error: any) {
    console.error('addMemberToOrganization error:', error)
    return { success: false, error: error.message || 'Erreur lors de l’ajout du collaborateur' }
  }
}

// 4. Retirer un agent / membre de l'organisation
export async function removeMemberFromOrganization(memberId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    await prisma.organizationMember.delete({
      where: { id: memberId }
    })

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
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const updated = await prisma.queue.update({
      where: { id: queueId },
      data
    })

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
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: {
          include: { queues: true }
        }
      }
    })

    if (!org) return { success: false, error: 'Organisation introuvable' }

    const queueIds = org.branches.flatMap(b => b.queues.map(q => q.id))

    // Marquer tous les tickets en attente ou appelés comme annulés ou terminés
    const res = await prisma.ticket.updateMany({
      where: {
        queueId: { in: queueIds },
        status: { in: ['WAITING', 'CALLED', 'SERVING'] }
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    })

    revalidatePath('/dashboard')
    revalidatePath('/agent')
    revalidatePath(`/tv/${orgId}`)

    return { success: true, count: res.count }
  } catch (error: any) {
    console.error('resetDailyQueue error:', error)
    return { success: false, error: error.message || 'Erreur lors de la réinitialisation' }
  }
}

// 7. Exporter l'historique des tickets en format structuré pour CSV
export async function exportTicketsHistory(orgId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user as any)?.role !== 'MANAGER') {
      return { success: false, error: 'Accès non autorisé' }
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: {
          include: {
            queues: {
              include: {
                tickets: {
                  include: {
                    service: true,
                    user: true
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 500
                }
              }
            }
          }
        }
      }
    })

    if (!org) return { success: false, error: 'Organisation introuvable' }

    const tickets = org.branches.flatMap(b =>
      b.queues.flatMap(q =>
        q.tickets.map(t => ({
          id: t.id,
          number: t.displayNum,
          service: t.service?.name || 'N/A',
          client: t.guestName || t.user?.name || 'Anonyme',
          phone: t.guestPhone || t.user?.phone || 'N/A',
          status: t.status,
          priority: t.priorityScore === 3 ? 'VIP' : t.priorityScore === 2 ? 'PMR/Prioritaire' : 'Standard',
          nps: t.npsScore ? `${t.npsScore}/5` : 'Non noté',
          date: t.createdAt.toISOString()
        }))
      )
    )

    return { success: true, tickets }
  } catch (error: any) {
    console.error('exportTicketsHistory error:', error)
    return { success: false, error: error.message || 'Erreur export' }
  }
}
