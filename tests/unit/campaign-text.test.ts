import { describe, expect, it } from 'vitest'
import { firstNameOf, renderMessage, smsParts, stopFooter } from '@/lib/campaign-text'

const values = { firstName: 'Aya', orgName: 'Clinique Lagune', link: 'lerena.ci/org/x', service: 'Consultation', nextDate: null }

describe('SMS des campagnes', () => {
  it('remplace les variables, avec ou sans accents', () => {
    expect(renderMessage('Bonjour {prénom}, {établissement} : {lien}', values)).toBe('Bonjour Aya, Clinique Lagune : lerena.ci/org/x')
    expect(renderMessage('Bonjour {prenom} ({etablissement})', values)).toBe('Bonjour Aya (Clinique Lagune)')
  })

  it('retire proprement une variable vide', () => {
    expect(renderMessage('Bonjour {prénom}, votre RDV {date}.', { ...values, firstName: null })).toBe('Bonjour, votre RDV.')
  })

  it('ramène la ponctuation typographique à l’alphabet SMS', () => {
    const text = renderMessage('L’accueil « ouvre »…', values)
    expect(text).toBe('L\'accueil "ouvre"...')
    expect(smsParts(text).unicode).toBe(false)
  })

  it('compte les parties : 160 caractères en alphabet SMS, 70 en Unicode', () => {
    expect(smsParts('a'.repeat(160)).parts).toBe(1)
    expect(smsParts('a'.repeat(161)).parts).toBe(2)
    expect(smsParts('ê'.repeat(70))).toMatchObject({ parts: 1, unicode: true })
    expect(smsParts('é'.repeat(160))).toMatchObject({ parts: 1, unicode: false })
  })

  it('lien STOP court, sans protocole', () => {
    expect(stopFooter('https://lerena1.vercel.app', 'abc')).toBe('\nSTOP : lerena1.vercel.app/stop/abc')
  })

  it('prénom à partir du nom complet', () => {
    expect(firstNameOf('KONÉ Aya')).toBe('Koné')
    expect(firstNameOf(null)).toBeNull()
  })
})
