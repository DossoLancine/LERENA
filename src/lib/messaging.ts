import { prisma } from '@/lib/prisma'
import { sendSms } from '@/lib/sms'

// Envoi des e-mails et SMS, toujours journalisés (table OutboundMessage) :
// - chaque envoi est visible dans l'administration (Messages) et compté par établissement ;
// - sans fournisseur configuré, le message est « simulé » : rien ne part, mais on peut tester tous les parcours.
//
// E-mail : RESEND_API_KEY + EMAIL_FROM (ex. « Lerena <noreply@lerena.ci> »).
// SMS : SMS_PROVIDER (voir src/lib/sms.ts).

export type MessagePurpose =
  | 'RESET_PASSWORD' | 'OTP' | 'WELCOME' | 'TEMP_PASSWORD' | 'TURN_SOON'
  | 'APPOINTMENT_CONFIRMED' | 'APPOINTMENT_NEW' | 'APPOINTMENT_REMINDER' | 'APPOINTMENT_CANCELLED' | 'INVOICE' | 'ANNOUNCEMENT'

type Status = 'SENT' | 'FAILED' | 'SIMULATED' | 'SKIPPED'

async function log(entry: { channel: 'SMS' | 'EMAIL'; to: string; subject?: string; body: string; purpose: MessagePurpose; status: Status; provider?: string; error?: string; organizationId?: string | null; ticketId?: string | null }) {
  try {
    await prisma.outboundMessage.create({ data: { ...entry, subject: entry.subject ?? null, provider: entry.provider ?? null, error: entry.error?.slice(0, 300) ?? null, organizationId: entry.organizationId ?? null, ticketId: entry.ticketId ?? null } })
  } catch (error) {
    console.error('Journal des messages :', error)
  }
}

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY
}

/** E-mail transactionnel. Renvoie true s'il est parti (ou simulé hors production). */
export async function sendEmail(input: { to: string; subject: string; text: string; purpose: MessagePurpose; organizationId?: string | null }) {
  const base = { channel: 'EMAIL' as const, to: input.to, subject: input.subject, body: input.text, purpose: input.purpose, organizationId: input.organizationId }
  if (!emailEnabled()) {
    await log({ ...base, status: 'SIMULATED' })
    return true
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Lerena <onboarding@resend.dev>',
        to: [input.to],
        subject: input.subject,
        text: input.text
      })
    })
    if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 200)}`)
    await log({ ...base, status: 'SENT', provider: 'resend' })
    return true
  } catch (error) {
    await log({ ...base, status: 'FAILED', provider: 'resend', error: error instanceof Error ? error.message : String(error) })
    return false
  }
}

/** SMS. Sans fournisseur, le message est simulé (journalisé) et la fonction renvoie false. */
export async function sendSmsMessage(input: { to: string; text: string; purpose: MessagePurpose; organizationId?: string | null; ticketId?: string | null }) {
  const base = { channel: 'SMS' as const, to: input.to, body: input.text, purpose: input.purpose, organizationId: input.organizationId, ticketId: input.ticketId }
  // SMS d'un établissement : quota mensuel du forfait, puis packs achetés (import tardif : billing utilise ce module)
  if (input.organizationId) {
    const { consumeSms } = await import('@/lib/billing')
    if (!(await consumeSms(input.organizationId).catch(() => true))) {
      await log({ ...base, status: 'SKIPPED', error: 'Plus de SMS : quota du mois et packs épuisés' })
      return false
    }
  }
  if (!process.env.SMS_PROVIDER) {
    await log({ ...base, status: 'SIMULATED' })
    return false
  }
  const ok = await sendSms(input.to, input.text).catch(() => false)
  await log({ ...base, status: ok ? 'SENT' : 'FAILED', provider: process.env.SMS_PROVIDER })
  return ok
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
