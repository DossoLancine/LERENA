import { signIn, type SignInOptions } from 'next-auth/react'

/**
 * Connexion par identifiants, robuste au premier chargement : la vérification de session lancée à l'ouverture
 * de la page peut renouveler le jeton anti-falsification (CSRF) pendant l'envoi du formulaire, et NextAuth refuse
 * alors la connexion sans message. Dans ce cas seulement, on recommence une fois avec le jeton à jour.
 */
export async function signInWithCredentials(options: SignInOptions) {
  const first = await signIn('credentials', { ...options, redirect: false })
  if (first?.ok || !first?.url?.includes('csrf=true')) return first
  return signIn('credentials', { ...options, redirect: false })
}
