import { randomInt } from 'crypto'

// Mot de passe provisoire lisible (sans 0/O ni 1/l), communiqué une seule fois à la création du compte
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function tempPassword(length = 10) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}
