'use server'

import { prisma } from '@/lib/prisma'
import { getReceptionContext } from '@/lib/session'
import { issueTicket, TicketError } from '@/lib/ticketing'
import { normalizePhone } from '@/lib/phone'
import { notifyOrg } from '@/lib/realtime'
import { logTicketEvent } from '@/lib/ticket-events'
import { PRIORITY_SCORES, type Priority } from '@/lib/constants'

// Accueil : émettre un ticket pour une personne présente (sans smartphone ou sans compte),
// l'orienter selon l'affluence, corriger une priorité ou un service.

/** Tableau d'affluence : services ouverts, personnes en attente, attente estimée. */
export async function getReceptionBoard() {
  const ctx = await getReceptionContext()
  if (!ctx) return null

  const [org, services, waiting] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { id: true, name: true, isActive: true } }),
    prisma.service.findMany({
      where: { isActive: true, branch: { organizationId: ctx.orgId } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, avgDurationMin: true }
    }),
    prisma.ticket.groupBy({
      by: ['serviceId'],
      where: { status: 'WAITING', queue: { branch: { organizationId: ctx.orgId } } },
      _count: { _all: true }
    })
  ])
  if (!org) return null

  return {
    org,
    services: services.map(s => {
      const count = waiting.find(w => w.serviceId === s.id)?._count._all ?? 0
      return { ...s, waiting: count, waitMin: count * s.avgDurationMin }
    })
  }
}

/** Derniers tickets de la journée, pour retrouver et corriger un ticket. */
export async function getRecentTickets() {
  const ctx = await getReceptionContext()
  if (!ctx) return []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return prisma.ticket.findMany({
    where: { queue: { branch: { organizationId: ctx.orgId } }, createdAt: { gte: start } },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true, displayNum: true, status: true, guestName: true, priorityScore: true, createdAt: true,
      service: { select: { id: true, name: true } },
      user: { select: { name: true } }
    }
  })
}

/** Émet un ticket au comptoir et renvoie ce qu'il faut imprimer. */
export async function issueReceptionTicket(input: { serviceId: string; priority?: Priority; name?: string; phone?: string }) {
  const ctx = await getReceptionContext()
  if (!ctx) return { success: false as const, error: 'Non autorisé' }

  const phone = input.phone ? normalizePhone(input.phone) : null
  if (input.phone && !phone) return { success: false as const, error: 'Numéro de téléphone invalide' }

  try {
    const ticket = await issueTicket({
      orgId: ctx.orgId,
      serviceId: input.serviceId,
      priority: input.priority ?? 'STANDARD',
      owner: { userId: null, name: input.name?.trim().slice(0, 60) || 'Accueil', phone, actorId: ctx.userId }
    })

    const [service, org, ahead] = await Promise.all([
      prisma.service.findUnique({ where: { id: ticket.serviceId }, select: { name: true, avgDurationMin: true } }),
      prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } }),
      prisma.ticket.count({
        where: {
          queueId: ticket.queueId, status: 'WAITING',
          OR: [
            { priorityScore: { gt: ticket.priorityScore } },
            { priorityScore: ticket.priorityScore, queuedAt: { lt: ticket.queuedAt } }
          ]
        }
      })
    ])

    return {
      success: true as const,
      ticket: {
        id: ticket.id,
        displayNum: ticket.displayNum,
        serviceName: service?.name ?? '',
        orgName: org?.name ?? '',
        ahead,
        waitMin: ahead * (service?.avgDurationMin ?? 15),
        issuedAt: ticket.createdAt.toISOString()
      }
    }
  } catch (error) {
    if (error instanceof TicketError) return { success: false as const, error: error.message }
    console.error('issueReceptionTicket error:', error)
    return { success: false as const, error: 'Une erreur est survenue' }
  }
}

/** Change la priorité d'un ticket en attente (personne âgée, enceinte, handicap repérée à l'accueil). */
export async function setTicketPriority(ticketId: string, priority: Priority) {
  const ctx = await getReceptionContext()
  if (!ctx) return { success: false }
  const score = PRIORITY_SCORES[priority]
  if (!score) return { success: false }

  const res = await prisma.ticket.updateMany({
    where: { id: ticketId, status: 'WAITING', queue: { branch: { organizationId: ctx.orgId } } },
    data: { priorityScore: score }
  })
  if (res.count === 0) return { success: false }
  await logTicketEvent({ ticketId, type: 'PRIORITY', actorId: ctx.userId, note: priority })
  await notifyOrg(ctx.orgId)
  return { success: true }
}
