'use client'

// Tickets pris sans compte : leurs identifiants sont gardés sur le téléphone du visiteur
// pour qu'il les retrouve dans « Mes tickets ».

const KEY = 'attends_guest_tickets'
const MAX = 20

export function getGuestTicketIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function rememberGuestTicket(id: string) {
  try {
    const ids = [id, ...getGuestTicketIds().filter(x => x !== id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {}
}
