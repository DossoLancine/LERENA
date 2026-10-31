import { prisma } from '@/lib/prisma'
import { distanceKm } from '@/lib/geo'
import { PRIORITY_SCORES, type Priority } from '@/lib/constants'
import { notifyOrg } from '@/lib/realtime'
import { revalidatePath } from 'next/cache'

// Création d'un ticket, commune à tous les canaux : client connecté, visiteur,
// et plus tard accueil et borne. Module serveur uniquement (jamais appelé du navigateur).

export interface TicketOwner {
  userId: string | null
  name: string
  phone: string | null
}

export interface IssueTicketInput {
  orgId: string
  serviceId: string
  priority?: string
  lat?: number
  lng?: number
  owner: TicketOwner
}

export class TicketError extends Error {}

export async function issueTicket({ orgId, serviceId, priority = 'STANDARD', lat, lng, owner }: IssueTicketInput) {
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

  // File du service : par nom ou par préfixe, sinon la première file de l'agence
  const queue = service.branch.queues.find(q =>
    service.name.toLowerCase().includes(q.name.toLowerCase()) ||
    q.name.toLowerCase().includes(service.name.toLowerCase()) ||
    q.prefix.toUpperCase() === service.name.trim()[0]?.toUpperCase()
  ) || service.branch.queues[0]

  // Numéro attribué de façon atomique : deux clients simultanés ne reçoivent jamais le même
  const lastTicket = await prisma.ticket.findFirst({
    where: { queueId: queue.id },
    orderBy: { number: 'desc' },
    select: { number: true }
  })
  if (lastTicket && queue.currentNum < lastTicket.number) {
    await prisma.queue.update({ where: { id: queue.id }, data: { currentNum: lastTicket.number } })
  }

  const priorityScore = PRIORITY_SCORES[priority as Priority] ?? PRIORITY_SCORES.STANDARD

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
        priorityScore,
        status: 'WAITING',
        position: waiting + 1
      }
    })
  })

  await notifyOrg(orgId)
  revalidatePath(`/org/${orgId}`)
  revalidatePath(`/tv/${orgId}`)
  revalidatePath('/dashboard')
  revalidatePath('/agent')

  return ticket
}
