'use server'

import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { sendOtp } from '@/lib/otp'
import { availableSignInMethods, passwordlessAllowed } from '@/lib/auth-methods'
import { appUrl, sendEmail } from '@/lib/messaging'
import { hashSecret, newSecret } from '@/lib/secrets'
import { HOUR, RATE_LIMITED, rateLimitAll, requestIp } from '@/lib/rate-limit'

// Connexion sans mot de passe (visiteurs) : code par SMS ou WhatsApp, lien par e-mail. Méthodes proposées selon les connecteurs.

const LINK_TTL_MIN = 15
const GENERIC = 'Si cette adresse peut se connecter ainsi, un lien vient de partir. Il est valable 15 minutes.'

/** Méthodes affichées sur les pages de connexion. */
export async function getSignInMethods() {
  return availableSignInMethods()
}

/** Code de connexion à 6 chiffres. Un numéro inconnu peut créer son compte (il acceptera les conditions à l'étape suivante). */
export async function requestLoginCode(phoneInput: string) {
  const phone = normalizePhone(phoneInput)
  if (!phone) return { success: false as const, error: 'Numéro invalide' }
  const ip = requestIp()
  if (!(await rateLimitAll([{ key: `login-code:${phone}`, max: 5, windowMs: HOUR }, { key: ip && `login-code:ip:${ip}`, max: 20, windowMs: HOUR }]))) {
    return { success: false as const, error: RATE_LIMITED }
  }
  const user = await prisma.user.findUnique({ where: { phone }, select: { role: true } })
  // Un compte d'équipe ne se connecte pas par code : aucun message n'est envoyé
  if (user && !passwordlessAllowed(user.role)) return { success: false as const, error: 'Ce numéro appartient à un compte d’équipe : connectez-vous avec votre mot de passe sur l’espace Pro.' }
  const res = await sendOtp(phone, 'LOGIN')
  if (!res.ok) return { success: false as const, error: res.error }
  return { success: true as const, channel: res.channel, isNew: !user }
}

/** Lien de connexion par e-mail. Même réponse que l'adresse soit connue ou non. */
export async function requestEmailLink(emailInput: string, acceptTerms: boolean) {
  const email = emailInput?.trim().toLowerCase() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return { success: false as const, error: 'Adresse e-mail invalide' }
  const ip = requestIp()
  if (!(await rateLimitAll([{ key: `login-link:${email}`, max: 3, windowMs: HOUR }, { key: ip && `login-link:ip:${ip}`, max: 15, windowMs: HOUR }]))) {
    return { success: false as const, error: RATE_LIMITED }
  }
  const methods = await availableSignInMethods()
  if (!methods.emailLink) return { success: false as const, error: 'La connexion par e-mail n’est pas encore disponible.' }
  const user = await prisma.user.findUnique({ where: { email }, select: { role: true, name: true } })
  // Compte d'équipe, ou adresse inconnue sans acceptation des conditions : rien ne part, réponse identique
  if ((user && !passwordlessAllowed(user.role)) || (!user && !acceptTerms)) return { success: true as const, message: GENERIC }
  const token = newSecret()
  await prisma.loginToken.create({ data: { email, tokenHash: hashSecret(token), acceptTerms: !!acceptTerms, expiresAt: new Date(Date.now() + LINK_TTL_MIN * 60_000) } })
  await sendEmail({
    to: email,
    subject: 'Votre lien de connexion Lerena',
    text: `Bonjour${user?.name ? ' ' + user.name : ''},\n\nPour vous connecter à Lerena, ouvrez ce lien (valable ${LINK_TTL_MIN} minutes, une seule fois) :\n${appUrl()}/auth/link?token=${token}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.\n\nL’équipe Lerena`,
    purpose: 'OTP'
  })
  return { success: true as const, message: GENERIC }
}
