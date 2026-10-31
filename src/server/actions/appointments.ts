'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getManagerContext, getSessionUser } from '@/lib/session'
import { APPOINTMENT_STATUSES } from '@/lib/constants'
import { bookableDays, isSlotAvailable, slotsForDay } from '@/lib/slots'

export async function createAppointment(orgId: string, serviceId: string, scheduledDate: Date) {
  const user = await getSessionUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const date = new Date(scheduledDate)
  if (Number.isNaN(date.getTime()) || date.getTime() < Date.now()) {
    return { success: false, error: 'Créneau invalide' }
  }

  // Le service doit appartenir à l'établissement, qui doit accepter les rendez-vous
  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true, branch: { organizationId: orgId } },
    select: { id: true, branchId: true, branch: { select: { organization: { select: { bookingMode: true } } } } }
  })
  if (!service) return { success: false, error: 'Service introuvable' }
  if (service.branch.organization.bookingMode === 'QUEUE_ONLY') {
    return { success: false, error: "Cet établissement ne prend pas de rendez-vous" }
  }

  // Le créneau doit exister dans les horaires et être encore libre (pas de double réservation)
  if (!(await isSlotAvailable(orgId, serviceId, date))) {
    return { success: false, error: 'Ce créneau vient d’être pris ou n’est plus disponible. Choisissez-en un autre.' }
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        organizationId: orgId,
        serviceId: service.id,
        branchId: service.branchId,
        userId: user.id,
        scheduledDate: date,
        status: 'CONFIRMED'
      }
    })

    revalidatePath(`/dashboard`)
    revalidatePath(`/org/${orgId}`)

    return { success: true, appointment }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to create appointment' }
  }
}

// orgId est conservé pour compatibilité ; seuls les rendez-vous du manager connecté sont lus
export async function getAppointments(_orgId?: string) {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return { success: false, error: 'Unauthorized' }

    const appointments = await prisma.appointment.findMany({
      where: { organizationId: ctx.orgId },
      include: {
        user: { select: { name: true, phone: true } },
        service: { select: { name: true } }
      },
      orderBy: { scheduledDate: 'asc' }
    })
    return { success: true, appointments }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to fetch appointments' }
  }
}

export async function updateAppointmentStatus(id: string, status: string) {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return { success: false, error: 'Unauthorized' }
    if (!(APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
      return { success: false, error: 'Statut invalide' }
    }

    const res = await prisma.appointment.updateMany({
      where: { id, organizationId: ctx.orgId },
      data: { status }
    })
    if (res.count === 0) return { success: false, error: 'Rendez-vous introuvable' }

    revalidatePath(`/dashboard`)
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to update status' }
  }
}

/** Jours réservables pour un service (deux prochaines semaines). */
export async function getBookingDays(orgId: string, serviceId: string) {
  return bookableDays(orgId, serviceId)
}

/** Créneaux d'une journée pour un service, libres ou pris. */
export async function getAvailableSlots(orgId: string, serviceId: string, day: string) {
  return slotsForDay(orgId, serviceId, day)
}
