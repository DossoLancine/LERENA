import { describe, expect, it, vi } from 'vitest'

// cache() de React n'existe que dans le serveur Next : ici, simple passe-plat
vi.mock('react', () => ({ cache: <T,>(fn: T) => fn }))
import { priorityText } from '@/lib/priority-text'
import { parseSectorServices } from '@/lib/platform'
import { monthRange } from '@/lib/metrics'

describe('libellé de priorité', () => {
  it('affiche le motif s’il existe, sinon le niveau', () => {
    expect(priorityText(1)).toBeNull()
    expect(priorityText(2)).toBe('Prioritaire')
    expect(priorityText(3)).toBe('Très prioritaire')
    expect(priorityText(2, 'Femme enceinte')).toBe('Femme enceinte')
  })
})

describe('modèles de services d’un secteur (données venant de la base)', () => {
  it('nettoie les valeurs et ignore les entrées invalides', () => {
    const services = parseSectorServices([
      { name: 'Caisse', durationMin: 5, prefix: 'k1', icon: 'banknote' },
      { name: '', durationMin: 10, prefix: 'A' },
      { name: 'Très long', durationMin: 9999, prefix: 'abcd' },
      null,
      'texte'
    ])
    expect(services).toEqual([
      { name: 'Caisse', durationMin: 5, prefix: 'K', icon: 'banknote' },
      { name: 'Très long', durationMin: 240, prefix: 'ABC', icon: undefined }
    ])
  })
  it('renvoie une liste vide si le contenu n’est pas une liste', () => {
    expect(parseSectorServices({ name: 'x' })).toEqual([])
    expect(parseSectorServices(null)).toEqual([])
  })
})

describe('période du rapport mensuel', () => {
  it('couvre le mois demandé du 1er au 1er du mois suivant', () => {
    const r = monthRange('2026-02')
    expect(r.month).toBe('2026-02')
    expect(r.from.getMonth()).toBe(1)
    expect(r.to.getMonth()).toBe(2)
  })
  it('prend le mois en cours si la valeur est invalide', () => {
    const now = new Date()
    expect(monthRange('n’importe quoi').from.getMonth()).toBe(now.getMonth())
  })
})
