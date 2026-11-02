import { prisma } from '@/lib/prisma'
export { PRIORITY_LEVELS, priorityText } from '@/lib/priority-text'

// Priorités : chaque établissement définit ses motifs (Paramètres → Priorités).
// Niveau 1 = sans priorité, 2 = prioritaire, 3 = très prioritaire. Dans une file, un niveau plus élevé
// passe devant ; à niveau égal, l'ordre d'arrivée dans la file (un client transféré se place derrière le dernier arrivé).
//
// Qui attribue une priorité :
// - l'accueil (personnel) : tous les motifs actifs ;
// - le visiteur, dans l'application ou à la borne : seulement si l'établissement a activé ce canal
//   (désactivé par défaut) et seulement les motifs « proposés aux visiteurs ».

export type PriorityChannel = 'staff' | 'app' | 'kiosk'

// Motifs créés pour chaque nouvel établissement (modifiables ensuite)
export const DEFAULT_PRIORITIES = [
  { label: 'Personne en situation de handicap', level: 2, selfService: true },
  { label: 'Femme enceinte', level: 2, selfService: true },
  { label: 'Personne âgée', level: 2, selfService: true },
  { label: 'Urgence', level: 3, selfService: false }
]

// Erreur « métier » attendue (message affiché à la personne) : pas un incident à surveiller
export class PriorityError extends Error { readonly expected = true }

/** Le visiteur peut-il choisir une priorité sur ce canal ? (réglage de l'établissement) */
async function channelOpen(orgId: string, channel: PriorityChannel) {
  if (channel === 'staff') return true
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { visitorPriorityApp: true, visitorPriorityKiosk: true }
  })
  return channel === 'app' ? !!org?.visitorPriorityApp : !!org?.visitorPriorityKiosk
}

/**
 * Niveau et motif d'un ticket, décidés côté serveur à partir du motif choisi.
 * Une demande de priorité sur un canal fermé est ignorée : le ticket reste normal.
 */
export async function resolvePriority(orgId: string, priorityId: string | null | undefined, channel: PriorityChannel) {
  const none = { score: 1, reason: null as string | null }
  if (!priorityId || !(await channelOpen(orgId, channel))) return none
  const category = await prisma.priorityCategory.findFirst({
    where: { id: priorityId, organizationId: orgId, isActive: true },
    select: { label: true, level: true, selfService: true }
  })
  if (!category) throw new PriorityError('Ce motif de priorité n’existe plus. Choisissez-en un autre.')
  if (channel !== 'staff' && !category.selfService) return none
  return { score: Math.min(3, Math.max(2, category.level)), reason: category.label }
}

/** Motifs proposés sur un canal : tous à l'accueil ; côté visiteur, rien si le canal est fermé. */
export async function priorityOptions(orgId: string, channel: PriorityChannel = 'staff') {
  if (!(await channelOpen(orgId, channel))) return []
  return prisma.priorityCategory.findMany({
    where: { organizationId: orgId, isActive: true, ...(channel !== 'staff' ? { selfService: true } : {}) },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, label: true, level: true }
  })
}
