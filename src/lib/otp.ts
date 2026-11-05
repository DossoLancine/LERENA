import { createHash, randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendSmsWithStatus, sendWhatsAppMessage } from '@/lib/messaging'
import { getIntegration } from '@/lib/integrations'
import { AUTH_TEMPLATE } from '@/lib/whatsapp-templates'

// Codes de vérification envoyés par WhatsApp (s'il est branché) ou par SMS. Seule une empreinte du code est stockée.
// Connexion : 6 chiffres ; ticket sans compte et récupération du code PIN : 4 chiffres (habitude des visiteurs).

export type OtpPurpose = 'GUEST_TICKET' | 'RESET_PIN' | 'LOGIN'

const TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MAX_SENDS_PER_HOUR = 3

function hash(phone: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? ''
  return createHash('sha256').update(`${phone}:${code}:${secret}`).digest('hex')
}

/** Environnement de test : sans fournisseur branché, les codes sont simulés et lisibles dans Console → Messages. */
export const testEnvironment = () => process.env.ATTENDS_ENV !== 'production'

/** Canal qui portera le code : WhatsApp s'il est branché, SMS sinon ; null si aucun (et hors environnement de test). */
export async function codeChannel(): Promise<'WHATSAPP' | 'SMS' | null> {
  const [wa, sms] = await Promise.all([getIntegration('WHATSAPP'), getIntegration('SMS')])
  if (wa.live) return 'WHATSAPP'
  if (sms.live) return 'SMS'
  return testEnvironment() ? 'SMS' : null
}

export async function sendOtp(phone: string, purpose: OtpPurpose) {
  const recent = await prisma.phoneVerification.count({
    where: { phone, purpose, createdAt: { gte: new Date(Date.now() - 3600_000) } }
  })
  if (recent >= MAX_SENDS_PER_HOUR) return { ok: false as const, error: 'Trop de demandes de code. Réessayez dans une heure.' }

  const channel = await codeChannel()
  if (!channel) return { ok: false as const, error: 'L’envoi de codes n’est pas encore disponible.' }

  const digits = purpose === 'LOGIN' ? 6 : 4
  const code = randomInt(0, 10 ** digits).toString().padStart(digits, '0')
  await prisma.phoneVerification.create({
    data: { phone, purpose, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) }
  })

  const text = `Lerena : votre code est ${code}. Il expire dans ${TTL_MIN} minutes. Ne le communiquez à personne.`
  let status: string
  if (channel === 'WHATSAPP') {
    // Modèle « authentification » validé par Meta ; repli automatique sur le SMS
    const r = await sendWhatsAppMessage({ to: phone, text, template: { name: AUTH_TEMPLATE.name, language: 'fr', params: [code] }, purpose: 'OTP' })
    status = r.status
  } else {
    status = await sendSmsWithStatus({ to: phone, text, purpose: 'OTP' })
  }
  const delivered = status === 'SENT' || (status === 'SIMULATED' && testEnvironment())
  return delivered ? { ok: true as const, channel } : { ok: false as const, error: 'Le code n’a pas pu être envoyé. Réessayez dans un instant.' }
}

export async function verifyOtp(phone: string, purpose: OtpPurpose, code: string) {
  const entry = await prisma.phoneVerification.findFirst({
    where: { phone, purpose, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  })
  if (!entry || entry.attempts >= MAX_ATTEMPTS) return false

  if (entry.codeHash !== hash(phone, code.trim())) {
    await prisma.phoneVerification.update({ where: { id: entry.id }, data: { attempts: { increment: 1 } } })
    return false
  }

  // Code utilisé : on le supprime pour qu'il ne serve qu'une fois
  await prisma.phoneVerification.deleteMany({ where: { phone, purpose } })
  return true
}
