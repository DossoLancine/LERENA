// Politique de double authentification, lisible aussi par le middleware (aucun accès à la base ici).
// Obligatoire en production pour les rôles sensibles ; en test elle est seulement recommandée.
// ENFORCE_2FA=1 / 0 force l'un ou l'autre comportement, quel que soit l'environnement.

export const TWO_FACTOR_ROLES = ['SUPER_ADMIN', 'ORG_ADMIN'] as const

export function twoFactorEnforced() {
  const v = process.env.ENFORCE_2FA?.trim().toLowerCase()
  if (v === '1' || v === 'true') return true
  if (v === '0' || v === 'false') return false
  return process.env.ATTENDS_ENV === 'production'
}

/** Rôle pour lequel la double authentification est conseillée (bandeau) ou exigée (production). */
export const twoFactorSensitive = (role?: string | null) => !!role && (TWO_FACTOR_ROLES as readonly string[]).includes(role)

/** Rôle qui ne peut pas accéder à son espace sans double authentification active. */
export const twoFactorRequiredFor = (role?: string | null) => twoFactorEnforced() && twoFactorSensitive(role)
