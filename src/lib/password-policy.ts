// Règles de mot de passe, communes à l'inscription, à la réinitialisation et au changement.
// Clients : PIN d'au moins 6 chiffres (saisie facile sur téléphone) ou mot de passe de 8 caractères et plus.
// Personnel et administrateurs : 8 caractères minimum, avec des lettres et au moins un chiffre.

const WEAK = ['123456', '000000', '111111', '123123', '654321', '12345678', 'password', 'motdepasse', 'azerty123', 'password123']

export function passwordProblem(password: string, role: string = 'CLIENT'): string | null {
  if (!password) return 'Choisissez un mot de passe'
  if (WEAK.includes(password.toLowerCase())) return 'Ce code est trop facile à deviner'
  if (role === 'CLIENT' && /^\d+$/.test(password)) {
    if (password.length < 6) return 'Le code PIN doit contenir au moins 6 chiffres'
    if (/^(\d)\1+$/.test(password)) return 'Ce code est trop facile à deviner'
    return null
  }
  if (password.length < 8) return role === 'CLIENT' ? 'Utilisez un code PIN de 6 chiffres ou un mot de passe de 8 caractères' : 'Le mot de passe doit contenir au moins 8 caractères'
  if (role !== 'CLIENT' && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) return 'Utilisez des lettres et au moins un chiffre'
  return null
}
