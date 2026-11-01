import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto'

// Double authentification par application (Google Authenticator, Microsoft Authenticator, Authy…) :
// codes à 6 chiffres renouvelés toutes les 30 secondes (TOTP, RFC 6238).
// Le secret est chiffré en base (AES-256-GCM) avec TWO_FACTOR_KEY, ou à défaut une clé dérivée de NEXTAUTH_SECRET.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = ''
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(text: string) {
  const clean = text.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20))
}

/** Code à 6 chiffres pour une période de 30 s donnée (compteur = temps / 30 s). */
export function totpCode(secret: string, counter: number) {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 15
  const bin = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(bin % 1_000_000).padStart(6, '0')
}

/** Vérifie un code en tolérant un décalage d'horloge de ±30 s. */
export function verifyTotp(secret: string, code: string, now = Date.now()) {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const counter = Math.floor(now / 30_000)
  for (const delta of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, counter + delta))
    if (timingSafeEqual(expected, Buffer.from(clean))) return true
  }
  return false
}

export function otpauthUrl(secret: string, account: string, issuer = 'Lerena') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
}

// ---- Chiffrement du secret en base ----

function key() {
  const material = process.env.TWO_FACTOR_KEY || `${process.env.NEXTAUTH_SECRET ?? ''}:two-factor`
  return createHash('sha256').update(material).digest()
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.')
}

export function decryptSecret(stored: string) {
  const [iv, tag, data] = stored.split('.').map(p => Buffer.from(p, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

// ---- Codes de secours (si le téléphone est perdu) ----

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(5)).slice(0, 8)
    return `${raw.slice(0, 4)}-${raw.slice(4)}`
  })
}

export const hashRecoveryCode = (code: string) =>
  createHash('sha256').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex')
