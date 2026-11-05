import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { appUrl, sendSmsWithStatus, sendWhatsAppMessage } from '@/lib/messaging'
import { getIntegration } from '@/lib/integrations'
import { normalizeSms, smsParts } from '@/lib/campaign-text'
import { notify } from '@/lib/notifications'
import { notifyOrg } from '@/lib/realtime'
import { optOutCustomers } from '@/lib/campaigns'
import { ackText, defaultAway, isValidCode, menuText, MENU_BUTTONS, parseCommand, suggestCode, type BotState } from '@/lib/inbox-commands'

// Messages reçus des visiteurs (WhatsApp, SMS) : rattachement à l'établissement, conversation, réponses automatiques
// (menu, absence, prise de ticket) et réponses de l'équipe. Le numéro d'envoi est commun à la plateforme.

export type InboundChannel = 'SMS' | 'WHATSAPP'
const HOUR = 3600_000
const ACK_EVERY = 12 * HOUR
const HUMAN_QUIET = 30 * 60_000
const WA_WINDOW = 24 * HOUR
const ACTIVE = ['WAITING', 'CALLED', 'SERVING']

/** Réglages de messagerie d'un établissement (créés à la première lecture, avec un code proposé). */
export async function messagingSettings(orgId: string) {
  const existing = await prisma.messagingSettings.findUnique({ where: { organizationId: orgId } })
  if (existing) return existing
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } })
  const base = suggestCode(org?.name ?? '')
  for (let i = 0; i < 20; i++) {
    const code = i ? `${base}${i + 1}` : base
    try {
      return await prisma.messagingSettings.create({ data: { organizationId: orgId, code: isValidCode(code) ? code : null } })
    } catch (e) {
      const again = await prisma.messagingSettings.findUnique({ where: { organizationId: orgId } })
      if (again) return again // créé entre-temps
      if (!(e instanceof Error) || !/Unique/i.test(e.message)) throw e
    }
  }
  return prisma.messagingSettings.create({ data: { organizationId: orgId } })
}

/** Établissement concerné par un message reçu : code cité, sinon le dernier qui a échangé avec ce numéro (30 jours). */
async function resolveOrg(phone: string, code: string | null) {
  if (code) {
    const s = await prisma.messagingSettings.findUnique({ where: { code }, select: { organizationId: true } })
    if (s) return s.organizationId
  }
  const since = new Date(Date.now() - 30 * 24 * HOUR)
  const [conv, out, customer] = await Promise.all([
    prisma.conversation.findFirst({ where: { phone, lastMessageAt: { gte: since } }, orderBy: { lastMessageAt: 'desc' }, select: { organizationId: true, lastMessageAt: true } }),
    prisma.outboundMessage.findFirst({ where: { to: phone, organizationId: { not: null }, channel: { in: ['SMS', 'WHATSAPP'] }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, select: { organizationId: true, createdAt: true } }),
    prisma.customer.findFirst({ where: { phone }, orderBy: { lastSeenAt: 'desc' }, select: { organizationId: true } })
  ])
  if (conv && (!out || conv.lastMessageAt >= out.createdAt)) return conv.organizationId
  return out?.organizationId ?? customer?.organizationId ?? null
}

type Conv = Prisma.ConversationGetPayload<{ include: { organization: { select: { id: true; name: true; isActive: true; requireGps: true } } } }>

/** Réponse dans une conversation : WhatsApp dans la fenêtre de 24 h si le visiteur a écrit par WhatsApp, sinon SMS. */
export async function replyInConversation(conv: { id: string; organizationId: string; phone: string; channel: string; lastInboundAt: Date | null }, text: string, opts: { auto?: boolean; authorId?: string | null; buttons?: { id: string; title: string }[] } = {}) {
  const wa = conv.channel === 'WHATSAPP' && !!conv.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() < WA_WINDOW
  let channel: InboundChannel = 'SMS'
  let status: string
  let body = text
  if (wa) {
    const live = (await getIntegration('WHATSAPP')).live
    // En simulation, la réponse reste sur WhatsApp (journalisée) : le visiteur a écrit par WhatsApp
    const r = await sendWhatsAppMessage({ to: conv.phone, text, buttons: opts.buttons, purpose: 'CONVERSATION', organizationId: conv.organizationId, fallbackToSms: live })
    channel = r.channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS'
    status = r.status
  } else {
    body = normalizeSms(text)
    status = await sendSmsWithStatus({ to: conv.phone, text: body, purpose: 'CONVERSATION', organizationId: conv.organizationId })
  }
  const now = new Date()
  const msg = await prisma.conversationMessage.create({ data: { conversationId: conv.id, direction: 'OUT', channel, body, auto: !!opts.auto, authorId: opts.authorId ?? null, status, parts: channel === 'SMS' ? smsParts(body).parts : 1 } })
  await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, ...(opts.authorId ? { lastHumanAt: now, unread: 0 } : {}) } })
  return msg
}

/** Site ouvert en ce moment (horaires du site, jours de fermeture, bouton Ouvert / Fermé de l'établissement). */
async function openNow(orgId: string, now = new Date()) {
  const branch = await prisma.branch.findFirst({ where: { organizationId: orgId, isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true, businessHours: true } })
  if (!branch) return true
  const day = now.toISOString().slice(0, 10)
  const closed = await prisma.closureDay.count({ where: { organizationId: orgId, OR: [{ branchId: null }, { branchId: branch.id }], date: { gte: new Date(`${day}T00:00:00Z`), lt: new Date(`${day}T23:59:59Z`) } } })
  if (closed) return false
  const dow = now.getUTCDay()
  const DEFAULT: Record<number, [string, string] | null> = { 0: null, 1: ['08:00', '17:00'], 2: ['08:00', '17:00'], 3: ['08:00', '17:00'], 4: ['08:00', '17:00'], 5: ['08:00', '17:00'], 6: ['08:00', '12:00'] }
  const custom = branch.businessHours.find(h => h.dayOfWeek === dow)
  const hours = branch.businessHours.length ? (custom && !custom.isClosed ? [custom.openTime, custom.closeTime] : null) : DEFAULT[dow]
  if (!hours) return false
  const min = now.getUTCHours() * 60 + now.getUTCMinutes()
  const toMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0) }
  return min >= toMin(hours[0]) && min < toMin(hours[1])
}

// ---- Réponses du menu ----

const visitorWhere = (conv: Conv) => ({ OR: [...(conv.customerId ? [{ customerId: conv.customerId }] : []), { guestPhone: conv.phone }, { user: { phone: conv.phone } }] })

async function myTicket(conv: Conv) {
  const t = await prisma.ticket.findFirst({
    where: { status: { in: ACTIVE }, queue: { branch: { organizationId: conv.organizationId } }, createdAt: { gte: new Date(Date.now() - 18 * HOUR) }, ...visitorWhere(conv) },
    orderBy: { createdAt: 'desc' }, select: { id: true, displayNum: true, status: true, queueId: true, priorityScore: true, queuedAt: true, service: { select: { name: true } } }
  })
  if (!t) return null
  const ahead = t.status === 'WAITING' ? await prisma.ticket.count({ where: { queueId: t.queueId, status: 'WAITING', OR: [{ priorityScore: { gt: t.priorityScore } }, { priorityScore: t.priorityScore, queuedAt: { lt: t.queuedAt } }] } }) : 0
  const state = t.status === 'WAITING' ? (ahead ? `${ahead} personne${ahead > 1 ? 's' : ''} avant vous` : 'vous êtes le prochain') : t.status === 'CALLED' ? 'vous êtes appelé, présentez-vous au guichet' : 'vous êtes au guichet'
  return `Votre ticket ${t.displayNum} (${t.service.name}) : ${state}. Suivre en direct : ${appUrl()}/ticket/${t.id}`
}

async function nextAppointment(conv: Conv) {
  return prisma.appointment.findFirst({
    where: { organizationId: conv.organizationId, status: 'CONFIRMED', scheduledDate: { gte: new Date(Date.now() - HOUR) }, ...visitorWhere(conv) },
    orderBy: { scheduledDate: 'asc' },
    select: { id: true, scheduledDate: true, code: true, service: { select: { name: true } }, branch: { select: { name: true } }, organization: { select: { apptCancelHours: true } } }
  })
}
const when = (d: Date) => `${d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })} à ${d.toISOString().slice(11, 16)}`

async function takeTicketStart(conv: Conv) {
  const services = await prisma.service.findMany({
    where: { isActive: true, branch: { organizationId: conv.organizationId, isActive: true } },
    orderBy: [{ branch: { createdAt: 'asc' } }, { name: 'asc' }], take: 9, select: { id: true, name: true, branch: { select: { name: true } } }
  })
  if (!services.length) return { text: `${conv.organization.name} ne propose pas de ticket par message pour le moment.` }
  const multi = new Set(services.map(s => s.branch.name)).size > 1
  await prisma.conversation.update({ where: { id: conv.id }, data: { botState: 'TICKET_SERVICE', botData: { serviceIds: services.map(s => s.id) } } })
  return {
    text: `${conv.organization.name} : pour quel service ? Répondez par le chiffre.\n${services.map((s, i) => `${i + 1}. ${s.name}${multi ? ` (${s.branch.name})` : ''}`).join('\n')}`,
    buttons: services.map((s, i) => ({ id: `SVC_${i + 1}`, title: s.name }))
  }
}

async function takeTicketChoose(conv: Conv, n: number) {
  const ids = ((conv.botData as { serviceIds?: string[] } | null)?.serviceIds ?? [])
  const serviceId = ids[n - 1]
  if (!serviceId) return `Choix inconnu : répondez par un chiffre de 1 à ${ids.length}.`
  await prisma.conversation.update({ where: { id: conv.id }, data: { botState: null, botData: undefined } })
  const { issueTicket, TicketError } = await import('@/lib/ticketing')
  try {
    const customer = conv.customerId ? await prisma.customer.findUnique({ where: { id: conv.customerId }, select: { name: true } }) : null
    // Pas de position GPS par message : la borne fait le même contrôle (personne sur place ou non)
    const t = await issueTicket({ orgId: conv.organizationId, serviceId, channel: 'kiosk', owner: { userId: null, name: customer?.name ?? '', phone: conv.phone } })
    const { attachTicketToCustomer } = await import('@/lib/customers')
    const customerId = await attachTicketToCustomer(t.id, { orgId: conv.organizationId, userId: null, phone: conv.phone, name: customer?.name ?? null })
    if (customerId && !conv.customerId) await prisma.conversation.update({ where: { id: conv.id }, data: { customerId } })
    const ahead = await prisma.ticket.count({ where: { queueId: t.queueId, status: 'WAITING', id: { not: t.id }, OR: [{ priorityScore: { gt: t.priorityScore } }, { priorityScore: t.priorityScore, queuedAt: { lt: t.queuedAt } }] } })
    await notifyOrg(conv.organizationId)
    return `Votre ticket ${t.displayNum} est pris. ${ahead ? `${ahead} personne${ahead > 1 ? 's' : ''} avant vous.` : 'Vous êtes le prochain.'} Suivre votre tour : ${appUrl()}/ticket/${t.id}`
  } catch (e) {
    if (e instanceof TicketError) return `Ticket impossible : ${e.message}`
    const { limitMessage } = await import('@/lib/billing')
    const m = limitMessage(e)
    if (m) return `Ticket impossible : ${m}`
    throw e
  }
}

/**
 * Message reçu d'un visiteur. STOP retire son accord partout ; sinon le message rejoint la conversation de
 * l'établissement et reçoit, si besoin, une réponse automatique. Renvoie la conversation (null si aucun établissement).
 */
export async function handleInbound(input: { channel: InboundChannel; from: string; text: string; buttonId?: string | null; now?: Date }) {
  const phone = normalizePhone(input.from)
  if (!phone) return null
  const text = (input.text ?? '').slice(0, 2000)
  const first = parseCommand(text, { buttonId: input.buttonId })
  if (first.kind === 'STOP') {
    await optOutCustomers({ phone })
    // La conversation garde la trace, sans réponse (le visiteur ne veut plus de messages)
  }

  const orgId = await resolveOrg(phone, first.kind === 'TAKE_TICKET' ? first.code : null)
  if (!orgId) {
    if (first.kind !== 'STOP') {
      await sendSmsWithStatus({ to: phone, text: "Bonjour, ce numéro envoie les messages des établissements Lerena. Pour prendre un ticket, envoyez TICKET suivi du code affiché dans l'établissement.", purpose: 'CONVERSATION' })
    }
    return null
  }

  const now = input.now ?? new Date()
  const customer = await prisma.customer.findFirst({ where: { organizationId: orgId, phone }, select: { id: true } })
  const base = await prisma.conversation.upsert({
    where: { organizationId_phone: { organizationId: orgId, phone } },
    create: { organizationId: orgId, phone, customerId: customer?.id ?? null, channel: input.channel, lastMessageAt: now, lastInboundAt: now },
    update: { channel: input.channel, lastMessageAt: now, lastInboundAt: now, ...(customer ? { customerId: customer.id } : {}) },
    include: { organization: { select: { id: true, name: true, isActive: true, requireGps: true } } }
  })
  await prisma.conversationMessage.create({ data: { conversationId: base.id, direction: 'IN', channel: input.channel, body: input.buttonId ? `${text || input.buttonId}` : text } })
  if (first.kind === 'STOP') {
    await prisma.conversation.update({ where: { id: base.id }, data: { status: 'DONE', botState: null } })
    return base
  }

  const conv = base as Conv
  const settings = await messagingSettings(orgId)
  const cmd = parseCommand(text, { buttonId: input.buttonId, state: conv.botState as BotState })
  const org = conv.organization.name
  const reply = (t: string, buttons?: { id: string; title: string }[]) => replyInConversation(conv, t, { auto: true, buttons })
  const needsHuman = async (title: string, body: string) => {
    await prisma.conversation.update({ where: { id: conv.id }, data: { status: 'OPEN', unread: { increment: 1 } } })
    await notify({ event: 'INBOX_MESSAGE', orgId, title, body: body.slice(0, 160), url: '/reception/conversations', groupKey: `conv:${conv.id}`, groupTitle: c => `${c} messages de ${conv.phone}` }).catch(() => null)
    await notifyOrg(orgId).catch(() => null)
  }

  // Une étape en cours est abandonnée dès que le visiteur écrit autre chose
  if (conv.botState && !['CHOICE', 'YES', 'NO'].includes(cmd.kind)) await prisma.conversation.update({ where: { id: conv.id }, data: { botState: null, botData: undefined } })

  if (cmd.kind === 'TAKE_TICKET' || (cmd.kind === 'MY_TICKET' && text.trim().toLowerCase() === 'ticket' && settings.whatsappTickets)) {
    const current = await myTicket(conv)
    if (current) await reply(current)
    else if (!settings.whatsappTickets) await reply(`${org} ne délivre pas de ticket par message. Prenez votre ticket sur place ou dans l'application Lerena.`)
    else if (conv.organization.requireGps) await reply(`${org} demande d'être sur place : prenez votre ticket à la borne ou dans l'application Lerena.`)
    else { const start = await takeTicketStart(conv); await reply(start.text, start.buttons) }
    return conv
  }
  if (cmd.kind === 'CHOICE' && conv.botState === 'TICKET_SERVICE') { await reply(await takeTicketChoose(conv, cmd.n)); return conv }

  if (settings.autoMenu) {
    switch (cmd.kind) {
      case 'MENU':
        await prisma.conversation.update({ where: { id: conv.id }, data: { lastMenuAt: now } })
        await reply(menuText(org), MENU_BUTTONS); return conv
      case 'MY_TICKET':
        await reply((await myTicket(conv)) ?? `Vous n'avez pas de ticket en cours chez ${org}.${settings.whatsappTickets ? ` Pour en prendre un, envoyez TICKET ${settings.code ?? ''}.`.replace(/ \.$/, '.') : ''}`); return conv
      case 'MY_APPT': {
        const a = await nextAppointment(conv)
        await reply(a ? `Votre rendez-vous chez ${org} : ${when(a.scheduledDate)}, ${a.service?.name ?? ''} (${a.branch.name}).${a.code ? ` Code d'arrivée : ${a.code}.` : ''} Pour l'annuler, répondez 3.` : `Vous n'avez pas de rendez-vous à venir chez ${org}.`)
        return conv
      }
      case 'CANCEL_APPT': {
        const a = await nextAppointment(conv)
        if (!a) { await reply(`Vous n'avez pas de rendez-vous à venir chez ${org}.`); return conv }
        if (a.scheduledDate.getTime() - now.getTime() <= a.organization.apptCancelHours * HOUR) { await reply(`L'annulation par message n'est plus possible (moins de ${a.organization.apptCancelHours} h avant). Répondez 4 pour parler à l'accueil.`); return conv }
        await prisma.conversation.update({ where: { id: conv.id }, data: { botState: 'CONFIRM_CANCEL', botData: { appointmentId: a.id } } })
        await reply(`Annuler votre rendez-vous du ${when(a.scheduledDate)} ? Répondez OUI pour confirmer ou NON.`, [{ id: 'CMD_OUI', title: 'Oui, annuler' }, { id: 'CMD_NON', title: 'Non' }])
        return conv
      }
      case 'YES':
      case 'NO': {
        if (conv.botState !== 'CONFIRM_CANCEL') break
        const apptId = (conv.botData as { appointmentId?: string } | null)?.appointmentId
        await prisma.conversation.update({ where: { id: conv.id }, data: { botState: null, botData: undefined } })
        if (cmd.kind === 'NO' || !apptId) { await reply('Entendu, votre rendez-vous est maintenu.'); return conv }
        const done = await prisma.appointment.updateMany({ where: { id: apptId, organizationId: orgId, status: 'CONFIRMED' }, data: { status: 'CANCELLED', cancelledAt: now } })
        if (done.count) {
          const { cancelUnpaidOrders } = await import('@/lib/shop-orders')
          const { refreshCustomersOfAppointments } = await import('@/lib/customers')
          await Promise.all([cancelUnpaidOrders({ appointmentId: apptId }, orgId, 'Rendez-vous annulé par message').catch(() => null), refreshCustomersOfAppointments([apptId]).catch(() => null), notifyOrg(orgId)])
        }
        await reply(done.count ? 'Votre rendez-vous est annulé. Merci de nous avoir prévenus.' : 'Ce rendez-vous n’est plus modifiable.')
        return conv
      }
      case 'HUMAN':
        await prisma.conversation.update({ where: { id: conv.id }, data: { humanRequestedAt: now } })
        await needsHuman(`${conv.phone} demande à parler à l’accueil`, text)
        await reply(`Un membre de l'accueil de ${org} vous répond dès que possible.`)
        return conv
    }
  }

  // Message libre : il part à l'accueil ; accusé de réception (ou message d'absence) au plus une fois par demi-journée,
  // et jamais juste après une réponse de l'équipe (la conversation est en cours avec une personne)
  await needsHuman(`Message de ${conv.phone}`, text)
  const humanTalking = conv.lastHumanAt && now.getTime() - conv.lastHumanAt.getTime() < HUMAN_QUIET
  const acked = conv.lastMenuAt && now.getTime() - conv.lastMenuAt.getTime() < ACK_EVERY
  if (humanTalking || acked) return conv
  const open = conv.organization.isActive && (await openNow(orgId, now))
  if (!open) {
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMenuAt: now } })
    await reply(settings.awayMessage?.trim() || defaultAway(org))
  } else if (settings.autoMenu) {
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMenuAt: now } })
    await reply(`${ackText(org)}\n\n${menuText(org)}`, MENU_BUTTONS)
  }
  return conv
}
