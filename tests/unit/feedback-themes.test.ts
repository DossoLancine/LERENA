import { describe, expect, it } from 'vitest'
import { anonymize, suggestReply, themeBreakdown, themesOf } from '@/lib/feedback-themes'

// 20 commentaires écrits comme le feraient des visiteurs (fautes, nouchi, sans accents) et le thème attendu
const SAMPLES: [string, number, string][] = [
  ['Trop d attente, 2 heures pour rien', 1, 'WAIT'],
  ['vraiment c est lent dêh', 2, 'WAIT'],
  ['On a attendu longtemps debout au soleil', 2, 'WAIT'],
  ['La dame de l accueil était impolie', 1, 'WELCOME'],
  ['agent desagreable qui crie sur les gens', 1, 'WELCOME'],
  ['Personnel arrogant', 2, 'WELCOME'],
  ['On m a envoyé au mauvais guichet deux fois', 2, 'ORIENTATION'],
  ['Pas d information, j étais perdu', 2, 'ORIENTATION'],
  ['Les toilettes sont sales', 2, 'COMFORT'],
  ['Il fait trop chaud, pas de clim', 3, 'COMFORT'],
  ['Pas assez de chaises', 3, 'COMFORT'],
  ['C est trop cher pour le service', 2, 'PRICE'],
  ['Le SMS n est jamais arrivé', 2, 'APP'],
  ['Mon ticket a disparu de l application', 2, 'APP'],
  ['Service rapide merci', 5, 'SPEED'],
  ['Très efficace, je n ai pas attendu', 5, 'SPEED'],
  ['Personnel gentil et souriant', 5, 'KINDNESS'],
  ['Merci pour l accueil', 4, 'KINDNESS'],
  ['ça traîne trop', 2, 'WAIT'],
  ['erreur sur mon dossier', 2, 'ORIENTATION']
]

describe('assistant d’analyse', () => {
  it('classe au moins 4 commentaires sur 5 dans leur thème', () => {
    const ok = SAMPLES.filter(([c, r, t]) => themesOf(c, r).includes(t as never)).length
    expect(ok / SAMPLES.length).toBeGreaterThanOrEqual(0.8)
  })

  it('répartition des thèmes et citation la plus courte', () => {
    const b = themeBreakdown(SAMPLES.map(([comment, rating]) => ({ comment, rating })))
    expect(b.negative.themes[0].id).toBe('WAIT')
    expect(b.positive.total).toBe(4)
  })

  it('masque numéros, e-mails et noms', () => {
    expect(anonymize('Appelez-moi au 07 01 02 03 04 ou a.kone@mail.ci')).toBe('Appelez-moi au [numéro] ou [e-mail]')
    expect(anonymize('Madame Koné était impolie')).toBe('Madame [nom] était impolie')
    expect(anonymize('Awa Traoré m a bien reçu', ['Awa Traoré'])).toBe('[nom] [nom] m a bien reçu')
  })

  it('réponse proposée selon le motif, sinon selon le thème', () => {
    expect(suggestReply({ reason: 'WAIT', comment: null, rating: 1, orgName: 'Clinique Lagune', firstName: 'Aya' })).toMatch(/^Bonjour Aya, .*attente.*Clinique Lagune/)
    expect(suggestReply({ reason: null, comment: 'agent impoli', rating: 1, orgName: 'X' })).toContain('l’accueil reçu')
  })
})
