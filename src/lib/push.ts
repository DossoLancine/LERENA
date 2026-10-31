import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

// Envoi de notifications push aux appareils qui suivent un ticket.
// Sans clés VAPID configurées, l'envoi est simplement ignoré.

let configured: boolean | null = null

function ensureConfigured() {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'https://lerena1.vercel.app'
  configured = !!(publicKey && privateKey)
  if (configured) webpush.setVapidDetails(subject, publicKey!, privateKey!)
  return configured
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
  urgent?: boolean
}

export async function sendPushToTicket(ticketId: string, payload: PushPayload) {
  if (!ensureConfigured()) return
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { ticketId } })
    await Promise.allSettled(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 600, urgency: payload.urgent ? 'high' : 'normal' }
        )
      } catch (error: any) {
        // Abonnement expiré ou révoqué : on le supprime
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        } else {
          console.error('Push send error:', error?.statusCode ?? error)
        }
      }
    }))
  } catch (error) {
    console.error('Push lookup error:', error)
  }
}
