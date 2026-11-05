'use server'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMemberAccess } from '@/lib/session'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { getIntegration } from '@/lib/integrations'
import { customerScopeWhere } from '@/lib/customer-segments'
import { normalizePhone } from '@/lib/phone'
import { handleInbound, messagingSettings, replyInConversation } from '@/lib/inbox'
import { isValidCode } from '@/lib/inbox-commands'
import { MAX_BODY } from '@/lib/campaign-text'

// Boîte « Conversations » : messages des visiteurs par WhatsApp ou SMS, réponses de l'équipe, attribution, traité.

async function ctxFor(edit = false) {
  const ctx = await getMemberAccess()
  if (!ctx || !ctx.can(edit ? 'visitors.edit' : 'visitors.view')) return null
  return ctx
}
const scope = (orgId: string, siteIds: string[] | null): Prisma.ConversationWhereInput => ({
  organizationId: orgId,
  ...(siteIds ? { OR: [{ customerId: null }, { customer: customerScopeWhere(siteIds) }] } : {})
})

export type ConversationFilter = 'open' | 'mine' | 'done'

export async function listConversations(filter: ConversationFilter = 'open', q = '') {
  const ctx = await ctxFor()
  if (!ctx) return null
  const term = q.trim().slice(0, 40)
  const digits = term.replace(/\D/g, '')
  const where: Prisma.ConversationWhereInput = {
    ...scope(ctx.orgId, ctx.siteIds),
    ...(filter === 'done' ? { status: 'DONE' } : { status: 'OPEN' }),
    ...(filter === 'mine' ? { assignedToId: ctx.userId } : {}),
    ...(term ? { AND: [{ OR: [{ customer: { name: { contains: term, mode: 'insensitive' } } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] }] } : {})
  }
  const [rows, counts] = await Promise.all([
    prisma.conversation.findMany({
      where, orderBy: { lastMessageAt: 'desc' }, take: 60,
      select: {
        id: true, phone: true, channel: true, status: true, unread: true, lastMessageAt: true, humanRequestedAt: true, assignedToId: true,
        customer: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, direction: true, auto: true } }
      }
    }),
    prisma.conversation.groupBy({ by: ['status'], where: scope(ctx.orgId, ctx.siteIds), _count: true, _sum: { unread: true } })
  ])
  const members = await assignees(ctx.orgId)
  return {
    canReply: ctx.can('visitors.edit'),
    canSettings: ctx.can('settings.manage'),
    me: ctx.userId,
    unread: counts.find(c => c.status === 'OPEN')?._sum.unread ?? 0,
    open: counts.find(c => c.status === 'OPEN')?._count ?? 0,
    conversations: rows.map(c => ({
      id: c.id, phone: c.phone, name: c.customer?.name ?? null, customerId: c.customer?.id ?? null, channel: c.channel, status: c.status, unread: c.unread,
      lastMessageAt: c.lastMessageAt.toISOString(), wantsHuman: !!c.humanRequestedAt && c.status === 'OPEN',
      assignee: members.find(m => m.id === c.assignedToId)?.name ?? null,
      last: c.messages[0] ? { body: c.messages[0].body, direction: c.messages[0].direction, auto: c.messages[0].auto } : null
    }))
  }
}

async function assignees(orgId: string) {
  const ms = await prisma.organizationMember.findMany({ where: { organizationId: orgId, disabledAt: null, role: { in: ['MANAGER', 'RECEPTION'] } }, select: { user: { select: { id: true, name: true, email: true } } } })
  return ms.map(m => ({ id: m.user.id, name: m.user.name || m.user.email || 'Membre' }))
}

export async function getConversation(id: string) {
  const ctx = await ctxFor()
  if (!ctx) return null
  const c = await prisma.conversation.findFirst({
    where: { id, ...scope(ctx.orgId, ctx.siteIds) },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: 200 }, customer: { select: { id: true, name: true, visits: true, optedOutAt: true } } }
  })
  if (!c) return null
  if (c.unread) await prisma.conversation.update({ where: { id: c.id }, data: { unread: 0 } })
  const [members, ticket, appointment, wa, org] = await Promise.all([
    assignees(ctx.orgId),
    prisma.ticket.findFirst({ where: { queue: { branch: { organizationId: ctx.orgId } }, status: { in: ['WAITING', 'CALLED', 'SERVING'] }, OR: [...(c.customerId ? [{ customerId: c.customerId }] : []), { guestPhone: c.phone }] }, orderBy: { createdAt: 'desc' }, select: { id: true, displayNum: true, status: true, service: { select: { name: true } } } }),
    prisma.appointment.findFirst({ where: { organizationId: ctx.orgId, status: 'CONFIRMED', scheduledDate: { gte: new Date(Date.now() - 3600_000) }, OR: [...(c.customerId ? [{ customerId: c.customerId }] : []), { guestPhone: c.phone }] }, orderBy: { scheduledDate: 'asc' }, select: { scheduledDate: true, service: { select: { name: true } } } }),
    getIntegration('WHATSAPP'),
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })
  ])
  const authors = members
  const waOpen = c.channel === 'WHATSAPP' && !!c.lastInboundAt && Date.now() - c.lastInboundAt.getTime() < 24 * 3600_000
  return {
    id: c.id, phone: c.phone, channel: c.channel, status: c.status, assignedToId: c.assignedToId, orgName: org?.name ?? 'Lerena',
    customer: c.customer ? { id: c.customer.id, name: c.customer.name, visits: c.customer.visits, optedOut: !!c.customer.optedOutAt } : null,
    // Canal de la prochaine réponse : WhatsApp dans les 24 h qui suivent un message WhatsApp du visiteur, sinon SMS
    replyChannel: waOpen ? 'WHATSAPP' as const : 'SMS' as const,
    waLive: wa.live,
    ticket: ticket ? { id: ticket.id, displayNum: ticket.displayNum, status: ticket.status, service: ticket.service.name } : null,
    appointment: appointment ? { scheduledDate: appointment.scheduledDate.toISOString(), service: appointment.service?.name ?? null } : null,
    members,
    messages: c.messages.map(m => ({ id: m.id, direction: m.direction, channel: m.channel, body: m.body, auto: m.auto, status: m.status, parts: m.parts, createdAt: m.createdAt.toISOString(), author: m.authorId ? authors.find(a => a.id === m.authorId)?.name ?? 'Équipe' : null }))
  }
}

export async function replyConversation(id: string, text: string) {
  const ctx = await ctxFor(true)
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const body = text.trim().slice(0, MAX_BODY)
  if (body.length < 2) return { success: false as const, error: 'Le message est vide' }
  const c = await prisma.conversation.findFirst({ where: { id, ...scope(ctx.orgId, ctx.siteIds) }, select: { id: true, organizationId: true, phone: true, channel: true, lastInboundAt: true, assignedToId: true } })
  if (!c) return { success: false as const, error: 'Conversation introuvable' }
  if (!(await rateLimit(`conv-reply:${ctx.userId}`, 60, 3600_000))) return { success: false as const, error: 'Trop de messages envoyés : réessayez dans une heure' }
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })
  // Réponse à un message reçu : envoyée même sans accord pour les campagnes (c'est le visiteur qui a écrit)
  const msg = await replyInConversation(c, `${org?.name ?? 'Lerena'} : ${body}`, { authorId: ctx.userId })
  if (!c.assignedToId) await prisma.conversation.update({ where: { id: c.id }, data: { assignedToId: ctx.userId } })
  if (msg.status === 'SKIPPED') return { success: false as const, error: 'Plus de SMS disponibles : achetez un pack dans Abonnement → Boutique' }
  if (msg.status === 'FAILED') return { success: false as const, error: 'L’envoi a échoué : vérifiez le numéro.' }
  return { success: true as const }
}

export async function assignConversation(id: string, userId: string | null) {
  const ctx = await ctxFor(true)
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (userId && !(await assignees(ctx.orgId)).some(m => m.id === userId)) return { success: false as const, error: 'Membre inconnu' }
  const r = await prisma.conversation.updateMany({ where: { id, ...scope(ctx.orgId, ctx.siteIds) }, data: { assignedToId: userId } })
  return r.count ? { success: true as const } : { success: false as const, error: 'Conversation introuvable' }
}

export async function setConversationStatus(id: string, status: 'OPEN' | 'DONE') {
  const ctx = await ctxFor(true)
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (status !== 'OPEN' && status !== 'DONE') return { success: false as const, error: 'État inconnu' }
  const r = await prisma.conversation.updateMany({ where: { id, ...scope(ctx.orgId, ctx.siteIds) }, data: { status, unread: 0, ...(status === 'DONE' ? { humanRequestedAt: null, botState: null } : {}) } })
  return r.count ? { success: true as const } : { success: false as const, error: 'Conversation introuvable' }
}

/** Conversations à lire (pastille du menu et de l'accueil). */
export async function countUnreadConversations() {
  const ctx = await ctxFor()
  if (!ctx) return 0
  const r = await prisma.conversation.aggregate({ where: { ...scope(ctx.orgId, ctx.siteIds), status: 'OPEN', unread: { gt: 0 } }, _count: true })
  return r._count
}

// ---- Réglages et simulation ----

export async function getMessagingSettings() {
  const ctx = await ctxFor()
  if (!ctx || !ctx.can('settings.manage')) return null
  const [s, sms, wa] = await Promise.all([messagingSettings(ctx.orgId), getIntegration('SMS'), getIntegration('WHATSAPP')])
  return { autoMenu: s.autoMenu, awayMessage: s.awayMessage ?? '', whatsappTickets: s.whatsappTickets, code: s.code ?? '', quickReplies: s.quickReplies, smsLive: sms.live, waLive: wa.live }
}

export async function saveMessagingSettings(input: { autoMenu: boolean; awayMessage: string; whatsappTickets: boolean; code: string; quickReplies: string[] }) {
  const ctx = await ctxFor()
  if (!ctx || !ctx.can('settings.manage')) return { success: false as const, error: 'Non autorisé' }
  const code = input.code.trim().toUpperCase()
  if (code && !isValidCode(code)) return { success: false as const, error: 'Code : 2 à 12 lettres ou chiffres' }
  await messagingSettings(ctx.orgId)
  try {
    await prisma.messagingSettings.update({
      where: { organizationId: ctx.orgId },
      data: {
        autoMenu: !!input.autoMenu, whatsappTickets: !!input.whatsappTickets, code: code || null,
        awayMessage: input.awayMessage.trim().slice(0, 300) || null,
        quickReplies: (input.quickReplies ?? []).map(q => q.trim().slice(0, 300)).filter(Boolean).slice(0, 10)
      }
    })
  } catch (e) {
    if (e instanceof Error && /Unique/i.test(e.message)) return { success: false as const, error: 'Ce code est déjà pris par un autre établissement' }
    throw e
  }
  await audit({ action: 'MESSAGING_SETTINGS_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId })
  return { success: true as const }
}

export async function getQuickReplies() {
  const ctx = await ctxFor()
  if (!ctx) return []
  return (await messagingSettings(ctx.orgId)).quickReplies
}

/**
 * Simulation d'un message reçu (responsables, tant que le connecteur du canal n'est pas branché) :
 * tout le parcours se voit dans la boîte et le journal, sans rien envoyer à personne.
 */
export async function simulateInbound(input: { phone: string; text: string; channel: 'SMS' | 'WHATSAPP'; buttonId?: string }) {
  const ctx = await ctxFor()
  if (!ctx || !ctx.can('settings.manage')) return { success: false as const, error: 'Non autorisé' }
  const channel = input.channel === 'WHATSAPP' ? 'WHATSAPP' : 'SMS'
  if ((await getIntegration(channel)).live) return { success: false as const, error: 'Le connecteur est branché : écrivez depuis un vrai téléphone.' }
  const phone = normalizePhone(input.phone)
  if (!phone) return { success: false as const, error: 'Numéro invalide' }
  if (!(await rateLimit(`simulate:${ctx.userId}`, 60, 3600_000))) return { success: false as const, error: 'Trop de simulations : réessayez plus tard' }
  // Le message est rattaché à votre établissement (comme si le visiteur citait votre code)
  await prisma.conversation.upsert({ where: { organizationId_phone: { organizationId: ctx.orgId, phone } }, create: { organizationId: ctx.orgId, phone, channel }, update: { lastMessageAt: new Date() } })
  const conv = await handleInbound({ channel, from: phone, text: input.text.slice(0, 1000), buttonId: input.buttonId ?? null })
  return conv ? { success: true as const, id: conv.id } : { success: false as const, error: 'Message non rattaché' }
}
