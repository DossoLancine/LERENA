import { createHash, randomBytes } from 'crypto'

// Secrets des appareils et des liens d'installation.
// Le secret n'existe en clair que chez son détenteur (l'appareil, le lien affiché une fois) ;
// la base ne garde que son empreinte SHA-256 : une fuite de la base ne permet pas de s'en servir.

/** Secret aléatoire de 256 bits, utilisable dans une adresse (base64url, 43 caractères). */
export function newSecret(bytes = 32) {
  return randomBytes(bytes).toString('base64url')
}

export function hashSecret(secret: string) {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

/** Format plausible d'un secret reçu : on écarte tout de suite les valeurs absurdes. */
export function isPlausibleSecret(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 32 && value.length <= 100 && /^[A-Za-z0-9_-]+$/.test(value)
}
