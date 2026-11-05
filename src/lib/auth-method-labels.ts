import { STAFF_ROLES, type Role } from '@/lib/constants'

// Libellés des méthodes de connexion, utilisables côté navigateur (Sécurité du compte)

export type SignInMethod = 'PASSWORD' | 'PHONE_CODE' | 'EMAIL_LINK' | 'GOOGLE' | 'MICROSOFT'
export const METHOD_LABELS: Record<SignInMethod, string> = {
  PASSWORD: 'Mot de passe', PHONE_CODE: 'Code par SMS ou WhatsApp', EMAIL_LINK: 'Lien par e-mail', GOOGLE: 'Google', MICROSOFT: 'Microsoft'
}

/** Connexion sans mot de passe (code, lien) : comptes visiteurs seulement ; les équipes gardent mot de passe et double authentification. */
export const passwordlessAllowed = (role: string) => role === 'CLIENT'
/** Google ou Microsoft : visiteurs et équipes d'établissement ; jamais les comptes d'administration de la plateforme. */
export const ssoAllowed = (role: string) => role === 'CLIENT' || STAFF_ROLES.includes(role as Role)
