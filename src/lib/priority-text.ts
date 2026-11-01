// Libellés de priorité, utilisables côté navigateur comme côté serveur (aucun accès à la base)

export const PRIORITY_LEVELS = { 2: 'Prioritaire', 3: 'Très prioritaire' } as const

/** Libellé affiché d'une priorité : le motif s'il est connu, sinon le niveau. */
export function priorityText(score: number, reason?: string | null) {
  if (score <= 1) return null
  return reason || PRIORITY_LEVELS[score >= 3 ? 3 : 2]
}
