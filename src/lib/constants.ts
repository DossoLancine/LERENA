export type Role = 'CLIENT' | 'AGENT' | 'MANAGER'

export type TicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'ABSENT'

export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ['WAITING', 'CALLED', 'SERVING']

export type Priority = 'STANDARD' | 'PRIORITY' | 'VIP'

export const PRIORITY_SCORES: Record<Priority, number> = {
  STANDARD: 1,
  PRIORITY: 2,
  VIP: 3
}

export function priorityLabel(score: number) {
  if (score >= 3) return 'VIP'
  if (score === 2) return 'PMR/Prioritaire'
  return 'Standard'
}

export const APPOINTMENT_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const

// Nom du guichet à afficher (Ticket.counterName), en attendant une table Counter dédiée
export function counterLabel(counterName: string | null | undefined) {
  return counterName || 'Guichet 1'
}

// Début de la journée en cours (heure du serveur)
export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
