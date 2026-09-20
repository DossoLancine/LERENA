'use server'

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { revalidatePath } from "next/cache"

// 1. Récupérer l'organisation du manager connecté
async function getManagerOrg() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'MANAGER') {
    return null
  }

  const userId = (session.user as any).id

  // Isolation multi-tenant stricte par adhésion du manager
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          branches: {
            include: {
              queues: true,
              services: true
            }
          }
        }
      }
    }
  })

  if (membership?.organization) {
    return membership.organization
  }

  // Fallback si manager principal de l'organisation
  return await prisma.organization.findFirst({
    include: {
      branches: {
        include: {
          queues: true,
          services: true
        }
      }
    }
  })
}

// 2. Créer un nouveau service pour l'organisation
export async function createOrganizationService(data: {
  name: string
  description?: string
  avgDurationMin?: number
  prefix?: string
}) {
  try {
    const org = await getManagerOrg()
    if (!org) return { success: false, error: "Non autorisé ou organisation introuvable" }

    if (!data.name || !data.name.trim()) {
      return { success: false, error: "Le nom du service est requis" }
    }

    // Récupérer la branche principale ou en créer une
    let branch = org.branches[0]
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          organizationId: org.id,
          name: "Site Principal"
        },
        include: { queues: true, services: true }
      })
    }

    const avgDuration = Number(data.avgDurationMin) > 0 ? Number(data.avgDurationMin) : 15
    const prefix = (data.prefix || data.name[0] || 'A').toUpperCase().trim()

    // Créer le service
    const service = await prisma.service.create({
      data: {
        branchId: branch.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        avgDurationMin: avgDuration,
        isActive: true
      }
    })

    // S'assurer qu'une file d'attente existe avec ce préfixe pour cette organisation
    const existingQueue = branch.queues.find(q => q.prefix.toUpperCase() === prefix)
    if (!existingQueue) {
      await prisma.queue.create({
        data: {
          branchId: branch.id,
          name: `File ${data.name.trim()}`,
          prefix: prefix,
          status: 'OPEN',
          currentNum: 0
        }
      })
    }

    revalidatePath('/dashboard')
    revalidatePath(`/org/${org.id}`)
    revalidatePath(`/tv/${org.id}`)
    revalidatePath('/agent')

    return { success: true, service }
  } catch (error: any) {
    console.error("Create service error:", error)
    return { success: false, error: error.message || "Erreur lors de la création du service" }
  }
}

// 3. Modifier un service existant
export async function updateOrganizationService(
  serviceId: string,
  data: {
    name?: string
    description?: string
    avgDurationMin?: number
    isActive?: boolean
  }
) {
  try {
    const org = await getManagerOrg()
    if (!org) return { success: false, error: "Non autorisé" }

    // Vérifier que le service appartient bien à cette organisation
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { branch: true }
    })

    if (!service || service.branch.organizationId !== org.id) {
      return { success: false, error: "Service introuvable dans votre organisation" }
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
        ...(data.avgDurationMin ? { avgDurationMin: Number(data.avgDurationMin) } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
      }
    })

    revalidatePath('/dashboard')
    revalidatePath(`/org/${org.id}`)
    return { success: true, service: updated }
  } catch (error: any) {
    console.error("Update service error:", error)
    return { success: false, error: error.message || "Erreur lors de la mise à jour" }
  }
}

// 4. Activer ou Désactiver un service (Toggle rapide)
export async function toggleServiceStatus(serviceId: string) {
  try {
    const org = await getManagerOrg()
    if (!org) return { success: false, error: "Non autorisé" }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: { branch: true }
    })

    if (!service || service.branch.organizationId !== org.id) {
      return { success: false, error: "Service introuvable" }
    }

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: { isActive: !service.isActive }
    })

    revalidatePath('/dashboard')
    revalidatePath(`/org/${org.id}`)
    return { success: true, isActive: updated.isActive }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 5. Supprimer un service (ou désactiver s'il contient des tickets historiques)
export async function deleteOrganizationService(serviceId: string) {
  try {
    const org = await getManagerOrg()
    if (!org) return { success: false, error: "Non autorisé" }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        branch: true,
        tickets: { select: { id: true } }
      }
    })

    if (!service || service.branch.organizationId !== org.id) {
      return { success: false, error: "Service introuvable" }
    }

    // Si des tickets existent, on désactive pour préserver l'historique comptable
    if (service.tickets.length > 0) {
      await prisma.service.update({
        where: { id: serviceId },
        data: { isActive: false }
      })
      revalidatePath('/dashboard')
      return { success: true, message: "Service désactivé pour conserver l'historique des tickets" }
    }

    // Sinon suppression définitive
    await prisma.service.delete({
      where: { id: serviceId }
    })

    revalidatePath('/dashboard')
    revalidatePath(`/org/${org.id}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
