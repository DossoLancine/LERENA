'use server'

import bcrypt from 'bcryptjs'
import QRCode from 'qrcode'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { twoFactorRequiredFor } from '@/lib/two-factor-policy'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { hashSecret, isPlausibleSecret, newSecret } from '@/lib/secrets'
import { appUrl, sendEmail } from '@/lib/messaging'
import { sendOtp, verifyOtp } from '@/lib/otp'
import { normalizePhone } from '@/lib/phone'
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, otpauthUrl, verifyTotp } from '@/lib/totp'
import { audit } from '@/lib/audit'
import type { Role } from '@/lib/constants'
import { passwordProblem } from '@/lib/password-policy'
import { HOUR, RATE_LIMITED, rateLimitAll, requestIp } from '@/lib/rate-limit'

// Sécurité du compte : mot de passe oublié, changement de mot de passe, double authentification, sessions.

const RESET_TTL_MIN = 60
const MAX_RESETS_PER_HOUR = 3
const GENERIC_SENT = 'Si un compte correspond, vous allez recevoir un lien (e-mail) ou un code (SMS) pour choisir un nouveau mot de passe.'


/** Nouveau mot de passe : toutes les sessions ouvertes sont fermées. */
async function setPassword(userId: string, password: string) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(password, 10), mustChangePassword: false, sessionVersion: { increment: 1 } }
    }),
    prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ])
}

// ---- Mot de passe oublié ----

/** Étape 1 : e-mail → lien ; téléphone → code SMS. Réponse identique que le compte existe ou non. */
export async function requestPasswordReset(identifier: string) {
  const raw = identifier?.trim() ?? ''
  if (!raw) return { success: false as const, error: 'Indiquez votre e-mail ou votre numéro' }
  const addr = requestIp()
  if (!(await rateLimitAll([{ key: `reset:${raw.toLowerCase()}`, max: 3, windowMs: HOUR }, { key: addr && `reset:ip:${addr}`, max: 10, windowMs: HOUR }]))) {
    return { success: false as const, error: RATE_LIMITED }
  }

  if (raw.includes('@')) {
    const user = await prisma.user.findUnique({ where: { email: raw.toLowerCase() }, select: { id: true, email: true, name: true } })
    if (user?.email) {
      const recent = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } })
      if (recent < MAX_RESETS_PER_HOUR) {
        const token = newSecret()
        await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) } })
        await sendEmail({
          to: user.email,
          subject: 'Choisir un nouveau mot de passe — Lerena',
          text: `Bonjour${user.name ? ' ' + user.name : ''},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, une seule fois) :\n${appUrl()}/auth/reset?token=${token}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\nL’équipe Lerena`,
          purpose: 'RESET_PASSWORD'
        })
      }
    }
    return { success: true as const, channel: 'email' as const, message: GENERIC_SENT }
  }

  const phone = normalizePhone(raw)
  if (!phone) return { success: false as const, error: 'Numéro de téléphone invalide' }
  const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
  if (user) await sendOtp(phone, 'RESET_PIN')
  return { success: true as const, channel: 'sms' as const, phone, message: GENERIC_SENT }
}

/** Étape 2 (e-mail) : lien valable, nouveau mot de passe. */
export async function resetPasswordWithToken(token: string, password: string) {
  if (!isPlausibleSecret(token)) return { success: false, error: 'Lien invalide ou expiré' }

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: hashSecret(token) }, include: { user: { select: { role: true } } } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return { success: false, error: 'Lien invalide ou expiré. Refaites une demande.' }
  // Règle selon le type de compte (PIN pour les clients, mot de passe fort pour le personnel)
  const problem = passwordProblem(password, reset.user.role)
  if (problem) return { success: false, error: problem }

  const claimed = await prisma.passwordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } })
  if (claimed.count !== 1) return { success: false, error: 'Ce lien a déjà servi.' }
  await setPassword(reset.userId, password)
  await audit({ action: 'PASSWORD_RESET', targetType: 'User', targetId: reset.userId, details: 'par e-mail' })
  return { success: true }
}

/** Étape 2 (SMS) : code reçu, nouveau mot de passe. */
export async function resetPasswordWithCode(phoneInput: string, code: string, password: string) {
  const phone = normalizePhone(phoneInput)
  const user = phone ? await prisma.user.findUnique({ where: { phone }, select: { id: true, role: true } }) : null
  // Règle vérifiée avant de consommer le code, pour pouvoir corriger sans redemander de SMS
  const problem = passwordProblem(password, user?.role ?? 'CLIENT')
  if (problem) return { success: false, error: problem }
  if (!phone || !user || !(await verifyOtp(phone, 'RESET_PIN', code))) return { success: false, error: 'Code incorrect ou expiré' }
  await setPassword(user.id, password)
  await audit({ action: 'PASSWORD_RESET', targetType: 'User', targetId: user.id, details: 'par SMS' })
  return { success: true }
}

// ---- Compte connecté ----

async function currentUser() {
  const me = await getSessionUser()
  if (!me) return null
  return prisma.user.findUnique({ where: { id: me.id } })
}

/** Changement de mot de passe (obligatoire après un mot de passe provisoire). */
export async function changePassword(current: string, next: string) {
  const user = await currentUser()
  if (!user?.password) return { success: false, error: 'Non connecté' }
  if (!(await bcrypt.compare(current, user.password))) return { success: false, error: 'Mot de passe actuel incorrect' }
  const problem = passwordProblem(next, user.role)
  if (problem) return { success: false, error: problem }
  if (current === next) return { success: false, error: 'Choisissez un mot de passe différent du précédent' }

  // Les autres sessions sont fermées ; celle-ci reste ouverte (même version de session)
  const session = await getServerSession(authOptions)
  const sid = (session as any)?.sid as string | null
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(next, 10), mustChangePassword: false } }),
    prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null, ...(sid ? { id: { not: sid } } : {}) }, data: { revokedAt: new Date() } })
  ])
  await audit({ action: 'PASSWORD_CHANGED', targetType: 'User', targetId: user.id })
  return { success: true }
}

/** Vue « Sécurité du compte » : double authentification et appareils connectés. */
export async function getSecurityOverview() {
  const user = await currentUser()
  if (!user) return null
  const session = await getServerSession(authOptions)
  const sid = (session as any)?.sid as string | null
  const sessions = await prisma.authSession.findMany({
    where: { userId: user.id, revokedAt: null, lastSeenAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    orderBy: { lastSeenAt: 'desc' },
    select: { id: true, userAgent: true, ip: true, createdAt: true, lastSeenAt: true }
  })
  return {
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorRequired: twoFactorRequiredFor(user.role),
    recoveryCodesLeft: user.twoFactorRecovery.length,
    mustChangePassword: user.mustChangePassword,
    sessions: sessions.map(s => ({ ...s, current: s.id === sid, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))
  }
}

/** Étape 1 de l'activation : secret provisoire et QR code à scanner avec l'application. */
export async function startTwoFactorSetup() {
  const user = await currentUser()
  if (!user) return null
  if (user.twoFactorEnabled) return { alreadyEnabled: true as const }
  const secret = generateTotpSecret()
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: encryptSecret(secret) } })
  const url = otpauthUrl(secret, user.email || user.phone || user.id)
  return { alreadyEnabled: false as const, secret, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) }
}

/** Étape 2 : le premier code valide active la protection ; les codes de secours sont montrés une seule fois. */
export async function confirmTwoFactor(code: string) {
  const user = await currentUser()
  if (!user?.twoFactorSecret) return { success: false as const, error: 'Recommencez l’activation' }
  if (!verifyTotp(decryptSecret(user.twoFactorSecret), code)) return { success: false as const, error: 'Code incorrect : vérifiez l’heure du téléphone et réessayez' }
  const recovery = generateRecoveryCodes()
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorRecovery: recovery.map(hashRecoveryCode) }
  })
  await audit({ action: 'TWO_FACTOR_ENABLED', targetType: 'User', targetId: user.id })
  return { success: true as const, recoveryCodes: recovery }
}

/** Désactivation (impossible pour les rôles où elle est obligatoire). */
export async function disableTwoFactor(code: string) {
  const user = await currentUser()
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) return { success: false, error: 'Double authentification non active' }
  if (twoFactorRequiredFor(user.role)) return { success: false, error: 'Obligatoire pour votre rôle : elle ne peut pas être désactivée' }
  if (!verifyTotp(decryptSecret(user.twoFactorSecret), code)) return { success: false, error: 'Code incorrect' }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [] } })
  await audit({ action: 'TWO_FACTOR_DISABLED', targetType: 'User', targetId: user.id })
  return { success: true }
}

/** Déconnecte un appareil (pris effet sous 5 minutes au plus). */
export async function revokeSession(id: string) {
  const user = await currentUser()
  if (!user) return { success: false }
  const res = await prisma.authSession.updateMany({ where: { id, userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
  return { success: res.count > 0 }
}

/** Déconnecte tous les autres appareils, garde celui-ci. */
export async function revokeOtherSessions() {
  const user = await currentUser()
  if (!user) return { success: false }
  const session = await getServerSession(authOptions)
  const sid = (session as any)?.sid as string | null
  await prisma.authSession.updateMany({ where: { userId: user.id, revokedAt: null, ...(sid ? { id: { not: sid } } : {}) }, data: { revokedAt: new Date() } })
  await audit({ action: 'SESSIONS_REVOKED', targetType: 'User', targetId: user.id })
  return { success: true }
}

// ---- Mes données (droits des personnes) ----

/**
 * Demande de copie des données : pas d'export en libre-service. La demande est tracée et transmise
 * à l'équipe Lerena, qui répond sous 30 jours avec l'export de la console (Utilisateurs → exporter).
 */
export async function requestDataCopy() {
  const me = await getSessionUser()
  if (!me) return { success: false as const, error: 'Connectez-vous' }
  const addr = requestIp()
  if (!(await rateLimitAll([{ key: `datareq:${me.id}`, max: 2, windowMs: 24 * HOUR }, { key: addr && `datareq:ip:${addr}`, max: 5, windowMs: 24 * HOUR }]))) {
    return { success: false as const, error: 'Votre demande a déjà été envoyée : nous vous répondons sous 30 jours.' }
  }
  const user = await prisma.user.findUnique({ where: { id: me.id }, select: { name: true, email: true, phone: true } })
  await audit({ action: 'DATA_COPY_REQUESTED', targetType: 'User', targetId: me.id, details: user?.phone ?? user?.email ?? undefined })
  const config = await prisma.platformConfig.findUnique({ where: { id: 'default' }, select: { dpoEmail: true, companyEmail: true } })
  const to = config?.dpoEmail || config?.companyEmail || process.env.ALERT_EMAIL
  if (to) {
    await sendEmail({
      to, purpose: 'ANNOUNCEMENT',
      subject: 'Demande de copie de données personnelles',
      text: `${user?.name ?? 'Un utilisateur'} (${user?.phone ?? user?.email ?? me.id}) demande une copie de ses données.\n\nÀ traiter sous 30 jours : Console → Utilisateurs → rechercher la personne → Exporter, puis lui transmettre le fichier.`
    }).catch(() => null)
  }
  return { success: true as const }
}
