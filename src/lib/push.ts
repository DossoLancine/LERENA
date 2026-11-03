import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { getIntegration } from '@/lib/integrations'

// Notifications push (standard Web) : appareils qui suivent un ticket, et appareils des personnes connectées.
// Clés VAPID réglées dans la console → Intégrations (ou anciennes variables NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
// Sans clés, l'envoi est simplement ignoré : les notifications restent visibles dans l'application.

let configuredKey: string | null = null

async function ensureConfigured() {
  const c = await getIntegration('PUSH')
  if (!c.live) return false
  const key = `${c.values.publicKey}:${c.values.privateKey}`
  if (configuredKey !== key) {
    webpush.setVapidDetails(c.values.subject || 'mailto:contact@lerena.ci', c.values.publicKey, c.values.privateKey)
    configuredKey = key
  }
  return true
}

/** Clé publique transmise au navigateur pour s'abonner (null si les notifications push ne sont pas activées). */
export async function pushPublicKey() {
  const c = await getIntegration('PUSH')
  return c.live ? c.values.publicKey : null
}

/** Paire de clés neuve (console). Changer de clés oblige chaque appareil à réactiver ses notifications. */
export function checkPushKeys(publicKey: string, privateKey: string, subject?: string) {
  // Lève une erreur si les clés ne sont pas des clés VAPID valides
  webpush.setVapidDetails(subject || 'mailto:contact@lerena.ci', publicKey, privateKey)
  configuredKey = null
}

export function generatePushKeys() {
  return webpush.generateVAPIDKeys()
}

type Sub = { id: string; endpoint: string; p256dh: string; auth: string }

async function deliver(subs: Sub[], payload: PushPayload) {
  const results = await Promise.allSettled(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: payload.ttl ?? 600, urgency: payload.urgent ? 'high' : 'normal' }
      )
      return true
    } catch (error: any) {
      // Abonnement expiré ou révoqué : on le supprime
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      } else {
        console.error('Push send error:', error?.statusCode ?? error)
      }
      return false
    }
  }))
  return results.filter(r => r.status === 'fulfilled' && r.value).length
}

/** Notification à tous les appareils d'une personne (équipe, DG, visiteur connecté). Renvoie le nombre d'appareils touchés. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!(await ensureConfigured())) return 0
  const subs = await prisma.pushSubscription.findMany({ where: { userId, ticketId: null }, select: { id: true, endpoint: true, p256dh: true, auth: true } })
  return deliver(subs, payload)
}

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
  urgent?: boolean
  /** Durée de validité si l'appareil est éteint (secondes, 10 min par défaut). */
  ttl?: number
}

export async function sendPushToTicket(ticketId: string, payload: PushPayload) {
  if (!(await ensureConfigured())) return
  try {
    const subs = await prisma.pushSubscription.findMany({ where: { ticketId }, select: { id: true, endpoint: true, p256dh: true, auth: true } })
    await deliver(subs, payload)
  } catch (error) {
    console.error('Push lookup error:', error)
  }
}
