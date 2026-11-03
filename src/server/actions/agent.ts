'use server'

import { scopedBranch } from '@/lib/sites'
import { prisma } from "@/lib/prisma"
import { ticketRoutes } from '@/lib/ticket-route'
import { revalidatePath } from "next/cache"
import { getStaffContext, getOrgQueueIds } from "@/lib/session"
import { siteQueueIds } from "@/lib/sites"
import { ACTIVE_TICKET_STATUSES, startOfToday, type TicketStatus } from "@/lib/constants"
import { notifyOrg } from "@/lib/realtime"
import { sendPushToTicket } from "@/lib/push"
import { notifyTicket } from "@/lib/notify"
import { logTicketEvent, type TicketEventType } from "@/lib/ticket-events"
import { queueForService } from "@/lib/ticketing"
import { refreshCustomersOfTickets } from "@/lib/customers"

// Ordre d'appel commun à toute l'app : priorité d'abord, puis entrée dans la file
const CALL_ORDER = [{ priorityScore: 'desc' as const }, { queuedAt: 'asc' as const }]

/** File de l'agent : celle du site de son guichet (tout l'établissement si son guichet n'est pas connu). */
export async function getAgentQueue(counterId?: string | null) {
  try {
    const ctx = await getStaffContext()
    if (!ctx) return []

    const counter = counterId
      ? await prisma.counter.findFirst({ where: { id: counterId, branch: await scopedBranch(ctx.orgId) }, select: { branchId: true } })
      : null
    const queueIds = counter ? await siteQueueIds(ctx.orgId, counter.branchId) : await getOrgQueueIds(ctx.orgId)
    if (queueIds.length === 0) return []

    const tickets = await prisma.ticket.findMany({
      where: {
        queueId: { in: queueIds },
        status: { in: ACTIVE_TICKET_STATUSES }
      },
      orderBy: CALL_ORDER,
      include: {
        service: true,
        // Uniquement le nom : jamais d'e-mail, téléphone ou mot de passe vers le navigateur
        user: { select: { name: true } },
        // Fiche visiteur : nombre de passages et étiquettes seulement (pas de numéro ni de notes)
        customer: { select: { visits: true, tags: { select: { tag: { select: { id: true, name: true, color: true } } } } } },
        session: true
      }
    })
    // Étapes déjà faites par chaque client (transferts entre services)
    const routes = await ticketRoutes(tickets)
    return tickets.map(t => ({ ...t, route: routes.get(t.id)! }))
  } catch (error) {
    console.error("Get agent queue error:", error)
    return []
  }
}

/** Guichets actifs de l'établissement, avec les services qu'ils traitent. */
export async function getAgentCounters() {
  const ctx = await getStaffContext()
  if (!ctx) return { counters: [], services: [] }

  const [counters, services] = await Promise.all([
    prisma.counter.findMany({
      where: { isActive: true, branch: await scopedBranch(ctx.orgId) },
      orderBy: [{ branch: { createdAt: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, serviceIds: true, branchId: true, branch: { select: { name: true } } }
    }),
    prisma.service.findMany({
      where: { isActive: true, branch: await scopedBranch(ctx.orgId) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, branchId: true }
    })
  ])
  const multiSite = new Set(counters.map(c => c.branchId)).size > 1
  return { counters: counters.map(c => ({ id: c.id, name: c.name, serviceIds: c.serviceIds, branchId: c.branchId, siteName: multiSite ? c.branch.name : null })), services }
}

const EVENT_FOR_STATUS: Partial<Record<TicketStatus, TicketEventType>> = {
  CALLED: 'CALLED', SERVING: 'SERVING', COMPLETED: 'COMPLETED', ABSENT: 'ABSENT', CANCELLED: 'CANCELLED', ON_HOLD: 'HELD'
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  counterName?: string,
  counterId?: string
) {
  try {
    const ctx = await getStaffContext('queue.serve')
    if (!ctx) return { success: false }

    const currentTicket = await prisma.ticket.findFirst({
      where: { id: ticketId, queue: { branch: await scopedBranch(ctx.orgId) } }
    })
    if (!currentTicket) return { success: false }

    // Le guichet doit appartenir à l'établissement de l'agent
    const counter = counterId
      ? await prisma.counter.findFirst({ where: { id: counterId, branch: await scopedBranch(ctx.orgId) }, select: { id: true, name: true } })
      : null

    const now = new Date()
    const updateData: Record<string, unknown> = { status }

    if (status === 'CALLED') {
      updateData.calledAt = now
      // Guichet assigné, affiché sur la TV et chez le client
      if (counter) {
        updateData.counterId = counter.id
        updateData.counterName = counter.name
      } else if (counterName) {
        updateData.counterName = counterName
      }
    } else if (status === 'SERVING') {
      updateData.startedAt = currentTicket.startedAt || now
    } else if (status === 'COMPLETED') {
      updateData.completedAt = now

      // Session de service pour l'AHT et les statistiques
      const started = currentTicket.startedAt || currentTicket.calledAt || now
      const durationSec = Math.max(1, Math.round((now.getTime() - started.getTime()) / 1000))
      const waitSec = Math.max(0, Math.round((started.getTime() - currentTicket.queuedAt.getTime()) / 1000))

      try {
        await prisma.serviceSession.upsert({
          where: { ticketId: currentTicket.id },
          update: { completedAt: now, durationSeconds: durationSec },
          create: {
            ticketId: currentTicket.id,
            serviceId: currentTicket.serviceId,
            agentId: ctx.userId,
            startedAt: started,
            completedAt: now,
            durationSeconds: durationSec,
            waitSeconds: waitSec,
            hour: now.getHours(),
            dayOfWeek: now.getDay()
          }
        })
      } catch (sessionErr) {
        console.error("ServiceSession creation error:", sessionErr)
      }
    }

    await prisma.ticket.update({ where: { id: ticketId }, data: updateData })
    // Passages et absences de la fiche visiteur
    if (status === 'COMPLETED' || status === 'ABSENT' || status === 'CANCELLED') await refreshCustomersOfTickets([ticketId])

    const eventType = EVENT_FOR_STATUS[status]
    if (eventType) {
      await logTicketEvent({ ticketId, type: eventType, actorId: ctx.userId, counterName: counter?.name ?? counterName ?? currentTicket.counterName })
    }

    await notifyOrg(ctx.orgId)
    if (status === 'CALLED') await notifyCalledAndNext(currentTicket, counter?.name ?? counterName)
    revalidatePath('/agent')
    revalidatePath('/dashboard')
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath(`/tv/${ctx.orgId}`)

    return { success: true }
  } catch (error) {
    console.error("Update ticket status error:", error)
    return { success: false }
  }
}

// Ticket de l'établissement de l'agent, ou null
async function findOwnTicket(ticketId: string, orgId: string) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, queue: { branch: { organizationId: orgId } } },
    include: { service: { select: { name: true } } }
  })
}

/** Rappel : la TV annonce à nouveau le numéro et le client reçoit une nouvelle alerte. */
export async function recallTicket(ticketId: string) {
  const ctx = await getStaffContext('queue.serve')
  if (!ctx) return { success: false }
  const ticket = await findOwnTicket(ticketId, ctx.orgId)
  if (!ticket || ticket.status !== 'CALLED') return { success: false }

  await prisma.ticket.update({ where: { id: ticketId }, data: { recalledAt: new Date() } })
  await logTicketEvent({ ticketId, type: 'RECALLED', actorId: ctx.userId, counterName: ticket.counterName })
  await notifyOrg(ctx.orgId)
  await sendPushToTicket(ticketId, {
    title: 'Rappel : c’est votre tour',
    body: `Ticket ${ticket.displayNum} : présentez-vous au ${ticket.counterName || 'guichet'}.`,
    url: `/ticket/${ticketId}`,
    tag: `ticket-${ticketId}`,
    urgent: true
  })
  return { success: true }
}

/** Reprise d'un ticket mis en pause : il revient au guichet qui l'avait appelé. */
export async function resumeTicket(ticketId: string) {
  const ctx = await getStaffContext('queue.serve')
  if (!ctx) return { success: false }
  const ticket = await findOwnTicket(ticketId, ctx.orgId)
  if (!ticket || ticket.status !== 'ON_HOLD') return { success: false }

  await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'CALLED', recalledAt: new Date() } })
  await logTicketEvent({ ticketId, type: 'RESUMED', actorId: ctx.userId, counterName: ticket.counterName })
  await notifyOrg(ctx.orgId)
  return { success: true }
}

/**
 * Transfert vers un autre service (ex. consultation → caisse → pharmacie).
 * Le client garde son numéro et passe en fin de la nouvelle file, avec sa priorité.
 */
export async function transferTicket(ticketId: string, toServiceId: string, note?: string) {
  const ctx = await getStaffContext('queue.serve')
  if (!ctx) return { success: false, error: 'Non autorisé' }

  const [ticket, target] = await Promise.all([
    findOwnTicket(ticketId, ctx.orgId),
    prisma.service.findFirst({
      where: { id: toServiceId, isActive: true, branch: await scopedBranch(ctx.orgId) },
      include: { branch: { include: { queues: true } } }
    })
  ])
  if (!ticket) return { success: false, error: 'Ticket introuvable' }
  if (!target || target.branch.queues.length === 0) return { success: false, error: 'Service introuvable' }
  if (target.id === ticket.serviceId) return { success: false, error: 'Le ticket est déjà dans ce service' }

  const queue = queueForService(target)
  const cleanNote = note?.trim().slice(0, 500) || null

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      serviceId: target.id,
      queueId: queue.id,
      status: 'WAITING',
      queuedAt: new Date(),
      counterId: null,
      counterName: null,
      calledAt: null,
      startedAt: null,
      ...(cleanNote ? { notes: ticket.notes ? `${ticket.notes}\n${cleanNote}` : cleanNote } : {})
    }
  })
  await logTicketEvent({
    ticketId, type: 'TRANSFERRED', actorId: ctx.userId, counterName: ticket.counterName,
    fromServiceId: ticket.serviceId, toServiceId: target.id, note: cleanNote
  })
  await notifyOrg(ctx.orgId)
  const step = (await prisma.ticketEvent.count({ where: { ticketId, type: 'TRANSFERRED' } })) + 1
  await sendPushToTicket(ticketId, {
    title: `Étape ${step} : ${target.name}`,
    body: `Ticket ${ticket.displayNum} : rendez-vous au service « ${target.name} ». Vous êtes dans sa file d’attente.`,
    url: `/ticket/${ticketId}`,
    tag: `ticket-${ticketId}`
  })
  revalidatePath(`/ticket/${ticketId}`)
  return { success: true }
}

/** Note interne sur un ticket, visible des agents (utile lors d'un transfert). */
export async function addTicketNote(ticketId: string, note: string) {
  const ctx = await getStaffContext('queue.serve')
  if (!ctx) return { success: false }
  const clean = note.trim().slice(0, 500)
  if (!clean) return { success: false }
  const ticket = await findOwnTicket(ticketId, ctx.orgId)
  if (!ticket) return { success: false }

  await prisma.ticket.update({ where: { id: ticketId }, data: { notes: ticket.notes ? `${ticket.notes}\n${clean}` : clean } })
  await logTicketEvent({ ticketId, type: 'NOTE', actorId: ctx.userId, note: clean })
  await notifyOrg(ctx.orgId)
  return { success: true }
}

// Alertes push : le client appelé, puis les deux suivants de la même file
async function notifyCalledAndNext(
  ticket: { id: string; queueId: string; displayNum: string },
  counterName?: string
) {
  const next = await prisma.ticket.findMany({
    where: { queueId: ticket.queueId, status: 'WAITING' },
    orderBy: CALL_ORDER,
    take: 2,
    select: { id: true, displayNum: true }
  })

  await Promise.allSettled([
    notifyTicket(ticket.id, {
      title: "C'est votre tour !",
      body: `Ticket ${ticket.displayNum} : présentez-vous au ${counterName || 'guichet'}.`,
      url: `/ticket/${ticket.id}`,
      tag: `ticket-${ticket.id}`,
      urgent: true
    }, `Lerena : ticket ${ticket.displayNum}, c'est votre tour. Présentez-vous au ${counterName || 'guichet'}.`),
    // SMS seulement pour le prochain (le suivant reçoit une notification push si possible)
    ...next.map((t, i) => notifyTicket(t.id, {
      title: i === 0 ? 'Vous êtes le prochain' : 'Votre tour approche',
      body: i === 0
        ? `Ticket ${t.displayNum} : rapprochez-vous du guichet.`
        : `Ticket ${t.displayNum} : plus qu'une personne devant vous.`,
      url: `/ticket/${t.id}`,
      tag: `ticket-${t.id}`
    }, i === 0 ? `Lerena : ticket ${t.displayNum}, vous êtes le prochain. Rapprochez-vous du guichet.` : undefined))
  ])
}

export async function getAgentStats() {
  const fallback = { servedToday: 0, avgMin: 15, orgId: null as string | null }
  try {
    const ctx = await getStaffContext()
    if (!ctx) return fallback

    const today = startOfToday()
    const orgScope = { branch: await scopedBranch(ctx.orgId) }

    const [servedToday, avg] = await Promise.all([
      prisma.ticket.count({
        where: { status: 'COMPLETED', completedAt: { gte: today }, queue: orgScope }
      }),
      prisma.serviceSession.aggregate({
        where: { completedAt: { gte: today }, durationSeconds: { gt: 0 }, service: orgScope },
        _avg: { durationSeconds: true }
      })
    ])

    const avgSec = avg._avg.durationSeconds
    return {
      orgId: ctx.orgId,
      servedToday,
      avgMin: avgSec ? Math.max(1, Math.round(avgSec / 60)) : 12
    }
  } catch (error) {
    console.error("Get agent stats error:", error)
    return fallback
  }
}
