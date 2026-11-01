import { prisma } from '@/lib/prisma'

// Protection contre les essais de mots de passe en série (force brute).
// Trop d'échecs récents pour un même compte ou une même adresse IP : connexion refusée un moment.

const WINDOW_MS = 15 * 60_000
const MAX_PER_IDENTIFIER = 5
const MAX_PER_IP = 20

export const LOCKED_MESSAGE = 'Trop de tentatives. Réessayez dans 15 minutes.'

const keys = (identifier: string, ip: string | null) => [`id:${identifier}`, ...(ip ? [`ip:${ip}`] : [])]

/** Le compte ou l'adresse IP est-il temporairement bloqué ? */
export async function isLocked(identifier: string, ip: string | null) {
  const since = new Date(Date.now() - WINDOW_MS)
  const [byId, byIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: `id:${identifier}`, createdAt: { gte: since } } }),
    ip ? prisma.loginAttempt.count({ where: { key: `ip:${ip}`, createdAt: { gte: since } } }) : 0
  ])
  return byId >= MAX_PER_IDENTIFIER || byIp >= MAX_PER_IP
}

export async function recordFailure(identifier: string, ip: string | null) {
  await prisma.loginAttempt.createMany({ data: keys(identifier, ip).map(key => ({ key })) })
  // Ménage : les échecs de plus d'un jour ne servent plus
  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86400_000) } } })
}

/** Connexion réussie : les échecs passés de ce compte sont oubliés. */
export async function clearFailures(identifier: string) {
  await prisma.loginAttempt.deleteMany({ where: { key: `id:${identifier}` } })
}

/** Adresse IP du visiteur, transmise par l'hébergeur (première adresse de x-forwarded-for). */
export function clientIp(headers: Record<string, unknown> | undefined) {
  const raw = headers?.['x-forwarded-for'] ?? headers?.['x-real-ip']
  const value = Array.isArray(raw) ? raw[0] : typeof raw === 'string' ? raw : null
  return value ? value.split(',')[0].trim().slice(0, 64) : null
}
