'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getReceptionContext } from '@/lib/session'
import { normalizePhone } from '@/lib/phone'
import { audit } from '@/lib/audit'
import { backfillCustomers, findOrCreateCustomer } from '@/lib/customers'
import { TAG_COLORS } from '@/lib/customer-labels'
import { hasFeature } from '@/lib/billing'
import { startOfDayUtc } from '@/lib/followups'
import { AppointmentError, bookAppointment } from '@/lib/appointments'
import { sendSmsMessage } from '@/lib/messaging'
import { randomUUID } from 'crypto'

// CRM des visiteurs : responsable et accueil. Chaque établissement ne voit que ses propres fiches.

export type CustomerSegment = 'all' | 'new' | 'regular' | 'lapsed' | 'noshow' | 'unhappy'
export type CustomerSort = 'recent' | 'visits' | 'noshows' | 'name'

const DAY = 86400_000
const PAGE_SIZE = 40

function segmentWhere(segment: CustomerSegment): Prisma.CustomerWhereInput {
  const now = Date.now()
  switch (segment) {
    case 'new': return { firstSeenAt: { gte: new Date(now - 30 * DAY) } }
    case 'regular': return { visits: { gte: 3 } }
    case 'lapsed': return { visits: { gte: 1 }, lastSeenAt: { lt: new Date(now - 90 * DAY) } }
    case 'noshow': return { noShows: { gte: 2 } }
    case 'unhappy': return { lastRating: { lte: 2 } }
    default: return {}
  }
}

const SEGMENTS: CustomerSegment[] = ['all', 'new', 'regular', 'lapsed', 'noshow', 'unhappy']

const tagSelect = { tag: { select: { id: true, name: true, color: true } } } as const

/** Liste des visiteurs : recherche, segments prêts à l'emploi, étiquettes, tri. Rattrape l'historique au passage. */
export async function listCustomers(input: { segment?: CustomerSegment; tagId?: string | null; q?: string; sort?: CustomerSort; page?: number }) {
  const ctx = await getReceptionContext()
  if (!ctx) return null
  await backfillCustomers(ctx.orgId).catch(error => console.error('CRM backfill error:', error))

  const segment = SEGMENTS.includes(input.segment as CustomerSegment) ? input.segment! : 'all'
  const q = input.q?.trim().slice(0, 60) ?? ''
  const digits = q.replace(/\D/g, '')
  const search: Prisma.CustomerWhereInput = q
    ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, ...(digits.length >= 3 ? [{ phone: { contains: digits.replace(/^0+/, '') } }] : [])] }
    : {}
  const base: Prisma.CustomerWhereInput = { organizationId: ctx.orgId }
  const where: Prisma.CustomerWhereInput = { ...base, ...segmentWhere(segment), ...search, ...(input.tagId ? { tags: { some: { tagId: input.tagId } } } : {}) }
  const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
    input.sort === 'visits' ? [{ visits: 'desc' }, { lastSeenAt: 'desc' }]
    : input.sort === 'noshows' ? [{ noShows: 'desc' }, { lastSeenAt: 'desc' }]
    : input.sort === 'name' ? [{ name: { sort: 'asc', nulls: 'last' } }]
    : [{ lastVisitAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }]
  const page = Math.max(0, Math.floor(input.page ?? 0))

  const [items, total, counts, tags] = await Promise.all([
    prisma.customer.findMany({
      where, orderBy, skip: page * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, name: true, phone: true, visits: true, noShows: true, lastRating: true, lastVisitAt: true, firstSeenAt: true, userId: true, tags: { select: tagSelect } }
    }),
    prisma.customer.count({ where }),
    Promise.all(SEGMENTS.map(s => prisma.customer.count({ where: { ...base, ...segmentWhere(s) } }))),
    prisma.customerTag.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, color: true, _count: { select: { links: true } } } })
  ])

  return {
    role: ctx.role,
    items: items.map(c => ({ ...c, hasAccount: !!c.userId, userId: undefined, tags: c.tags.map(l => l.tag) })),
    total,
    more: (page + 1) * PAGE_SIZE < total,
    counts: Object.fromEntries(SEGMENTS.map((s, i) => [s, counts[i]])) as Record<CustomerSegment, number>,
    tags: tags.map(t => ({ id: t.id, name: t.name, color: t.color, count: t._count.links }))
  }
}

/** Fiche complète : chiffres, historique des tickets et rendez-vous, notes, étiquettes. Chaque consultation est tracée. */
export async function getCustomer(id: string) {
  const ctx = await getReceptionContext()
  if (!ctx) return null
  const c = await prisma.customer.findFirst({
    where: { id, organizationId: ctx.orgId },
    select: {
      id: true, name: true, phone: true, userId: true, visits: true, noShows: true, ratingAvg: true, lastRating: true,
      firstSeenAt: true, lastVisitAt: true, consentAt: true, consentChannel: true, createdAt: true,
      tags: { select: tagSelect, orderBy: { createdAt: 'asc' } },
      notes: { orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, text: true, authorId: true, authorName: true, createdAt: true } },
      tickets: {
        orderBy: { createdAt: 'desc' }, take: 100,
        select: {
          id: true, displayNum: true, status: true, createdAt: true, queuedAt: true, calledAt: true, startedAt: true, completedAt: true,
          counterName: true, priorityReason: true, npsScore: true, notes: true,
          service: { select: { name: true } }, queue: { select: { branch: { select: { name: true } } } }
        }
      },
      appointments: {
        orderBy: { scheduledDate: 'desc' }, take: 100,
        select: { id: true, scheduledDate: true, status: true, source: true, ticketId: true, service: { select: { name: true } }, branch: { select: { name: true } } }
      }
    }
  })
  if (!c) return null
  const [orgTags, sites] = await Promise.all([
    prisma.customerTag.findMany({ where: { organizationId: ctx.orgId }, orderBy: { name: 'asc' }, select: { id: true, name: true, color: true } }),
    prisma.branch.count({ where: { organizationId: ctx.orgId, isActive: true } })
  ])
  await audit({ action: 'CUSTOMER_VIEWED', targetType: 'Customer', targetId: c.id, organizationId: ctx.orgId })

  const now = Date.now()
  const multiSite = sites > 1
  const timeline = [
    ...c.tickets.map(t => ({
      kind: 'ticket' as const, id: t.id, at: t.createdAt, status: t.status, label: t.displayNum, service: t.service.name,
      site: multiSite ? t.queue.branch.name : null, counter: t.counterName, priority: t.priorityReason, rating: t.npsScore, note: t.notes,
      waitMin: t.calledAt ? Math.max(0, Math.round((t.calledAt.getTime() - t.queuedAt.getTime()) / 60000)) : null,
      // Au-delà de 4 h, le ticket a été clôturé par la tâche de fin de journée : durée non significative
      serviceMin: t.startedAt && t.completedAt && t.completedAt.getTime() - t.startedAt.getTime() <= 4 * 3600_000 ? Math.max(1, Math.round((t.completedAt.getTime() - t.startedAt.getTime()) / 60000)) : null
    })),
    // Un rendez-vous honoré apparaît par son ticket : seuls les autres sont listés
    ...c.appointments.filter(a => !a.ticketId).map(a => ({
      kind: 'appointment' as const, id: a.id, at: a.scheduledDate, status: a.status, label: 'Rendez-vous', service: a.service?.name ?? '',
      site: multiSite ? a.branch.name : null, source: a.source, upcoming: a.scheduledDate.getTime() > now && a.status === 'CONFIRMED'
    }))
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  return {
    role: ctx.role,
    me: ctx.userId,
    orgId: ctx.orgId,
    customer: {
      id: c.id, name: c.name, phone: c.phone, hasAccount: !!c.userId, visits: c.visits, noShows: c.noShows,
      ratingAvg: c.ratingAvg, lastRating: c.lastRating, firstSeenAt: c.firstSeenAt, lastVisitAt: c.lastVisitAt,
      consentAt: c.consentAt, consentChannel: c.consentChannel,
      upcoming: c.appointments.filter(a => a.status === 'CONFIRMED' && a.scheduledDate.getTime() > now).length,
      tags: c.tags.map(l => l.tag)
    },
    notes: c.notes.map(n => ({ ...n, mine: n.authorId === ctx.userId })),
    timeline,
    orgTags
  }
}

type Result = { success: true } | { success: false; error: string }
const denied = { success: false as const, error: 'Non autorisé' }

async function ownCustomer(id: string) {
  const ctx = await getReceptionContext()
  if (!ctx) return null
  const c = await prisma.customer.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true } })
  return c ? ctx : null
}

/** Nouvelle fiche saisie à l'accueil (visiteur au téléphone, liste papier). Renvoie la fiche existante si le numéro est connu. */
export async function createCustomer(input: { name: string; phone: string }) {
  const ctx = await getReceptionContext()
  if (!ctx) return denied
  const phone = normalizePhone(input.phone)
  if (!phone) return { success: false as const, error: 'Numéro de téléphone invalide' }
  const id = await findOrCreateCustomer({ orgId: ctx.orgId, phone, name: input.name })
  if (!id) return { success: false as const, error: 'Fiche impossible à créer' }
  await audit({ action: 'CUSTOMER_CREATED', targetType: 'Customer', targetId: id, organizationId: ctx.orgId })
  return { success: true as const, id }
}

export async function renameCustomer(id: string, name: string): Promise<Result> {
  const ctx = await ownCustomer(id)
  if (!ctx) return denied
  const clean = name.trim().slice(0, 60)
  if (!clean) return { success: false, error: 'Indiquez un nom' }
  await prisma.customer.update({ where: { id }, data: { name: clean } })
  return { success: true }
}

/** Accord du visiteur pour recevoir des messages d'information (campagnes), recueilli à l'accueil. */
export async function setCustomerConsent(id: string, consent: boolean): Promise<Result> {
  const ctx = await ownCustomer(id)
  if (!ctx) return denied
  await prisma.customer.update({ where: { id }, data: consent ? { consentAt: new Date(), consentChannel: 'RECEPTION' } : { consentAt: null, consentChannel: null } })
  await audit({ action: consent ? 'CUSTOMER_CONSENT_GIVEN' : 'CUSTOMER_CONSENT_WITHDRAWN', targetType: 'Customer', targetId: id, organizationId: ctx.orgId })
  return { success: true }
}

export async function addCustomerNote(id: string, text: string): Promise<Result> {
  const ctx = await ownCustomer(id)
  if (!ctx) return denied
  const clean = text.trim().slice(0, 1000)
  if (!clean) return { success: false, error: 'La note est vide' }
  const author = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } })
  await prisma.customerNote.create({ data: { customerId: id, authorId: ctx.userId, authorName: author?.name ?? 'Équipe', text: clean } })
  return { success: true }
}

/** Une note se supprime par son auteur, ou par le responsable. */
export async function deleteCustomerNote(noteId: string): Promise<Result> {
  const ctx = await getReceptionContext()
  if (!ctx) return denied
  const note = await prisma.customerNote.findFirst({ where: { id: noteId, customer: { organizationId: ctx.orgId } }, select: { id: true, authorId: true } })
  if (!note) return { success: false, error: 'Note introuvable' }
  if (note.authorId !== ctx.userId && ctx.role !== 'MANAGER') return { success: false, error: 'Seul l’auteur ou le responsable peut supprimer cette note' }
  await prisma.customerNote.delete({ where: { id: note.id } })
  return { success: true }
}

export async function setCustomerTags(id: string, tagIds: string[]): Promise<Result> {
  const ctx = await ownCustomer(id)
  if (!ctx) return denied
  const valid = await prisma.customerTag.findMany({ where: { id: { in: tagIds.slice(0, 20) }, organizationId: ctx.orgId }, select: { id: true } })
  await prisma.$transaction([
    prisma.customerTagLink.deleteMany({ where: { customerId: id, tagId: { notIn: valid.map(t => t.id) } } }),
    prisma.customerTagLink.createMany({ data: valid.map(t => ({ customerId: id, tagId: t.id })), skipDuplicates: true })
  ])
  return { success: true }
}

export async function createCustomerTag(name: string, color: string) {
  const ctx = await getReceptionContext()
  if (!ctx) return denied
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 30)
  if (!clean) return { success: false as const, error: 'Indiquez un nom d’étiquette' }
  const hex = (TAG_COLORS as readonly string[]).includes(color) ? color : TAG_COLORS[0]
  if ((await prisma.customerTag.count({ where: { organizationId: ctx.orgId } })) >= 60) return { success: false as const, error: '60 étiquettes au maximum' }
  try {
    const tag = await prisma.customerTag.create({ data: { organizationId: ctx.orgId, name: clean, color: hex }, select: { id: true, name: true, color: true } })
    return { success: true as const, tag }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { success: false as const, error: 'Cette étiquette existe déjà' }
    throw error
  }
}

/** Supprimer une étiquette la retire de toutes les fiches : réservé au responsable. */
export async function deleteCustomerTag(tagId: string): Promise<Result> {
  const ctx = await getReceptionContext()
  if (!ctx || ctx.role !== 'MANAGER') return denied
  const res = await prisma.customerTag.deleteMany({ where: { id: tagId, organizationId: ctx.orgId } })
  return res.count ? { success: true } : { success: false, error: 'Étiquette introuvable' }
}

// ---- Suivis datés (forfaits avec « Suivis et relances ») ----

const followUpsEnabled = (orgId: string) => hasFeature(orgId, 'CRM_FOLLOWUPS').catch(() => false)
const upgradeMessage = 'Les suivis et relances sont inclus à partir du forfait Pro (Abonnement).'

/** Membres de l'équipe à qui confier un suivi. */
async function teamOf(orgId: string) {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId, role: { in: ['MANAGER', 'RECEPTION', 'AGENT'] } },
    select: { user: { select: { id: true, name: true } } }
  })
  return members.map(m => ({ id: m.user.id, name: m.user.name ?? 'Membre de l’équipe' })).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

const followUpSelect = {
  id: true, dueDate: true, title: true, assignedToId: true, assignedToName: true, smsReminder: true, smsSentAt: true,
  status: true, doneAt: true, doneByName: true, createdByName: true, createdAt: true
} as const

/** Suivis d'une fiche et équipe (pour la fiche visiteur). */
export async function getCustomerFollowUps(customerId: string) {
  const ctx = await ownCustomer(customerId)
  if (!ctx) return null
  const enabled = await followUpsEnabled(ctx.orgId)
  if (!enabled) return { enabled, items: [], team: [] }
  const [items, team] = await Promise.all([
    prisma.customerFollowUp.findMany({ where: { customerId, status: { not: 'CANCELLED' } }, orderBy: [{ status: 'desc' }, { dueDate: 'asc' }], take: 50, select: followUpSelect }),
    teamOf(ctx.orgId)
  ])
  return { enabled, items, team }
}

export async function createFollowUp(customerId: string, input: { dueDate: string; title: string; assignedToId?: string | null; smsReminder?: boolean }): Promise<Result> {
  const ctx = await ownCustomer(customerId)
  if (!ctx) return denied
  if (!(await followUpsEnabled(ctx.orgId))) return { success: false, error: upgradeMessage }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { success: false, error: 'Choisissez une date' }
  const due = new Date(`${input.dueDate}T00:00:00Z`)
  if (Number.isNaN(due.getTime()) || due.getTime() < startOfDayUtc().getTime()) return { success: false, error: 'La date est déjà passée' }
  const title = input.title.trim().replace(/\s+/g, ' ').slice(0, 120)
  if (!title) return { success: false, error: 'Indiquez l’objet du suivi' }
  const team = await teamOf(ctx.orgId)
  const assignee = input.assignedToId ? team.find(m => m.id === input.assignedToId) : null
  const me = team.find(m => m.id === ctx.userId)
  await prisma.customerFollowUp.create({
    data: {
      organizationId: ctx.orgId, customerId, dueDate: due, title,
      assignedToId: assignee?.id ?? null, assignedToName: assignee?.name ?? null,
      smsReminder: !!input.smsReminder, createdById: ctx.userId, createdByName: me?.name ?? null
    }
  })
  return { success: true }
}

/** Fait, rouvert ou annulé. */
export async function setFollowUpStatus(id: string, status: 'OPEN' | 'DONE' | 'CANCELLED'): Promise<Result> {
  const ctx = await getReceptionContext()
  if (!ctx) return denied
  if (!['OPEN', 'DONE', 'CANCELLED'].includes(status)) return { success: false, error: 'Statut invalide' }
  const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } })
  const res = await prisma.customerFollowUp.updateMany({
    where: { id, organizationId: ctx.orgId },
    data: status === 'DONE' ? { status, doneAt: new Date(), doneByName: me?.name ?? null } : { status, doneAt: null, doneByName: null }
  })
  return res.count ? { success: true } : { success: false, error: 'Suivi introuvable' }
}

/** « À faire » : suivis en retard et du jour, puis ceux des 14 prochains jours, et les derniers faits. */
export async function listFollowUps(input: { mine?: boolean } = {}) {
  const ctx = await getReceptionContext()
  if (!ctx) return null
  const enabled = await followUpsEnabled(ctx.orgId)
  if (!enabled) return { enabled, today: [], upcoming: [], done: [] }
  const today = startOfDayUtc()
  const base = { organizationId: ctx.orgId, ...(input.mine ? { OR: [{ assignedToId: ctx.userId }, { assignedToId: null }] } : {}) }
  const select = { ...followUpSelect, customer: { select: { id: true, name: true, phone: true, tags: { select: tagSelect } } } }
  const [due, upcoming, done] = await Promise.all([
    prisma.customerFollowUp.findMany({ where: { ...base, status: 'OPEN', dueDate: { lte: today } }, orderBy: { dueDate: 'asc' }, take: 200, select }),
    prisma.customerFollowUp.findMany({ where: { ...base, status: 'OPEN', dueDate: { gt: today, lte: new Date(today.getTime() + 14 * 86400_000) } }, orderBy: { dueDate: 'asc' }, take: 200, select }),
    prisma.customerFollowUp.findMany({ where: { ...base, status: 'DONE', doneAt: { gte: new Date(today.getTime() - 7 * 86400_000) } }, orderBy: { doneAt: 'desc' }, take: 30, select })
  ])
  const shape = (list: typeof due) => list.map(f => ({ ...f, customer: { ...f.customer, tags: f.customer.tags.map(l => l.tag) } }))
  return { enabled, today: shape(due), upcoming: shape(upcoming), done: shape(done) }
}

/** Pastille du menu : suivis en retard ou du jour. */
export async function getDueFollowUpsCount() {
  const ctx = await getReceptionContext()
  if (!ctx) return 0
  return prisma.customerFollowUp.count({ where: { organizationId: ctx.orgId, status: 'OPEN', dueDate: { lte: startOfDayUtc() } } })
}

// ---- Rendez-vous récurrents (dialyse, suivi de grossesse, kinésithérapie…) ----

export type Recurrence = 'WEEK' | 'TWO_WEEKS' | 'MONTH'

/** Réserve une série de rendez-vous au même horaire ; les créneaux indisponibles sont signalés, les autres réservés. */
export async function bookSeriesForCustomer(customerId: string, input: { serviceId: string; first: string; every: Recurrence; count: number }) {
  const ctx = await ownCustomer(customerId)
  if (!ctx) return denied
  if (!(await followUpsEnabled(ctx.orgId))) return { success: false as const, error: 'Les rendez-vous récurrents sont inclus à partir du forfait Pro (Abonnement).' }
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, phone: true, userId: true } })
  if (!customer?.phone) return { success: false as const, error: 'Ajoutez d’abord un numéro de téléphone au visiteur' }
  const first = new Date(input.first)
  if (Number.isNaN(first.getTime())) return { success: false as const, error: 'Créneau invalide' }
  const count = Math.min(24, Math.max(2, Math.round(input.count) || 2))

  const dates = Array.from({ length: count }, (_, i) => {
    const d = new Date(first)
    if (input.every === 'MONTH') d.setUTCMonth(d.getUTCMonth() + i)
    else d.setUTCDate(d.getUTCDate() + i * (input.every === 'TWO_WEEKS' ? 14 : 7))
    return d
  })
  const seriesId = randomUUID()
  const booked: { date: string; code: string }[] = []
  const skipped: { date: string; reason: string }[] = []
  for (const date of dates) {
    try {
      const res = await bookAppointment({
        orgId: ctx.orgId, serviceId: input.serviceId, scheduledDate: date, source: 'RECEPTION',
        userId: customer.userId, guestName: customer.name || 'Visiteur', guestPhone: customer.phone, seriesId, notify: false
      })
      booked.push({ date: date.toISOString(), code: res.code })
    } catch (error) {
      skipped.push({ date: date.toISOString(), reason: error instanceof AppointmentError ? error.message : 'Indisponible' })
    }
  }
  if (booked.length === 0) return { success: false as const, error: 'Aucun créneau de la série n’est disponible à cet horaire' }

  // Une seule confirmation pour toute la série ; les rappels de la veille partent pour chaque rendez-vous
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const list = booked.slice(0, 8).map(b => fmt(b.date)).join(', ') + (booked.length > 8 ? '…' : '')
  await sendSmsMessage({
    to: customer.phone,
    text: `Lerena : ${booked.length} rendez-vous confirmés chez ${org?.name ?? ''} à ${booked[0].date.slice(11, 16)} : ${list}. Rappel la veille de chacun.`,
    purpose: 'APPOINTMENT_CONFIRMED',
    organizationId: ctx.orgId
  })
  await audit({ action: 'APPOINTMENT_SERIES_BOOKED', targetType: 'Customer', targetId: customerId, organizationId: ctx.orgId, details: `${booked.length} RDV, ${skipped.length} indisponibles` })
  return { success: true as const, booked, skipped }
}
