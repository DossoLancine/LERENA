'use server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { sendPushToUser } from '@/lib/push'
import { CHANNEL_LABELS, defaultChannels, eventsForRole, type NotificationChannel } from '@/lib/notification-events'
import { isLive } from '@/lib/integrations'

// Cloche, préférences et abonnement push de la personne connectée (équipe, DG, console, visiteur).

async function me() {
  const user = await getSessionUser()
  if (!user) return null
  const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id }, select: { role: true } })
  return { ...user, notifiedRole: membership?.role ?? user.role }
}

export async function getMyNotifications() {
  const u = await me()
  if (!u) return null
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: u.id, createdAt: { gte: new Date(Date.now() - 90 * 86400_000) } },
      orderBy: { updatedAt: 'desc' }, take: 40,
      select: { id: true, type: true, title: true, body: true, url: true, count: true, isRead: true, updatedAt: true }
    }),
    prisma.notification.count({ where: { userId: u.id, isRead: false } })
  ])
  return { items, unread }
}

export async function getUnreadNotificationsCount() {
  const u = await getSessionUser()
  if (!u) return 0
  return prisma.notification.count({ where: { userId: u.id, isRead: false } })
}

/** Marque comme lues des notifications précises, ou toutes (ids absent). */
export async function markNotificationsRead(ids?: string[]) {
  const u = await getSessionUser()
  if (!u) return { success: false }
  await prisma.notification.updateMany({ where: { userId: u.id, isRead: false, ...(ids ? { id: { in: ids.slice(0, 100) } } : {}) }, data: { isRead: true, readAt: new Date() } })
  return { success: true }
}

const CHANNELS: NotificationChannel[] = ['APP', 'PUSH', 'EMAIL', 'WHATSAPP']

/** Réglages : événements de son rôle, canaux choisis (ou préréglage), heures de silence, canaux disponibles. */
export async function getMyNotificationSettings() {
  const u = await me()
  if (!u) return null
  const [settings, user, devices, whatsapp, email] = await Promise.all([
    prisma.notificationSettings.findUnique({ where: { userId: u.id } }),
    prisma.user.findUnique({ where: { id: u.id }, select: { email: true, phone: true } }),
    prisma.pushSubscription.count({ where: { userId: u.id, ticketId: null } }),
    isLive('WHATSAPP'),
    isLive('EMAIL')
  ])
  const prefs = (settings?.prefs ?? {}) as Record<string, NotificationChannel[]>
  return {
    events: eventsForRole(u.notifiedRole).map(e => ({ id: e.id, label: e.label, description: e.description, urgent: !!e.urgent, since: e.since ?? null, channels: prefs[e.id] ?? defaultChannels(e.id, u.notifiedRole) })),
    quietFrom: settings ? settings.quietFrom : 21,
    quietTo: settings ? settings.quietTo : 7,
    channels: CHANNELS.map(c => ({
      id: c, label: CHANNEL_LABELS[c],
      // Disponible : adresse ou numéro connus ; prestataire branché (sinon, le canal reste choisissable mais signalé)
      available: c === 'APP' || c === 'PUSH' || (c === 'EMAIL' ? !!user?.email : !!user?.phone),
      live: c === 'EMAIL' ? email : c === 'WHATSAPP' ? whatsapp : true
    })),
    devices
  }
}

export async function saveMyNotificationSettings(input: { prefs: Record<string, NotificationChannel[]>; quietFrom: number | null; quietTo: number | null }) {
  const u = await me()
  if (!u) return { success: false as const }
  const allowed = new Set(eventsForRole(u.notifiedRole).map(e => e.id))
  const prefs: Record<string, NotificationChannel[]> = {}
  for (const [event, channels] of Object.entries(input.prefs ?? {})) {
    if (!allowed.has(event) || !Array.isArray(channels)) continue
    prefs[event] = Array.from(new Set<NotificationChannel>(['APP', ...channels.filter((c): c is NotificationChannel => CHANNELS.includes(c as NotificationChannel))]))
  }
  const hour = (h: number | null) => (h == null ? null : Math.min(23, Math.max(0, Math.round(h))))
  await prisma.notificationSettings.upsert({
    where: { userId: u.id },
    update: { prefs, quietFrom: hour(input.quietFrom), quietTo: hour(input.quietTo) },
    create: { userId: u.id, prefs, quietFrom: hour(input.quietFrom), quietTo: hour(input.quietTo) }
  })
  return { success: true as const }
}

interface BrowserSubscription { endpoint: string; keys: { p256dh: string; auth: string } }

/** Abonne cet appareil aux notifications de la personne connectée (application fermée comprise). */
export async function saveMyPushSubscription(sub: BrowserSubscription) {
  const u = await getSessionUser()
  if (!u) return { success: false }
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) return { success: false }
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: u.id, ticketId: null, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: { endpoint: sub.endpoint, userId: u.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth }
  })
  return { success: true }
}

export async function removeMyPushSubscription(endpoint: string) {
  const u = await getSessionUser()
  if (!u) return { success: false }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: u.id } })
  return { success: true }
}

export async function isMyPushSubscribed(endpoint: string) {
  const u = await getSessionUser()
  if (!u) return false
  return (await prisma.pushSubscription.count({ where: { endpoint, userId: u.id, ticketId: null } })) > 0
}

/** Notification de test vers la cloche et les appareils de la personne. */
export async function sendMyTestNotification() {
  const u = await getSessionUser()
  if (!u) return { success: false as const, devices: 0 }
  await prisma.notification.create({ data: { userId: u.id, type: 'TEST', title: 'Notification de test', body: 'Tout fonctionne : vous recevrez ici les alertes de Lerena.', url: '/account/notifications' } })
  const devices = await sendPushToUser(u.id, { title: 'Lerena', body: 'Notification de test : tout fonctionne.', url: '/account/notifications', tag: 'test' })
  return { success: true as const, devices }
}
