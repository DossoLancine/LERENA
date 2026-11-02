'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { deleteUserData, PersonalDataError } from '@/lib/personal-data'
import { audit } from '@/lib/audit'

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
      id: true, scheduledDate: true, status: true, code: true,
      organization: { select: { id: true, name: true, address: true } },
      service: { select: { name: true } }
    }
  })
}

export async function cancelMyAppointment(id: string) {
  const user = await getSessionUser()
  if (!user) return { success: false }
  // Annulation en ligne jusqu'au délai fixé par l'établissement
  const appt = await prisma.appointment.findFirst({ where: { id, userId: user.id, status: 'CONFIRMED' }, select: { scheduledDate: true, organization: { select: { apptCancelHours: true } } } })
  if (!appt) return { success: false }
  if (appt.scheduledDate.getTime() - Date.now() < appt.organization.apptCancelHours * 3600_000) {
    return { success: false, error: `Annulation en ligne possible jusqu’à ${appt.organization.apptCancelHours} h avant : contactez l’établissement.` }
  }
  const res = await prisma.appointment.updateMany({
    where: { id, userId: user.id, status: 'CONFIRMED' },
    data: { status: 'CANCELLED', cancelledAt: new Date() }
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
  try {
    await audit({ action: 'ACCOUNT_DELETED', targetType: 'User', targetId: user.id, details: 'à la demande de la personne' })
    await deleteUserData(user.id)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof PersonalDataError ? e.message : 'Suppression impossible' }
  }
}
