import { createHash, randomInt } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendSms } from '@/lib/sms'

// Codes de vérification à 4 chiffres envoyés par SMS. Seule une empreinte du code est stockée.

export type OtpPurpose = 'GUEST_TICKET' | 'RESET_PIN'

const TTL_MIN = 10
const MAX_ATTEMPTS = 5
const MAX_SENDS_PER_HOUR = 3

function hash(phone: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? ''
  return createHash('sha256').update(`${phone}:${code}:${secret}`).digest('hex')
}

export async function sendOtp(phone: string, purpose: OtpPurpose) {
  const recent = await prisma.phoneVerification.count({
    where: { phone, purpose, createdAt: { gte: new Date(Date.now() - 3600_000) } }
  })
  if (recent >= MAX_SENDS_PER_HOUR) return { ok: false as const, error: 'Trop de demandes de code. Réessayez dans une heure.' }

  const code = randomInt(0, 10_000).toString().padStart(4, '0')
  await prisma.phoneVerification.create({
    data: { phone, purpose, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) }
  })

  const sent = await sendSms(phone, `ATTENDS : votre code est ${code}. Il expire dans ${TTL_MIN} minutes.`)
  return sent ? { ok: true as const } : { ok: false as const, error: "Le SMS n'a pas pu être envoyé." }
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
