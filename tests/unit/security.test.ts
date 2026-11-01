import { describe, expect, it } from 'vitest'
import { hashSecret, isPlausibleSecret, newSecret } from '@/lib/secrets'
import { tempPassword } from '@/lib/passwords'
import { clientIp } from '@/lib/login-guard'

describe('secrets des appareils et liens d’installation', () => {
  it('génère des secrets longs, uniques et utilisables dans une adresse', () => {
    const a = newSecret()
    const b = newSecret()
    expect(a).not.toBe(b)
    expect(a).toHaveLength(43)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('stocke une empreinte stable qui ne révèle pas le secret', () => {
    const s = newSecret()
    expect(hashSecret(s)).toBe(hashSecret(s))
    expect(hashSecret(s)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSecret(s)).not.toContain(s)
  })
  it('écarte les valeurs absurdes', () => {
    expect(isPlausibleSecret(newSecret())).toBe(true)
    expect(isPlausibleSecret('court')).toBe(false)
    expect(isPlausibleSecret('x'.repeat(200))).toBe(false)
    expect(isPlausibleSecret("abc'; DROP TABLE x; --abcdefghijklmnopqrstuv")).toBe(false)
    expect(isPlausibleSecret(42)).toBe(false)
  })
})

describe('mots de passe provisoires', () => {
  it('sont lisibles (sans caractères ambigus) et de bonne longueur', () => {
    const pw = tempPassword()
    expect(pw).toHaveLength(10)
    expect(pw).not.toMatch(/[0O1lI]/)
  })
})

describe('adresse IP du visiteur (anti-force brute)', () => {
  it('prend la première adresse transmise par l’hébergeur', () => {
    expect(clientIp({ 'x-forwarded-for': '41.202.1.5, 10.0.0.1' })).toBe('41.202.1.5')
    expect(clientIp({ 'x-real-ip': '41.202.1.6' })).toBe('41.202.1.6')
    expect(clientIp({})).toBeNull()
    expect(clientIp(undefined)).toBeNull()
  })
})
