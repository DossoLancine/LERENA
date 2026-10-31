import { prisma } from '@/lib/prisma'

// Historique d'un ticket (appel, rappel, transfert, pause, note…). Un échec d'écriture
// de l'historique ne doit jamais bloquer l'action elle-même.

export type TicketEventType =
  | 'ISSUED' | 'CALLED' | 'RECALLED' | 'SERVING' | 'COMPLETED' | 'ABSENT' | 'CANCELLED'
  | 'HELD' | 'RESUMED' | 'TRANSFERRED' | 'NOTE' | 'PRIORITY'

export async function logTicketEvent(data: {
  ticketId: string
  type: TicketEventType
  actorId?: string | null
  counterName?: string | null
  fromServiceId?: string | null
  toServiceId?: string | null
  note?: string | null
}) {
  try {
    await prisma.ticketEvent.create({ data })
  } catch (error) {
    console.error('Ticket event log error:', error)
  }
}
