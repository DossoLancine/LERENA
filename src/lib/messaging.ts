import { prisma } from '@/lib/prisma'
import { deliverSms } from '@/lib/sms'
import { deliverEmail, type EmailContent } from '@/lib/email'
import { deliverWhatsApp, type WhatsAppButton, type WhatsAppTemplate } from '@/lib/whatsapp'
import { templateForPurpose, templateParam } from '@/lib/whatsapp-templates'
import { smsParts, toGsm } from '@/lib/campaign-text'
import { getIntegration } from '@/lib/integrations'

// Envoi des e-mails, SMS et messages WhatsApp, toujours journalisés (table OutboundMessage) :
// - chaque envoi est visible dans la console (Messages) et compté par établissement ;
// - les prestataires se règlent dans la console → Intégrations ; un connecteur en simulation ne fait rien partir,
//   mais tous les parcours se testent (message « simulé » dans le journal) ;
// - un envoi raté est réessayé une fois ; WhatsApp indisponible ou en échec → SMS.

export type MessagePurpose =
  | 'RESET_PASSWORD' | 'OTP' | 'WELCOME' | 'TEMP_PASSWORD' | 'TURN_SOON'
  | 'APPOINTMENT_CONFIRMED' | 'APPOINTMENT_NEW' | 'APPOINTMENT_REMINDER' | 'APPOINTMENT_CANCELLED' | 'APPOINTMENT_MISSED' | 'FOLLOW_UP' | 'CAMPAIGN' | 'DIRECT' | 'COMPLAINT_NEW' | 'COMPLAINT_REPLY' | 'INVOICE' | 'ANNOUNCEMENT'
  | 'REPORT' | 'ALERT' | 'TEST' | 'SHOP_ORDER' | 'CONVERSATION'

type Status = 'SENT' | 'FAILED' | 'SIMULATED' | 'SKIPPED'
type Channel = 'SMS' | 'EMAIL' | 'WHATSAPP'

async function log(entry: { channel: Channel; to: string; subject?: string; body: string; purpose: MessagePurpose; status: Status; provider?: string; error?: string; organizationId?: string | null; ticketId?: string | null; parts?: number }) {
  try {
    await prisma.outboundMessage.create({ data: { ...entry, subject: entry.subject ?? null, provider: entry.provider ?? null, error: entry.error?.slice(0, 300) ?? null, organizationId: entry.organizationId ?? null, ticketId: entry.ticketId ?? null } })
  } catch (error) {
    console.error('Journal des messages :', error)
  }
}

/** Un essai, puis un second après une courte pause (coupure réseau, opérateur momentanément indisponible). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    await new Promise(r => setTimeout(r, 800))
    return fn()
  }
}

export async function emailEnabled() {
  return (await getIntegration('EMAIL')).live
}

/** E-mail transactionnel. Renvoie true s'il est parti (ou simulé hors production). */
export async function sendEmail(input: { to: string; subject: string; text: string; html?: string; attachments?: EmailContent['attachments']; purpose: MessagePurpose; organizationId?: string | null }) {
  const base = { channel: 'EMAIL' as const, to: input.to, subject: input.subject, body: input.text, purpose: input.purpose, organizationId: input.organizationId }
  const c = await getIntegration('EMAIL')
  if (!c.live) {
    await log({ ...base, status: 'SIMULATED', provider: c.provider })
    return true
  }
  try {
    const provider = await withRetry(() => deliverEmail({ to: input.to, subject: input.subject, text: input.text, html: input.html, attachments: input.attachments }))
    await log({ ...base, status: 'SENT', provider })
    return true
  } catch (error) {
    await log({ ...base, status: 'FAILED', provider: c.provider, error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/** SMS. Sans fournisseur, le message est simulé (journalisé) et la fonction renvoie false. */
export async function sendSmsMessage(input: { to: string; text: string; purpose: MessagePurpose; organizationId?: string | null; ticketId?: string | null }) {
  return (await sendSmsWithStatus(input)) === 'SENT'
}

/** Comme sendSmsMessage, avec le résultat : envoyé, simulé (pas de fournisseur), échec, ou non envoyé faute de SMS. */
export async function sendSmsWithStatus(input: { to: string; text: string; purpose: MessagePurpose; organizationId?: string | null; ticketId?: string | null }): Promise<Status> {
  input = { ...input, text: toGsm(input.text) }
  const parts = smsParts(input.text).parts
  const base = { channel: 'SMS' as const, to: input.to, body: input.text, purpose: input.purpose, organizationId: input.organizationId, ticketId: input.ticketId, parts }
  // SMS d'un établissement : quota mensuel du forfait, puis packs achetés (import tardif : billing utilise ce module)
  if (input.organizationId) {
    const { consumeSms } = await import('@/lib/billing')
    if (!(await consumeSms(input.organizationId, parts).catch(() => true))) {
      await log({ ...base, status: 'SKIPPED', error: 'Plus de SMS : quota du mois et packs épuisés' })
      return 'SKIPPED'
    }
  }
  const c = await getIntegration('SMS')
  if (!c.live) {
    await log({ ...base, status: 'SIMULATED', provider: c.provider })
    return 'SIMULATED'
  }
  try {
    await withRetry(() => deliverSms(input.to, input.text))
    await log({ ...base, status: 'SENT', provider: c.provider })
    return 'SENT'
  } catch (error) {
    await log({ ...base, status: 'FAILED', provider: c.provider, error: error instanceof Error ? error.message : String(error) })
    return 'FAILED'
  }
}

/**
 * Message à un visiteur par WhatsApp, avec bascule sur le SMS si WhatsApp n'est pas branché ou échoue
 * (fallbackToSms, par défaut). Renvoie le canal finalement utilisé et le résultat.
 */
export async function sendWhatsAppMessage(input: { to: string; text: string; template?: WhatsAppTemplate; buttons?: WhatsAppButton[]; purpose: MessagePurpose; organizationId?: string | null; ticketId?: string | null; fallbackToSms?: boolean }): Promise<{ channel: Channel; status: Status }> {
  const base = { channel: 'WHATSAPP' as const, to: input.to, body: input.text, purpose: input.purpose, organizationId: input.organizationId, ticketId: input.ticketId }
  const c = await getIntegration('WHATSAPP')
  const fallback = input.fallbackToSms !== false
  if (!c.live) {
    if (fallback) return { channel: 'SMS', status: await sendSmsWithStatus(input) }
    await log({ ...base, status: 'SIMULATED', provider: c.provider })
    return { channel: 'WHATSAPP', status: 'SIMULATED' }
  }
  try {
    const provider = await withRetry(() => deliverWhatsApp(input.to, input.text, input.template, undefined, input.buttons))
    await log({ ...base, status: 'SENT', provider })
    return { channel: 'WHATSAPP', status: 'SENT' }
  } catch (error) {
    await log({ ...base, status: 'FAILED', provider: c.provider, error: error instanceof Error ? error.message : String(error) })
    if (fallback) return { channel: 'SMS', status: await sendSmsWithStatus(input) }
    return { channel: 'WHATSAPP', status: 'FAILED' }
  }
}

/**
 * Message à un visiteur sur le meilleur canal : WhatsApp quand le connecteur est branché (texte libre si le visiteur
 * a écrit dans les 24 h, sinon le modèle validé du motif), SMS sinon ou en cas d'échec.
 * Le message apparaît aussi dans la conversation du visiteur s'il en a une.
 */
export async function sendToVisitor(input: { to: string; text: string; purpose: MessagePurpose; organizationId?: string | null; ticketId?: string | null }): Promise<{ channel: Channel; status: Status }> {
  const wa = await getIntegration('WHATSAPP')
  let result: { channel: Channel; status: Status }
  const conv = input.organizationId ? await prisma.conversation.findUnique({ where: { organizationId_phone: { organizationId: input.organizationId, phone: input.to } }, select: { id: true, lastInboundAt: true } }).catch(() => null) : null
  if (wa.live) {
    const open = !!conv?.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() < 24 * 3600_000
    const def = templateForPurpose(input.purpose)
    let template: WhatsAppTemplate | undefined
    if (!open && def) {
      const org = input.organizationId ? await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { name: true } }) : null
      const name = org?.name ?? 'Lerena'
      const body = input.text.startsWith(`${name} : `) ? input.text.slice(name.length + 3) : input.text
      template = { name: def.name, language: 'fr', params: [templateParam(name), templateParam(body)] }
    }
    result = await sendWhatsAppMessage({ ...input, template })
  } else {
    result = { channel: 'SMS', status: await sendSmsWithStatus(input) }
  }
  if (conv) {
    await prisma.$transaction([
      prisma.conversationMessage.create({ data: { conversationId: conv.id, direction: 'OUT', channel: result.channel, body: input.text, auto: true, status: result.status, parts: result.channel === 'SMS' ? smsParts(input.text).parts : 1 } }),
      prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date() } })
    ]).catch(() => null)
  }
  return result
}

/** Adresse publique de l'application, pour les liens envoyés par e-mail. */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Identifiants d'un compte créé avec un mot de passe provisoire (affiché aussi une fois à l'écran).
 * La personne devra le changer à sa première connexion.
 */
export async function sendCredentialsEmail(input: { to: string; name?: string | null; password: string; organizationId?: string | null; place?: string }) {
  return sendEmail({
    to: input.to,
    subject: 'Votre accès à Lerena',
    text: `Bonjour${input.name ? ' ' + input.name : ''},\n\nUn compte Lerena a été créé pour vous${input.place ? ` (${input.place})` : ''}.\n\nAdresse de connexion : ${appUrl()}/pro/login\nIdentifiant : ${input.to}\nMot de passe provisoire : ${input.password}\n\nÀ la première connexion, vous choisirez votre propre mot de passe.\n\nL’équipe Lerena`,
    purpose: 'TEMP_PASSWORD',
    organizationId: input.organizationId
  })
}
