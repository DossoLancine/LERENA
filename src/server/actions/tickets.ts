'use server'

import { prisma } from "@/lib/prisma"
import { ticketRoutes } from "@/lib/ticket-route"
import { getSessionUser } from "@/lib/session"
import { issueTicket } from "@/lib/ticketing"
import { maskPhone } from "@/lib/phone"
import { notifyOrg } from "@/lib/realtime"
import { revalidatePath } from "next/cache"
import { MIN, RATE_LIMITED, rateLimitAll, requestIp } from '@/lib/rate-limit'

const ip = (prefix: string) => { const a = requestIp(); return a ? `${prefix}:${a}` : null }

/** Ticket pris dans l'application ; la priorité n'est retenue que si l'établissement l'autorise dans l'application. */
export async function joinQueue(serviceId: string, orgId: string, priorityId: string | null = null, userLat?: number, userLng?: number) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) throw new Error("UNAUTHORIZED")

    // Session obsolète (compte supprimé après une réinitialisation de la base)
    const validUser = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { id: true, phone: true } })
    if (!validUser) throw new Error("SESSION_EXPIRED")

    // Anti-abus : 6 tickets par personne et 40 par adresse en 10 minutes
    if (!(await rateLimitAll([{ key: `ticket:u:${sessionUser.id}`, max: 6, windowMs: 10 * MIN }, { key: ip(`ticket:ip`), max: 40, windowMs: 10 * MIN }]))) {
      return { success: false, error: RATE_LIMITED }
    }

    const ticket = await issueTicket({
      orgId, serviceId, priorityId, channel: 'app', lat: userLat, lng: userLng,
      owner: { userId: sessionUser.id, name: sessionUser.name || 'Client', phone: validUser.phone }
    })
    return { success: true, ticketId: ticket.id }
  } catch (error: any) {
    console.error("Join Queue error:", error)
    return { success: false, error: error.message }
  }
}

export async function getUserTickets() {
  try {
    const user = await getSessionUser()
    if (!user) return []

    const tickets = await prisma.ticket.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        queue: { include: { branch: { include: { organization: true } } } },
        service: true
      }
    })
    return tickets
  } catch (error) {
    console.error("Get user tickets error:", error)
    return []
  }
}

export async function getTicketById(id: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        queue: {
          include: { branch: { include: { organization: true } } }
        },
        service: true
      }
    })

    if (!ticket) return null;

    // Position réelle, dans l'ordre d'appel de l'agent : priorité d'abord, puis entrée dans la file
    let realPosition = 0
    if (ticket.status === 'WAITING') {
      const ahead = await prisma.ticket.count({
        where: {
          queueId: ticket.queueId,
          status: 'WAITING',
          OR: [
            { priorityScore: { gt: ticket.priorityScore } },
            { priorityScore: ticket.priorityScore, queuedAt: { lt: ticket.queuedAt } }
          ]
        }
      })
      realPosition = ahead + 1
    }

    const route = (await ticketRoutes([ticket]))!.get(ticket.id)!

    // Ce lien est partageable : jamais de note interne ni de numéro complet
    const { notes: _internalNotes, guestPhone, ...publicTicket } = ticket
    return {
      ...publicTicket,
      guestPhone: guestPhone ? maskPhone(guestPhone) : null,
      initialPosition: ticket.position, // Position at creation
      position: realPosition,           // Current dynamic position
      orgName: ticket.queue?.branch?.organization?.name || 'Établissement Inconnu',
      orgLogo: ticket.queue?.branch?.organization?.logo ?? null,
      orgColor: ticket.queue?.branch?.organization?.brandColor ?? null,
      serviceName: ticket.service?.name || 'Service Inconnu',
      route,
    }
  } catch (error) {
    console.error("Get ticket error:", error)
    return null
  }
}

// Le client quitte la file : son ticket est annulé et libère sa place
export async function leaveQueue(ticketId: string) {
  try {
    const user = await getSessionUser()
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true, queue: { select: { branch: { select: { organizationId: true } } } } }
    })
    if (!ticket || (ticket.userId && ticket.userId !== user?.id)) {
      return { success: false, error: "Ticket introuvable" }
    }
    if (ticket.status !== 'WAITING' && ticket.status !== 'CALLED') {
      return { success: false, error: "Ce ticket n'est plus dans la file" }
    }

    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CANCELLED' } })

    const orgId = ticket.queue.branch.organizationId
    await notifyOrg(orgId)
    revalidatePath(`/ticket/${ticketId}`)
    revalidatePath('/tickets')
    return { success: true }
  } catch (error: any) {
    console.error("Leave queue error:", error)
    return { success: false, error: error.message }
  }
}

/** Ticket en cours du visiteur connecté, résumé pour l'accueil : numéro, place et attente estimée. */
export async function getActiveTicketSummary() {
  const user = await getSessionUser()
  if (!user) return null
  const t = await prisma.ticket.findFirst({
    where: { userId: user.id, status: { in: ['WAITING', 'CALLED', 'SERVING', 'ON_HOLD'] } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, displayNum: true, status: true, queueId: true, priorityScore: true, queuedAt: true, counterName: true,
      service: { select: { name: true, avgDurationMin: true } },
      queue: { select: { branch: { select: { organization: { select: { id: true, name: true } } } } } }
    }
  })
  if (!t) return null
  const ahead = t.status === 'WAITING'
    ? await prisma.ticket.count({ where: { queueId: t.queueId, status: 'WAITING', OR: [{ priorityScore: { gt: t.priorityScore } }, { priorityScore: t.priorityScore, queuedAt: { lt: t.queuedAt } }] } })
    : 0
  return {
    id: t.id, displayNum: t.displayNum, status: t.status, counterName: t.counterName,
    orgId: t.queue.branch.organization.id, orgName: t.queue.branch.organization.name, serviceName: t.service?.name ?? '',
    ahead, waitMin: ahead * (t.service?.avgDurationMin ?? 10)
  }
}
