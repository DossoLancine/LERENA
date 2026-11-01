import { prisma } from '@/lib/prisma'

// Parcours d'un ticket à travers les services : il n'est pas prévu à l'avance.
// Chaque transfert (accueil, secrétariat, caisse…) ajoute une étape ; la dernière est l'étape en cours.

export interface TicketRoute {
  step: number // numéro de l'étape en cours (1 = premier service)
  done: string[] // services déjà passés, dans l'ordre
  transferredBy: string | null // guichet qui a fait le dernier transfert (il ne rappelle pas ce client)
}

export async function ticketRoutes(tickets: { id: string; serviceId: string }[]): Promise<Map<string, TicketRoute>> {
  const routes = new Map<string, TicketRoute>()
  if (tickets.length === 0) return routes

  const transfers = await prisma.ticketEvent.findMany({
    where: { ticketId: { in: tickets.map(t => t.id) }, type: 'TRANSFERRED' },
    orderBy: { createdAt: 'asc' },
    select: { ticketId: true, fromServiceId: true, counterName: true }
  })
  const serviceIds = Array.from(new Set(transfers.map(t => t.fromServiceId).filter((x): x is string => !!x)))
  const services = serviceIds.length
    ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
    : []
  const names = new Map(services.map(s => [s.id, s.name]))

  for (const t of tickets) {
    const mine = transfers.filter(e => e.ticketId === t.id)
    const done = mine.map(e => (e.fromServiceId && names.get(e.fromServiceId)) || 'Service')
    routes.set(t.id, { step: done.length + 1, done, transferredBy: mine.at(-1)?.counterName ?? null })
  }
  return routes
}
