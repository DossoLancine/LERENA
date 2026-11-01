import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpCode, verifyTotp } from '@/lib/totp'

describe('double authentification (TOTP)', () => {
  it('reproduit le vecteur de test officiel RFC 6238 (SHA-1)', () => {
    // Secret « 12345678901234567890 » en base32, T = 59 s → 287082 (6 derniers chiffres de 94287082)
    expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', Math.floor(59 / 30))).toBe('287082')
    expect(totpCode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', Math.floor(1111111109 / 30))).toBe('081804')
  })
  it('accepte le code courant et un décalage de ±30 s, refuse le reste', () => {
    const secret = generateTotpSecret()
    const now = 1_800_000_000_000
    const counter = Math.floor(now / 30_000)
    expect(verifyTotp(secret, totpCode(secret, counter), now)).toBe(true)
    expect(verifyTotp(secret, totpCode(secret, counter - 1), now)).toBe(true)
    expect(verifyTotp(secret, totpCode(secret, counter + 3), now)).toBe(false)
    expect(verifyTotp(secret, 'abc', now)).toBe(false)
  })
  it('chiffre le secret en base et le relit', () => {
    process.env.NEXTAUTH_SECRET = 'test-secret'
    const secret = generateTotpSecret()
    const stored = encryptSecret(secret)
    expect(stored).not.toContain(secret)
    expect(decryptSecret(stored)).toBe(secret)
  })
  it('produit des codes de secours lisibles dont l’empreinte ignore tirets et casse', () => {
    const codes = generateRecoveryCodes()
    expect(codes).toHaveLength(8)
    expect(codes[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/)
    expect(hashRecoveryCode(codes[0])).toBe(hashRecoveryCode(codes[0].toLowerCase().replace('-', '')))
  })
})
