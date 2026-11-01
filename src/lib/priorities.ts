import { prisma } from '@/lib/prisma'
export { PRIORITY_LEVELS, priorityText } from '@/lib/priority-text'

// Priorités : chaque établissement définit ses motifs (Paramètres → Priorités).
// Niveau 1 = sans priorité, 2 = prioritaire, 3 = très prioritaire. Dans une file, un niveau plus élevé
// passe devant ; à niveau égal, l'ordre d'arrivée dans la file (un client transféré se place derrière le dernier arrivé).

// Motifs créés pour chaque nouvel établissement (modifiables ensuite)
export const DEFAULT_PRIORITIES = [
  { label: 'Personne en situation de handicap', level: 2, selfService: true },
  { label: 'Femme enceinte', level: 2, selfService: true },
  { label: 'Personne âgée', level: 2, selfService: true },
  { label: 'Urgence', level: 3, selfService: false }
]

export class PriorityError extends Error {}

/**
 * Niveau et motif d'un ticket, décidés côté serveur à partir du motif choisi.
 * staff = accueil ou agent : peut attribuer tous les motifs ; sinon seulement ceux ouverts au visiteur.
 */
export async function resolvePriority(orgId: string, priorityId: string | null | undefined, staff: boolean) {
  if (!priorityId) return { score: 1, reason: null as string | null }
  const category = await prisma.priorityCategory.findFirst({
    where: { id: priorityId, organizationId: orgId, isActive: true },
    select: { label: true, level: true, selfService: true }
  })
  if (!category) throw new PriorityError('Ce motif de priorité n’existe plus. Choisissez-en un autre.')
  if (!staff && !category.selfService) throw new PriorityError('Cette priorité est attribuée par l’accueil.')
  return { score: Math.min(3, Math.max(2, category.level)), reason: category.label }
}

/** Motifs proposés : au visiteur (application, borne) ou au personnel (accueil). */
export async function priorityOptions(orgId: string, audience: 'visitor' | 'staff') {
  return prisma.priorityCategory.findMany({
    where: { organizationId: orgId, isActive: true, ...(audience === 'visitor' ? { selfService: true } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, level: true }
  })
}

