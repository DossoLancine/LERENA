import { prisma } from '@/lib/prisma'
import { appUrl, sendEmail, sendWhatsAppMessage } from '@/lib/messaging'
import { templateParam } from '@/lib/whatsapp-templates'
import { sendPushToUser } from '@/lib/push'
import { defaultChannels, eventDefinition, inQuietHours, type NotificationChannel, type NotifiedRole } from '@/lib/notification-events'

// Notifications à l'équipe : cloche de l'application (toujours), puis selon les préférences de chacun :
// notification push (même application fermée), e-mail, WhatsApp. Module serveur ; un échec n'interrompt jamais l'action.
// Les notifications d'un même groupe (groupKey) se cumulent : « 3 nouveaux rendez-vous » au lieu de trois lignes,
// et l'e-mail ou le WhatsApp ne part qu'une fois par groupe.

const GROUP_WINDOW_MS = 12 * 3600_000

export interface NotifyInput {
  event: string
  orgId?: string | null
  /** Destinataires précis ; sinon les membres de l'établissement ayant ces rôles (ou les SUPER_ADMIN). */
  userIds?: string[]
  roles?: NotifiedRole[]
  title: string
  body: string
  url?: string
  groupKey?: string
  /** Titre quand plusieurs notifications sont regroupées. */
  groupTitle?: (count: number) => string
  ticketId?: string | null
  /** Événement propre à un site : seuls les membres dont le périmètre couvre ce site sont prévenus. */
  siteId?: string | null
}

type Recipient = { userId: string; role: string; email: string | null; phone: string | null }

async function recipientsFor(input: NotifyInput): Promise<Recipient[]> {
  const def = eventDefinition(input.event)
  const allowed = new Set(def?.roles ?? [])
  const roles = (input.roles ?? def?.roles ?? []).filter(r => allowed.has(r))

  if (input.userIds?.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: input.userIds } },
      select: { id: true, role: true, email: true, phone: true, memberships: input.orgId ? { where: { organizationId: input.orgId }, select: { role: true } } : false }
    })
    return users.map(u => ({ userId: u.id, role: (u.memberships as { role: string }[] | undefined)?.[0]?.role ?? u.role, email: u.email, phone: u.phone }))
  }
  const list: Recipient[] = []
  const orgRoles = roles.filter(r => r !== 'SUPER_ADMIN')
  if (input.orgId && orgRoles.length) {
    const [members, site] = await Promise.all([
      prisma.organizationMember.findMany({
        where: { organizationId: input.orgId, role: { in: orgRoles }, disabledAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: { role: true, siteIds: true, regionIds: true, user: { select: { id: true, email: true, phone: true } } }
      }),
      input.siteId ? prisma.branch.findUnique({ where: { id: input.siteId }, select: { regionId: true } }) : null
    ])
    const covers = (m: { siteIds: string[]; regionIds: string[] }) =>
      !input.siteId || (!m.siteIds.length && !m.regionIds.length) || m.siteIds.includes(input.siteId) || (!!site?.regionId && m.regionIds.includes(site.regionId))
    list.push(...members.filter(covers).map(m => ({ userId: m.user.id, role: m.role, email: m.user.email, phone: m.user.phone })))
  }
  if (roles.includes('SUPER_ADMIN')) {
    const admins = await prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true, email: true, phone: true } })
    list.push(...admins.map(a => ({ userId: a.id, role: 'SUPER_ADMIN', email: a.email, phone: a.phone })))
  }
  return Array.from(new Map(list.map(r => [r.userId, r])).values())
}

/** Ligne de la cloche : nouvelle, ou ajoutée au groupe encore non lu. Renvoie true si c'est une nouvelle ligne. */
async function upsertInApp(userId: string, input: NotifyInput) {
  if (input.groupKey) {
    const existing = await prisma.notification.findFirst({
      where: { userId, groupKey: input.groupKey, isRead: false, updatedAt: { gte: new Date(Date.now() - GROUP_WINDOW_MS) } },
      select: { id: true, count: true }
    })
    if (existing) {
      const count = existing.count + 1
      await prisma.notification.update({ where: { id: existing.id }, data: { count, title: input.groupTitle?.(count) ?? input.title, body: input.body, url: input.url ?? null } })
      return { isNew: false, count }
    }
  }
  await prisma.notification.create({
    data: { userId, type: input.event, title: input.title, body: input.body, url: input.url ?? null, organizationId: input.orgId ?? null, groupKey: input.groupKey ?? null, ticketId: input.ticketId ?? null }
  })
  return { isNew: true, count: 1 }
}

export async function notify(input: NotifyInput) {
  try {
    const def = eventDefinition(input.event)
    const recipients = await recipientsFor(input)
    if (recipients.length === 0) return 0
    const settings = await prisma.notificationSettings.findMany({ where: { userId: { in: recipients.map(r => r.userId) } } })
    const link = input.url ? `${appUrl()}${input.url}` : appUrl()

    await Promise.all(recipients.map(async r => {
      try {
        const s = settings.find(x => x.userId === r.userId)
        const prefs = (s?.prefs ?? {}) as Record<string, NotificationChannel[]>
        const channels = new Set<NotificationChannel>(prefs[input.event] ?? defaultChannels(input.event, r.role))
        const { isNew, count } = await upsertInApp(r.userId, input)
        const title = count > 1 ? input.groupTitle?.(count) ?? input.title : input.title
        const quiet = !def?.urgent && inQuietHours(s ? s.quietFrom : 21, s ? s.quietTo : 7)

        if (channels.has('PUSH') && !quiet) {
          await sendPushToUser(r.userId, { title, body: input.body, url: input.url ?? '/', tag: input.groupKey ?? input.event, urgent: def?.urgent, ttl: 3600 })
        }
        // Un seul e-mail ou WhatsApp par groupe (le premier), pour ne pas inonder la boîte de réception
        if (!isNew) return
        if (channels.has('EMAIL') && r.email) {
          await sendEmail({ to: r.email, subject: input.title, text: `${input.body}\n\n${link}\n\n—\nRégler vos notifications : ${appUrl()}/account/notifications`, purpose: 'ALERT', organizationId: input.orgId ?? null })
        }
        if (channels.has('WHATSAPP') && r.phone && !quiet) {
          // Hors fenêtre de 24 h, WhatsApp n'accepte que le modèle validé « lerena_alerte »
          await sendWhatsAppMessage({ to: r.phone, text: `${input.title}\n${input.body}\n${link}`, template: { name: 'lerena_alerte', language: 'fr', params: [templateParam(input.title), templateParam(`${input.body} ${link}`)] }, purpose: 'ALERT', organizationId: input.orgId ?? null, fallbackToSms: false })
        }
      } catch (error) {
        console.error('Notification error:', error)
      }
    }))
    return recipients.length
  } catch (error) {
    console.error('Notify error:', error)
    return 0
  }
}
