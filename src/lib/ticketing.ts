import { prisma } from '@/lib/prisma'
import { distanceKm } from '@/lib/geo'
import { resolvePriority, PriorityError, type PriorityChannel } from '@/lib/priorities'
import { notifyOrg } from '@/lib/realtime'
import { revalidatePath } from 'next/cache'
import { logTicketEvent } from '@/lib/ticket-events'

// Création d'un ticket, commune à tous les canaux : client connecté, visiteur,
// et plus tard accueil et borne. Module serveur uniquement (jamais appelé du navigateur).

export interface TicketOwner {
  userId: string | null
  name: string
  phone: string | null
  // Personne qui émet le ticket quand ce n'est pas le client (agent d'accueil)
  actorId?: string | null
}

export interface IssueTicketInput {
  orgId: string
  serviceId: string
  // Motif de priorité choisi parmi ceux de l'établissement (null = sans priorité)
  priorityId?: string | null
  // Canal d'émission : l'accueil attribue tous les motifs ; l'application et la borne seulement si l'établissement l'autorise
  channel?: PriorityChannel
  lat?: number
  lng?: number
  owner: TicketOwner
}

export class TicketError extends Error {}

// Nom comparable : minuscules, sans accents ni « File » devant
const normalize = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^files+/, '').replace(/s+/g, ' ').trim()

/**
 * File d'un service. La correspondance la plus précise l'emporte : même nom d'abord
 * (« CONSULTATION » → « File CONSULTATION », jamais « File Consultation générale »),
 * puis le nom le plus proche, puis la lettre du ticket, sinon la première file de l'agence.
 */
export function queueForService<Q extends { name: string; prefix: string }>(service: { name: string; branch: { queues: Q[] } }): Q {
  const target = normalize(service.name)
  let best: Q | undefined
  let bestScore = 0
  for (const q of service.branch.queues) {
    const name = normalize(q.name)
    let score = 0
    if (name === target) score = 1000
    else if (name.includes(target) || target.includes(name)) {
      // Plus les deux noms ont une longueur proche, plus la correspondance est précise
      score = 100 + Math.round((Math.min(name.length, target.length) / Math.max(name.length, target.length)) * 100)
    } else if (q.prefix.toUpperCase() === service.name.trim()[0]?.toUpperCase()) score = 10
    if (score > bestScore) { best = q; bestScore = score }
  }
  return best ?? service.branch.queues[0]
}

export async function issueTicket({ orgId, serviceId, priorityId, channel = 'app', lat, lng, owner }: IssueTicketInput) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) throw new TicketError('Établissement introuvable')
  if (!org.isActive) throw new TicketError('Cet établissement est fermé pour le moment')

  // Protection anti-abus : position exigée par certains établissements
  if (org.requireGps) {
    if (!lat || !lng) throw new TicketError('GPS_REQUIRED')
    if (org.lat && org.lng && distanceKm(lat, lng, org.lat, org.lng) > org.maxRadiusKm) {
      throw new TicketError('OUT_OF_BOUNDS')
    }
  }

  // Le service doit appartenir à l'établissement demandé
  const service = await prisma.service.findFirst({
    where: { id: serviceId, isActive: true, branch: { organizationId: orgId } },
    include: { branch: { include: { queues: true } } }
  })
  if (!service || service.branch.queues.length === 0) {
    throw new TicketError("Service ou file d'attente introuvable")
  }

  const queue = queueForService(service)

  // Numéro attribué de façon atomique : deux clients simultanés ne reçoivent jamais le même
  const lastTicket = await prisma.ticket.findFirst({
    where: { queueId: queue.id },
    orderBy: { number: 'desc' },
    select: { number: true }
  })
  if (lastTicket && queue.currentNum < lastTicket.number) {
    await prisma.queue.update({ where: { id: queue.id }, data: { currentNum: lastTicket.number } })
  }

  let priority: Awaited<ReturnType<typeof resolvePriority>>
  try {
    priority = await resolvePriority(orgId, priorityId, channel)
  } catch (error) {
    if (error instanceof PriorityError) throw new TicketError(error.message)
    throw error
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const { currentNum: newNumber } = await tx.queue.update({
      where: { id: queue.id },
      data: { currentNum: { increment: 1 } },
      select: { currentNum: true }
    })
    const waiting = await tx.ticket.count({ where: { queueId: queue.id, status: 'WAITING' } })

    return tx.ticket.create({
      data: {
        queueId: queue.id,
        serviceId: service.id,
        userId: owner.userId,
        guestName: owner.name,
        guestPhone: owner.phone,
        number: newNumber,
        displayNum: `${queue.prefix}${newNumber.toString().padStart(3, '0')}`,
        priorityScore: priority.score,
        priorityReason: priority.reason,
        status: 'WAITING',
        position: waiting + 1
      }
    })
  })

  await logTicketEvent({ ticketId: ticket.id, type: 'ISSUED', actorId: owner.actorId ?? owner.userId })
  await notifyOrg(orgId)
  revalidatePath(`/org/${orgId}`)
  revalidatePath(`/tv/${orgId}`)
  revalidatePath('/dashboard')
  revalidatePath('/agent')

  return ticket
}
