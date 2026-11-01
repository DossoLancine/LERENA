import { describe, expect, it } from 'vitest'
import { queueForService } from '@/lib/ticketing'

// Files réelles de l'Hôpital Mère-Enfant (cas qui a révélé le bug « CONSULTATION » → « Consultation générale »)
const queues = [
  { name: 'File Pédiatrie', prefix: 'P' },
  { name: 'File Urgences', prefix: 'U' },
  { name: 'File Caisse', prefix: 'K' },
  { name: 'File Consultation générale', prefix: 'C' },
  { name: 'File CONSULTATION', prefix: 'CO' },
  { name: 'File Pharmacie', prefix: 'F' },
  { name: 'File Générale', prefix: 'A' }
]
const route = (name: string) => queueForService({ name, branch: { queues } }).name

describe('aiguillage d’un service vers sa file', () => {
  it('préfère le nom exact, même avec une casse différente', () => {
    expect(route('CONSULTATION')).toBe('File CONSULTATION')
    expect(route('Consultation générale')).toBe('File Consultation générale')
  })
  it('prend la correspondance la plus proche', () => {
    expect(route('Pédiatrie & Vaccinations')).toBe('File Pédiatrie')
    expect(route('Urgences & Soins Rapides')).toBe('File Urgences')
  })
  it('ignore les accents', () => {
    expect(route('Pediatrie')).toBe('File Pédiatrie')
  })
  it('se rabat sur la lettre du ticket, puis sur la première file', () => {
    expect(route('Accueil & orientation')).toBe('File Générale')
    expect(route('Service inconnu')).toBe('File Pédiatrie')
  })
})
