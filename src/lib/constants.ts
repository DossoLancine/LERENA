export type Role = 'CLIENT' | 'RECEPTION' | 'AGENT' | 'MANAGER' | 'ORG_ADMIN' | 'VIEWER' | 'SUPER_ADMIN'

// Rôles du personnel d'un établissement, et la page d'arrivée de chacun
export const STAFF_ROLES: Role[] = ['RECEPTION', 'AGENT', 'MANAGER']
export function homeForRole(role: Role | undefined) {
  if (role === 'SUPER_ADMIN') return '/admin'
  if (role === 'ORG_ADMIN' || role === 'VIEWER') return '/org-admin'
  if (role === 'MANAGER') return '/dashboard'
  if (role === 'AGENT') return '/agent'
  if (role === 'RECEPTION') return '/reception'
  return '/home'
}

export type TicketStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ABSENT'

// ON_HOLD : client parti chercher un document ; il garde sa place auprès du même guichet
export const ACTIVE_TICKET_STATUSES: TicketStatus[] = ['WAITING', 'CALLED', 'SERVING', 'ON_HOLD']

// Priorités : motifs définis par chaque établissement, voir src/lib/priorities.ts

export const APPOINTMENT_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const

// Nom du guichet à afficher (Ticket.counterName)
export function counterLabel(counterName: string | null | undefined) {
  return counterName || 'Guichet 1'
}

// Début de la journée en cours (heure du serveur)
export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
