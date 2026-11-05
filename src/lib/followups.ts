import { prisma } from '@/lib/prisma'
import { claimOnce } from '@/lib/locks'
import { appUrl, sendToVisitor } from '@/lib/messaging'
import { hasFeature } from '@/lib/billing'
import { notify } from '@/lib/notifications'

// Suivis et relances (CRM, forfaits avec « Suivis et relances ») : rappel SMS du jour d'un suivi,
// SMS au visiteur absent à son rendez-vous pour reprogrammer, étiquette « Absences répétées ».
// Lancé avec les rappels de rendez-vous (toutes les 5 minutes au plus). Heures en UTC (heure d'Abidjan).

const DAY = 86400_000
const SEND_FROM_HOUR = 8 // pas de SMS avant 8 h
const REPEATED_NO_SHOWS_TAG = 'Absences répétées'

export const startOfDayUtc = (d = new Date()) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00Z`)

const bookingLink = (orgId: string) => `${appUrl()}/org/${orgId}`
const day = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** Établissements ayant la fonction, mémorisés pendant un passage. */
function featureCache() {
  const known = new Map<string, boolean>()
  return async (orgId: string) => {
    if (!known.has(orgId)) known.set(orgId, await hasFeature(orgId, 'CRM_FOLLOWUPS').catch(() => false))
    return known.get(orgId)!
  }
}

export async function runFollowUpJobs(now = new Date()) {
  const enabled = featureCache()
  let reminders = 0
  let noShowSms = 0

  // 1. Rappel SMS des suivis du jour (et des 3 derniers jours si le rappel n'est pas encore parti)
  if (now.getUTCHours() >= SEND_FROM_HOUR) {
    const today = startOfDayUtc(now)
    const due = await prisma.customerFollowUp.findMany({
      where: { status: 'OPEN', smsReminder: true, smsSentAt: null, dueDate: { lte: today, gte: new Date(today.getTime() - 3 * DAY) } },
      select: { id: true, title: true, organizationId: true, organization: { select: { name: true } }, customer: { select: { phone: true, name: true } } },
      take: 200
    })
    for (const f of due) {
      // Marqué d'abord : jamais deux SMS pour le même suivi, même si deux passages se croisent
      const claimed = await prisma.customerFollowUp.updateMany({ where: { id: f.id, smsSentAt: null }, data: { smsSentAt: now } })
      if (claimed.count === 0 || !f.customer.phone || !(await enabled(f.organizationId))) continue
      await sendToVisitor({
        to: f.customer.phone,
        text: `${f.organization.name} : ${f.customer.name ? `${f.customer.name.split(' ')[0]}, ` : ''}${f.title}. Réservez votre créneau : ${bookingLink(f.organizationId)}`,
        purpose: 'FOLLOW_UP',
        organizationId: f.organizationId
      })
      reminders++
    }
  }

  // 2. Absents aux rendez-vous des dernières 24 h : proposition de reprogrammer
  if (now.getUTCHours() >= SEND_FROM_HOUR) {
    const missed = await prisma.appointment.findMany({
      where: { status: 'NO_SHOW', noShowSmsAt: null, scheduledDate: { gte: new Date(now.getTime() - DAY) }, organization: { apptNoShowSms: true } },
      select: { id: true, scheduledDate: true, organizationId: true, guestPhone: true, user: { select: { phone: true } }, service: { select: { name: true } }, organization: { select: { name: true } } },
      take: 200
    })
    for (const a of missed) {
      const claimed = await prisma.appointment.updateMany({ where: { id: a.id, noShowSmsAt: null }, data: { noShowSmsAt: now } })
      const phone = a.guestPhone || a.user?.phone
      if (claimed.count === 0 || !phone || !(await enabled(a.organizationId))) continue
      await sendToVisitor({
        to: phone,
        text: `${a.organization.name} : vous n’avez pas pu venir à votre rendez-vous ${a.service?.name ?? ''} du ${day(a.scheduledDate)}. Reprenez un créneau : ${bookingLink(a.organizationId)}`,
        purpose: 'APPOINTMENT_MISSED',
        organizationId: a.organizationId
      })
      noShowSms++
    }
  }

  // 3. Équipe : avis non traités sous 48 h, et chaque matin les suivis du jour
  const overdue = await notifyOverdueComplaints(now)
  const followUpNotices = now.getUTCHours() >= SEND_FROM_HOUR ? await notifyDueFollowUps(now) : 0

  return { followUpReminders: reminders, noShowSms, overdueComplaints: overdue, followUpNotices }
}

async function notifyOverdueComplaints(now: Date) {
  const late = await prisma.complaint.findMany({
    where: { status: 'OPEN', overdueNotifiedAt: null, createdAt: { lt: new Date(now.getTime() - 2 * DAY) } },
    select: { id: true, organizationId: true, rating: true, ticket: { select: { service: { select: { name: true } } } } },
    take: 200
  })
  for (const c of late) {
    const claimed = await prisma.complaint.updateMany({ where: { id: c.id, overdueNotifiedAt: null }, data: { overdueNotifiedAt: now } })
    if (claimed.count === 0) continue
    await notify({
      event: 'COMPLAINT_OVERDUE', orgId: c.organizationId, url: `/dashboard/feedback?id=${c.id}`, groupKey: `complaint-late:${c.organizationId}`,
      title: 'Avis non traité depuis 48 h', groupTitle: n => `${n} avis non traités depuis 48 h`,
      body: `${c.rating}/5 · ${c.ticket.service.name} : le visiteur attend une réponse.`
    })
  }
  return late.length
}

async function notifyDueFollowUps(now: Date) {
  const today = startOfDayUtc(now)
  const key = today.toISOString().slice(0, 10)
  const groups = await prisma.customerFollowUp.groupBy({ by: ['organizationId'], where: { status: 'OPEN', dueDate: { lte: today } }, _count: { _all: true } })
  let sent = 0
  for (const g of groups) {
    // Une seule fois par jour et par établissement (la ligne de JobRun sert de verrou)
    const claimed = await claimOnce(`followup-notice:${g.organizationId}:${key}`, now)
    if (!claimed) continue
    const n = g._count._all
    await notify({ event: 'FOLLOWUP_DUE', orgId: g.organizationId, url: '/dashboard/followups', title: `${n} suivi${n > 1 ? 's' : ''} à faire aujourd’hui`, body: 'Appelez, puis cochez : ils passent dans « Faits ».' })
    sent++
  }
  return sent
}

/**
 * Étiquette « Absences répétées » posée sur les fiches qui atteignent le seuil de l'établissement
 * (seuil de blocage des réservations s'il est réglé, sinon 2 absences).
 */
export async function tagRepeatedNoShows(customerIds: string[]) {
  const ids = Array.from(new Set(customerIds.filter(Boolean)))
  if (ids.length === 0) return
  const customers = await prisma.customer.findMany({
    where: { id: { in: ids }, noShows: { gte: 2 } },
    select: { id: true, noShows: true, organizationId: true, organization: { select: { apptNoShowBlock: true } } }
  })
  for (const c of customers) {
    if (c.noShows < (c.organization.apptNoShowBlock > 0 ? c.organization.apptNoShowBlock : 2)) continue
    const tag = await prisma.customerTag.upsert({
      where: { organizationId_name: { organizationId: c.organizationId, name: REPEATED_NO_SHOWS_TAG } },
      update: {},
      create: { organizationId: c.organizationId, name: REPEATED_NO_SHOWS_TAG, color: '#b45309' },
      select: { id: true }
    })
    await prisma.customerTagLink.createMany({ data: [{ customerId: c.id, tagId: tag.id }], skipDuplicates: true })
  }
}
