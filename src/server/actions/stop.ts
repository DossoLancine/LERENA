'use server'

import { prisma } from '@/lib/prisma'
import { rateLimit, requestIp } from '@/lib/rate-limit'
import { optOutCustomers } from '@/lib/campaigns'

// Désinscription des messages d'information d'un établissement (lien « STOP » des campagnes). Page publique.

const valid = (token: string) => /^[A-Za-z0-9_-]{6,20}$/.test(token)

export async function getUnsubscribe(token: string) {
  if (!valid(token)) return null
  const c = await prisma.customer.findUnique({ where: { unsubToken: token }, select: { optedOutAt: true, organization: { select: { name: true } } } })
  return c ? { orgName: c.organization.name, done: !!c.optedOutAt } : null
}

/** Un clic de la personne (jamais à l'ouverture du lien : les aperçus de lien ne désinscrivent pas). */
export async function confirmUnsubscribe(token: string) {
  if (!valid(token)) return { success: false as const }
  if (!(await rateLimit(`stop:${requestIp() ?? 'unknown'}`, 20, 3600_000))) return { success: false as const }
  await optOutCustomers({ unsubToken: token })
  return { success: true as const }
}
