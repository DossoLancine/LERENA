import { randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { hashSecret, newSecret } from '@/lib/secrets'
import { appUrl, sendEmail, sendSmsMessage } from '@/lib/messaging'
import { isSlotAvailable } from '@/lib/slots'
import { issueTicket } from '@/lib/ticketing'
import { notifyOrg } from '@/lib/realtime'
import { hasFeature } from '@/lib/billing'
import { attachAppointmentToCustomer, refreshCustomersOfAppointments } from '@/lib/customers'

// Rendez-vous : réservation, arrivée sur place (le RDV devient un ticket placé à son heure),
// rappels automatiques et absences. Utilisé par l'application, les invités, l'accueil et la borne.

// Erreur « métier » attendue (message affiché à la personne) : pas un incident à surveiller
export class AppointmentError extends Error { readonly expected = true }

const fmt = (d: Date) => d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

async function uniqueCode() {
  for (let i = 0; i < 10; i++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    if (!(await prisma.appointment.findUnique({ where: { code }, select: { id: true } }))) return code
  }
  throw new AppointmentError('Réessayez dans un instant')
}

export interface BookingInput {
  orgId: string
  serviceId: string
  scheduledDate: Date
  source: 'APP' | 'GUEST' | 'RECEPTION'
  userId?: string | null
  guestName?: string | null
  guestPhone?: string | null
  email?: string | null
}

/** Réserve un créneau en respectant toutes les règles ; renvoie le code d'arrivée et le lien de gestion. */
export async function bookAppointment(input: BookingInput) {
  const date = new Date(input.scheduledDate)
  if (Number.isNaN(date.getTime())) throw new AppointmentError('Créneau invalide')

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, isActive: true, branch: { organizationId: input.orgId, isActive: true } },
    select: {
      id: true, name: true, branchId: true,
      branch: { select: { name: true, address: true, organization: { select: { name: true, bookingMode: true, apptMaxActive: true, apptNoShowBlock: true } } } }
    }
  })
  if (!service) throw new AppointmentError('Service introuvable')
  const org = service.branch.organization
  if (org.bookingMode === 'QUEUE_ONLY' && input.source !== 'RECEPTION') throw new AppointmentError('Cet établissement ne prend pas de rendez-vous')
  if (!(await hasFeature(input.orgId, 'APPOINTMENTS'))) throw new AppointmentError('La prise de rendez-vous n’est pas incluse dans le forfait de cet établissement')

  // Qui réserve : un compte, ou un numéro de téléphone (invité, réservation par l'accueil)
  const who = input.userId ? { userId: input.userId } : input.guestPhone ? { guestPhone: input.guestPhone } : null
  if (!who) throw new AppointmentError('Identifiez la personne (compte ou téléphone)')

  if (input.source !== 'RECEPTION') {
    const [active, noShows] = await Promise.all([
      prisma.appointment.count({ where: { ...who, organizationId: input.orgId, status: 'CONFIRMED', scheduledDate: { gte: new Date() } } }),
      org.apptNoShowBlock > 0 ? prisma.appointment.count({ where: { ...who, organizationId: input.orgId, status: 'NO_SHOW' } }) : 0
    ])
    if (active >= Math.max(1, org.apptMaxActive)) throw new AppointmentError(`Vous avez déjà ${active} rendez-vous à venir dans cet établissement.`)
    if (org.apptNoShowBlock > 0 && noShows >= org.apptNoShowBlock) throw new AppointmentError('Après plusieurs absences, la réservation en ligne n’est plus possible : contactez l’établissement.')
  }

  if (!(await isSlotAvailable(input.orgId, service.id, date))) {
    throw new AppointmentError('Ce créneau vient d’être pris ou n’est plus disponible. Choisissez-en un autre.')
  }

  const code = await uniqueCode()
  const token = newSecret()
  const appointment = await prisma.appointment.create({
    data: {
      organizationId: input.orgId, branchId: service.branchId, serviceId: service.id,
      userId: input.userId ?? null, guestName: input.guestName ?? null, guestPhone: input.guestPhone ?? null,
      scheduledDate: date, status: 'CONFIRMED', source: input.source, code, manageTokenHash: hashSecret(token)
    }
  })

  await attachAppointmentToCustomer(appointment.id, { orgId: input.orgId, userId: input.userId, phone: input.guestPhone, name: input.guestName })

  const manageUrl = `${appUrl()}/rdv/${token}`
  const text = `Lerena : RDV ${service.name} chez ${org.name}${service.branch.name ? ` (${service.branch.name})` : ''}, ${fmt(date)}. Code d'arrivée : ${code}. Gérer : ${manageUrl}`
  const phone = input.guestPhone ?? (input.userId ? (await prisma.user.findUnique({ where: { id: input.userId }, select: { phone: true } }))?.phone : null)
  if (phone) await sendSmsMessage({ to: phone, text, purpose: 'APPOINTMENT_CONFIRMED', organizationId: input.orgId })
  if (input.email) await sendEmail({ to: input.email, subject: `Rendez-vous confirmé — ${org.name}`, text, purpose: 'APPOINTMENT_CONFIRMED', organizationId: input.orgId })

  // L'établissement est prévenu des réservations faites par les visiteurs (pas de celles saisies par l'accueil)
  if (input.source !== 'RECEPTION') {
    const visitor = input.guestName ?? (input.userId ? (await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } }))?.name : null) ?? 'Un visiteur'
    await alertTeamOfBooking({ orgId: input.orgId, orgName: org.name, siteName: service.branch.name, serviceName: service.name, date, visitor, phone, code }).catch(() => null)
  }

  await notifyOrg(input.orgId)
  return { id: appointment.id, code, manageUrl, token, scheduledDate: date.toISOString() }
}

/** E-mail aux responsables et à l'accueil (et à l'adresse de l'établissement) pour chaque nouveau rendez-vous. */
async function alertTeamOfBooking(b: { orgId: string; orgName: string; siteName: string | null; serviceName: string; date: Date; visitor: string; phone: string | null | undefined; code: string }) {
  const org = await prisma.organization.findUnique({
    where: { id: b.orgId },
    select: { email: true, members: { where: { role: { in: ['MANAGER', 'RECEPTION'] } }, select: { user: { select: { email: true } } } } }
  })
  const recipients = Array.from(new Set([org?.email, ...(org?.members ?? []).map(m => m.user.email)].filter((e): e is string => !!e)))
  const text = `Nouveau rendez-vous chez ${b.orgName}${b.siteName ? ` (${b.siteName})` : ''}\n\n${b.visitor}${b.phone ? ` · ${b.phone}` : ''}\n${b.serviceName} — ${fmt(b.date)}\nCode d'arrivée : ${b.code}\n\nVoir l'agenda : ${appUrl()}/dashboard/agenda`
  for (const to of recipients) {
    await sendEmail({ to, purpose: 'APPOINTMENT_NEW', organizationId: b.orgId, subject: `Nouveau rendez-vous : ${b.serviceName}, ${fmt(b.date)}`, text })
  }
}

/** Arrivée sur place : le rendez-vous devient un ticket, placé selon son heure. */
export async function checkIn(appointmentId: string, orgId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, organizationId: orgId },
    include: { user: { select: { name: true, phone: true } } }
  })
  if (!appt) throw new AppointmentError('Rendez-vous introuvable')
  if (appt.status !== 'CONFIRMED') throw new AppointmentError('Ce rendez-vous n’est plus valable')
  if (appt.ticketId) {
    const existing = await prisma.ticket.findUnique({ where: { id: appt.ticketId }, select: { id: true, displayNum: true } })
    if (existing) return { ticketId: existing.id, displayNum: existing.displayNum, already: true }
  }
  const sameDay = appt.scheduledDate.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
  if (!sameDay) throw new AppointmentError('Ce rendez-vous n’est pas aujourd’hui')
  if (!appt.serviceId) throw new AppointmentError('Service du rendez-vous introuvable')

  const ticket = await issueTicket({
    orgId, serviceId: appt.serviceId, channel: 'staff', appointment: { scheduledDate: appt.scheduledDate },
    owner: { userId: appt.userId, name: appt.guestName || appt.user?.name || 'Rendez-vous', phone: appt.guestPhone || appt.user?.phone || null }
  })
  await prisma.appointment.update({ where: { id: appt.id }, data: { checkedInAt: new Date(), ticketId: ticket.id } })
  return { ticketId: ticket.id, displayNum: ticket.displayNum, already: false }
}

// ---- Tâches automatiques : rappels, absences et clôture des tickets de la veille ----

const JOB_ID = 'appointments'
const JOB_EVERY_MS = 5 * 60_000

/**
 * Rappels (la veille, 2 h avant), absences et tickets oubliés des jours précédents. Lancé au plus toutes les 5 minutes, par n'importe quelle activité
 * (écran TV, tableau de bord) et par la tâche planifiée quotidienne : pas besoin d'un service externe.
 */
export async function runAppointmentJobs(force = false) {
  const now = new Date()
  if (!force) {
    const claimed = await prisma.jobRun.updateMany({ where: { id: JOB_ID, lastRunAt: { lt: new Date(now.getTime() - JOB_EVERY_MS) } }, data: { lastRunAt: now } })
    if (claimed.count === 0) {
      const exists = await prisma.jobRun.findUnique({ where: { id: JOB_ID } })
      if (exists) return { skipped: true }
      await prisma.jobRun.create({ data: { id: JOB_ID, lastRunAt: now } }).catch(() => null)
    }
  }

  const upcoming = (fromMin: number, toMin: number) => ({ gte: new Date(now.getTime() + fromMin * 60_000), lt: new Date(now.getTime() + toMin * 60_000) })
  const include = { service: { select: { name: true } }, organization: { select: { name: true } }, user: { select: { phone: true } } } as const
  const [dayBefore, twoHours] = await Promise.all([
    prisma.appointment.findMany({ where: { status: 'CONFIRMED', reminderDayAt: null, scheduledDate: upcoming(20 * 60, 28 * 60) }, include, take: 200 }),
    prisma.appointment.findMany({ where: { status: 'CONFIRMED', reminderHourAt: null, checkedInAt: null, scheduledDate: upcoming(60, 150) }, include, take: 200 })
  ])
  for (const [list, field, label] of [[dayBefore, 'reminderDayAt', 'demain'], [twoHours, 'reminderHourAt', 'bientôt']] as const) {
    for (const a of list) {
      const phone = a.guestPhone || a.user?.phone
      if (phone) {
        await sendSmsMessage({
          to: phone,
          text: `Lerena : rappel, RDV ${a.service?.name ?? ''} chez ${a.organization.name} ${label === 'demain' ? 'demain' : 'à'} ${a.scheduledDate.toISOString().slice(11, 16)}. Code d'arrivée : ${a.code ?? ''}.`,
          purpose: 'APPOINTMENT_REMINDER',
          organizationId: a.organizationId
        })
      }
      await prisma.appointment.update({ where: { id: a.id }, data: { [field]: now } })
    }
  }

  // Absences : rendez-vous non honorés après le délai de grâce de l'établissement
  const late = await prisma.appointment.findMany({
    where: { status: 'CONFIRMED', checkedInAt: null, scheduledDate: { lt: new Date(now.getTime() - 15 * 60_000) } },
    select: { id: true, scheduledDate: true, organization: { select: { apptNoShowGraceMin: true } } },
    take: 500
  })
  const noShow = late.filter(a => a.scheduledDate.getTime() + a.organization.apptNoShowGraceMin * 60_000 < now.getTime()).map(a => a.id)
  if (noShow.length) {
    await prisma.appointment.updateMany({ where: { id: { in: noShow } }, data: { status: 'NO_SHOW' } })
    await refreshCustomersOfAppointments(noShow)
  }

  // Fin de journée : les tickets restés ouverts des jours précédents (plus de 6 h) sont clôturés
  const startOfDay = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const before = new Date(Math.min(startOfDay.getTime(), now.getTime() - 6 * 3600_000))
  const [served, dropped] = await Promise.all([
    prisma.ticket.updateMany({ where: { status: 'SERVING', createdAt: { lt: before } }, data: { status: 'COMPLETED', completedAt: now } }),
    prisma.ticket.updateMany({ where: { status: { in: ['WAITING', 'CALLED', 'ON_HOLD'] }, createdAt: { lt: before } }, data: { status: 'CANCELLED', completedAt: now } })
  ])

  return { skipped: false, remindersDay: dayBefore.length, remindersHour: twoHours.length, noShows: noShow.length, closedTickets: served.count + dropped.count }
}
