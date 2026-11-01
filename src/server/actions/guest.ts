'use server'

import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { smsEnabled } from '@/lib/sms'
import { sendOtp, verifyOtp } from '@/lib/otp'
import { issueTicket, TicketError } from '@/lib/ticketing'
import { ACTIVE_TICKET_STATUSES, startOfToday } from '@/lib/constants'

// Ticket sans compte : prénom + téléphone. Le code SMS n'est exigé que si un fournisseur SMS est configuré.

const MAX_GUEST_TICKETS_PER_DAY = 3

/** Indique au formulaire si un code SMS sera demandé. */
export async function guestFlowConfig() {
  return { smsRequired: smsEnabled() }
}

/** Envoie le code de vérification au numéro donné. */
export async function requestGuestCode(rawPhone: string) {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { success: false, error: 'Numéro de téléphone invalide' }
  if (!smsEnabled()) return { success: true, required: false }

  const res = await sendOtp(phone, 'GUEST_TICKET')
  return res.ok ? { success: true, required: true } : { success: false, error: res.error }
}

export async function joinQueueAsGuest(input: {
  orgId: string
  serviceId: string
  name: string
  phone: string
  code?: string
  priorityId?: string | null
  lat?: number
  lng?: number
}) {
  try {
    const name = input.name.trim().slice(0, 60)
    const phone = normalizePhone(input.phone)
    if (name.length < 2) return { success: false, error: 'Indiquez votre prénom' }
    if (!phone) return { success: false, error: 'Numéro de téléphone invalide' }

    if (smsEnabled()) {
      if (!input.code || !(await verifyOtp(phone, 'GUEST_TICKET', input.code))) {
        return { success: false, error: 'CODE_INVALID' }
      }
    }

    // Limites anti-abus : un ticket actif par numéro et par établissement, quelques tickets par jour
    const [activeHere, today] = await Promise.all([
      prisma.ticket.count({
        where: { guestPhone: phone, status: { in: ACTIVE_TICKET_STATUSES }, queue: { branch: { organizationId: input.orgId } } }
      }),
      prisma.ticket.count({ where: { guestPhone: phone, userId: null, createdAt: { gte: startOfToday() } } })
    ])
    if (activeHere > 0) return { success: false, error: 'Vous avez déjà un ticket en cours dans cet établissement.' }
    if (today >= MAX_GUEST_TICKETS_PER_DAY) {
      return { success: false, error: "Limite de tickets sans compte atteinte aujourd'hui. Créez un compte pour continuer." }
    }

    const ticket = await issueTicket({
      orgId: input.orgId,
      serviceId: input.serviceId,
      priorityId: input.priorityId,
      lat: input.lat,
      lng: input.lng,
      owner: { userId: null, name, phone }
    })
    return { success: true, ticketId: ticket.id }
  } catch (error) {
    if (error instanceof TicketError) return { success: false, error: error.message }
    console.error('joinQueueAsGuest error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/** Tickets d'un visiteur, retrouvés à partir des identifiants gardés sur son téléphone. */
export async function getGuestTickets(ids: string[]) {
  const safeIds = ids.filter(id => typeof id === 'string' && id.length < 40).slice(0, 20)
  if (safeIds.length === 0) return []
  return prisma.ticket.findMany({
    where: { id: { in: safeIds }, userId: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, displayNum: true, status: true, createdAt: true,
      service: { select: { name: true } },
      queue: { select: { branch: { select: { organization: { select: { id: true, name: true } } } } } }
    }
  })
}
