'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

// Données personnelles de l'usager connecté : résumé, rendez-vous, suppression du compte

/** Chiffres réels du profil : tickets pris, favoris, temps d'attente passé hors de l'établissement. */
export async function getMySummary() {
  const user = await getSessionUser()
  if (!user) return null

  const [tickets, favorites, served] = await Promise.all([
    prisma.ticket.count({ where: { userId: user.id } }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.ticket.findMany({
      where: { userId: user.id, calledAt: { not: null } },
      select: { createdAt: true, calledAt: true }
    })
  ])

  // Attente entre la prise du ticket et l'appel : du temps que l'usager n'a pas passé sur place
  const waitedMinutes = served.reduce((acc, t) => acc + Math.max(0, (t.calledAt!.getTime() - t.createdAt.getTime()) / 60000), 0)
  return { tickets, favorites, savedHours: Math.round((waitedMinutes / 60) * 10) / 10 }
}

/** Rendez-vous à venir de l'usager. */
export async function getMyAppointments() {
  const user = await getSessionUser()
  if (!user) return []
  return prisma.appointment.findMany({
    where: { userId: user.id, status: 'CONFIRMED', scheduledDate: { gte: new Date(Date.now() - 3600_000) } },
    orderBy: { scheduledDate: 'asc' },
    select: {
      id: true, scheduledDate: true, status: true,
      organization: { select: { id: true, name: true, address: true } },
      service: { select: { name: true } }
    }
  })
}

export async function cancelMyAppointment(id: string) {
  const user = await getSessionUser()
  if (!user) return { success: false }
  const res = await prisma.appointment.updateMany({
    where: { id, userId: user.id, status: 'CONFIRMED' },
    data: { status: 'CANCELLED' }
  })
  revalidatePath('/tickets')
  revalidatePath('/dashboard')
  return { success: res.count > 0 }
}

/**
 * Suppression du compte (droit à l'effacement, loi ivoirienne 2013-450).
 * Les tickets passés sont anonymisés pour garder des statistiques justes aux établissements.
 */
export async function deleteMyAccount() {
  const user = await getSessionUser()
  if (!user) return { success: false, error: 'Non connecté' }
  if (user.role !== 'CLIENT') {
    return { success: false, error: "Un compte professionnel se supprime par l'administrateur de l'établissement." }
  }

  await prisma.$transaction([
    prisma.ticket.updateMany({ where: { userId: user.id }, data: { userId: null, guestName: 'Compte supprimé', guestPhone: null } }),
    prisma.appointment.updateMany({ where: { userId: user.id }, data: { userId: null, guestName: null, guestPhone: null } }),
    prisma.pushSubscription.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } })
  ])
  return { success: true }
}
