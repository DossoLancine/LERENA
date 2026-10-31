'use server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

interface BrowserSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// Enregistre l'appareil pour recevoir les alertes du ticket suivi
export async function savePushSubscription(ticketId: string, sub: BrowserSubscription) {
  try {
    if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) {
      return { success: false }
    }

    const [user, ticket] = await Promise.all([
      getSessionUser(),
      prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, userId: true } })
    ])
    if (!ticket || (ticket.userId && ticket.userId !== user?.id)) return { success: false }

    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { ticketId: ticket.id, userId: user?.id ?? null, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      create: { endpoint: sub.endpoint, ticketId: ticket.id, userId: user?.id ?? null, p256dh: sub.keys.p256dh, auth: sub.keys.auth }
    })
    return { success: true }
  } catch (error) {
    console.error('savePushSubscription error:', error)
    return { success: false }
  }
}

// Indique si cet appareil suit déjà ce ticket
export async function isPushSubscribed(ticketId: string, endpoint: string) {
  try {
    const sub = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { ticketId: true } })
    return sub?.ticketId === ticketId
  } catch {
    return false
  }
}
