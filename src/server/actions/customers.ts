'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getReceptionContext } from '@/lib/session'
import { normalizePhone } from '@/lib/phone'
import { audit } from '@/lib/audit'
import { backfillCustomers, findOrCreateCustomer } from '@/lib/customers'
import { TAG_COLORS } from '@/lib/customer-labels'

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
