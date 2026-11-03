import { describe, expect, it } from 'vitest'
import { guessField, importPhone, mapRows, parseCsv } from '@/lib/customer-import'

describe('import de visiteurs', () => {
  it('lit un CSV Excel français (point-virgule, guillemets, BOM)', () => {
    const rows = parseCsv('﻿Nom;Téléphone;Notes\r\n"Koné; Aya";07 01 02 03 04;"Dit ""bonjour"""\r\n\r\nYao;0505050505;\n')
    expect(rows).toEqual([['Nom', 'Téléphone', 'Notes'], ['Koné; Aya', '07 01 02 03 04', 'Dit "bonjour"'], ['Yao', '0505050505', '']])
  })

  it('détecte la virgule comme séparateur', () => {
    expect(parseCsv('name,phone\nAya,0701020304')).toEqual([['name', 'phone'], ['Aya', '0701020304']])
  })

  it('reconnaît les colonnes usuelles', () => {
    expect(['Nom et prénoms', 'Prénoms', 'Tél.', 'Contact', 'N° de téléphone', 'Étiquettes', 'Remarques', 'Accord SMS', 'Ville'].map(guessField))
      .toEqual(['name', 'firstName', 'phone', 'phone', 'phone', 'tags', 'note', 'consent', 'ignore'])
  })

  it('met les numéros ivoiriens au format international', () => {
    expect(importPhone('07 01 02 03 04')).toBe('+2250701020304')
    expect(importPhone('00225 05 05 05 05 05')).toBe('+2250505050505')
    expect(importPhone('2250707070707')).toBe('+2250707070707')
    expect(importPhone('+225 07.01.02.03.04')).toBe('+2250701020304')
    expect(importPhone('01020304')).toBeNull() // ancien format à 8 chiffres
    expect(importPhone('+33 6 12 34 56 78')).toBe('+33612345678')
    expect(importPhone('')).toBeNull()
  })

  it('assemble prénom et nom, étiquettes, accord, et signale les lignes invalides', () => {
    const { valid, invalid } = mapRows(
      [['Aya', 'Koné', '0701020304', 'VIP, Diabète', 'oui'], ['Yao', '', 'abc', '', ''], ['', '', '0505050505', '', 'non']],
      ['firstName', 'lastName', 'phone', 'tags', 'consent'],
      { consentAll: false }
    )
    expect(valid).toEqual([
      { name: 'Aya Koné', phone: '+2250701020304', tags: ['VIP', 'Diabète'], note: null, consent: true },
      { name: null, phone: '+2250505050505', tags: [], note: null, consent: false }
    ])
    expect(invalid).toEqual([{ line: 3, value: 'abc' }])
  })
})
