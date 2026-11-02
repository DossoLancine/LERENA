import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Limites de débit des actions publiques (prise de ticket, réservation, mot de passe oublié, erreurs signalées).
// Compteur en base : fonctionne sur plusieurs serveurs à la fois ; les lignes de plus d'un jour sont purgées.

export const RATE_LIMITED = 'Trop de demandes en peu de temps : patientez quelques minutes puis réessayez.'

/** Adresse du visiteur derrière le proxy de l'hébergeur. */
export function requestIp() {
  try {
    const h = headers()
    return (h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? '').split(',')[0].trim().slice(0, 64) || null
  } catch {
    return null
  }
}

/** true si l'action est permise (et la compte) ; false si la limite est atteinte sur la fenêtre. */
export async function rateLimit(key: string, max: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs)
  const n = await prisma.rateEvent.count({ where: { key, createdAt: { gte: since } } })
  if (n >= max) return false
  await prisma.rateEvent.create({ data: { key } })
  return true
}

/** Plusieurs limites à la fois (ex. par personne et par adresse) : toutes doivent passer. */
export async function rateLimitAll(rules: { key: string | null; max: number; windowMs: number }[]) {
  for (const r of rules) {
    if (r.key && !(await rateLimit(r.key, r.max, r.windowMs))) return false
  }
  return true
}

export const MIN = 60_000
export const HOUR = 3_600_000
