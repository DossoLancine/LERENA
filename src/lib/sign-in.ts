import { signIn, type SignInOptions } from 'next-auth/react'

/**
 * Connexion par identifiants, robuste au premier chargement : la vérification de session lancée à l'ouverture
 * de la page peut renouveler le jeton anti-falsification (CSRF) pendant l'envoi du formulaire, et NextAuth refuse
 * alors la connexion sans message. Dans ce cas seulement, on recommence une fois avec le jeton à jour.
 * Fournisseur : mot de passe (par défaut), code reçu par SMS ou WhatsApp, lien reçu par e-mail.
 */
export async function signInWithCredentials(options: SignInOptions, provider: 'credentials' | 'phone-code' | 'email-link' = 'credentials') {
  const first = await signIn(provider, { ...options, redirect: false })
  if (first?.ok || !first?.url?.includes('csrf=true')) return first
  return signIn(provider, { ...options, redirect: false })
}

/** Page d'arrivée après connexion : l'espace du rôle (les visiteurs arrivent sur l'exploration). */
export async function destinationAfterSignIn(homeForRole: (role: never) => string) {
  const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => null)
  const role = session?.user?.role
  return !role || role === 'CLIENT' ? '/explore' : homeForRole(role as never)
}

/** Messages des erreurs renvoyées par Google ou Microsoft (paramètre ?error=). */
export const SSO_ERRORS: Record<string, string> = {
  SSO_NO_EMAIL: 'Ce compte ne communique pas d’adresse e-mail vérifiée : choisissez un autre compte.',
  SSO_UNKNOWN: 'Aucun compte d’équipe n’est inscrit avec cette adresse : demandez à votre responsable de vous ajouter dans Équipe.',
  SSO_ROLE: 'Ce compte se connecte avec son mot de passe et sa double authentification.',
  AccessDenied: 'Connexion refusée.',
  OAuthSignin: 'La connexion n’a pas pu démarrer : réessayez.',
  OAuthCallback: 'La connexion n’a pas abouti : réessayez.',
  Callback: 'La connexion n’a pas abouti : réessayez.'
}
