// Import de listes de visiteurs (export Excel en CSV) : lecture, colonnes reconnues, numéros ivoiriens.
// Sans accès à la base : utilisé par l'aperçu dans le navigateur et par l'import côté serveur.

export const MAX_IMPORT_ROWS = 5000

/** Lit un CSV (séparateur « ; », « , » ou tabulation, détecté sur la 1re ligne), guillemets compris. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'))
  const counts = [';', ',', '\t'].map(d => [d, firstLine.split(d).length - 1] as const)
  const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ';'

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row) }
  return rows.filter(r => r.some(c => c !== ''))
}

export type ImportField = 'name' | 'firstName' | 'lastName' | 'phone' | 'tags' | 'note' | 'consent' | 'ignore'

export const FIELD_LABELS: Record<ImportField, string> = {
  name: 'Nom complet', firstName: 'Prénom', lastName: 'Nom de famille', phone: 'Téléphone',
  tags: 'Étiquettes', note: 'Note', consent: 'Accord pour les messages', ignore: 'Ne pas importer'
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Colonne reconnue d'après son en-tête (« Téléphone », « Tel », « Contact », « Prénoms »…). */
export function guessField(header: string): ImportField {
  const h = plain(header)
  if (/^(tel|telephone|phone|mobile|portable|cellulaire|contact|numero|num|gsm|whatsapp)\b/.test(h) || /\b(tel|telephone|phone|mobile|numero)\b/.test(h)) return 'phone'
  if (/^prenoms?\b|first ?name/.test(h)) return 'firstName'
  if (/^nom de famille|last ?name|^surname/.test(h)) return 'lastName'
  if (/^(nom|name|noms|nom complet|patient|client|visiteur|nom et prenoms?)\b/.test(h)) return 'name'
  if (/etiquette|tag|categorie|groupe|segment/.test(h)) return 'tags'
  if (/note|remarque|commentaire|observation/.test(h)) return 'note'
  if (/consent|accord|sms ok|opt ?in|accepte/.test(h)) return 'consent'
  return 'ignore'
}

/**
 * Numéro saisi à la main dans un tableur → format international. Côte d'Ivoire par défaut :
 * « 07 01 02 03 04 » → +2250701020304, « 00225… » → +225…, « 225… » → +225…
 */
export function importPhone(raw: string, countryCode = '+225'): string | null {
  let d = raw.replace(/[^\d+]/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = `+${d.slice(2)}`
  const cc = countryCode.replace('+', '')
  if (!d.startsWith('+')) {
    if (d.startsWith(cc) && d.length > cc.length + 7) d = `+${d}`
    else d = `+${cc}${d}`
  }
  // Côte d'Ivoire : 10 chiffres après l'indicatif depuis 2021
  if (d.startsWith('+225') && d.length !== 14) return null
  return /^\+\d{8,15}$/.test(d) ? d : null
}

const YES = /^(oui|o|yes|y|1|x|ok|vrai|true|accepte|d accord)$/

export const consentValue = (raw: string | undefined) => (raw ? YES.test(plain(raw)) : false)

export interface ImportRow {
  name: string | null
  phone: string
  tags: string[]
  note: string | null
  consent: boolean
}

/** Applique la correspondance des colonnes ; renvoie les lignes valides et celles à revoir (numéro absent ou invalide). */
export function mapRows(rows: string[][], mapping: ImportField[], opts: { consentAll: boolean; countryCode?: string }) {
  const valid: ImportRow[] = []
  const invalid: { line: number; value: string }[] = []
  rows.slice(0, MAX_IMPORT_ROWS).forEach((r, i) => {
    const get = (f: ImportField) => mapping.map((m, j) => (m === f ? r[j] ?? '' : '')).filter(Boolean)
    const rawPhone = get('phone')[0] ?? ''
    const phone = importPhone(rawPhone, opts.countryCode)
    if (!phone) { invalid.push({ line: i + 2, value: rawPhone || '(vide)' }); return }
    const name = [get('name').join(' '), get('firstName').join(' '), get('lastName').join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    valid.push({
      name: name ? name.slice(0, 60) : null,
      phone,
      tags: get('tags').flatMap(t => t.split(/[,|/]/)).map(t => t.trim().slice(0, 30)).filter(Boolean).slice(0, 10),
      note: get('note').join(' · ').slice(0, 1000) || null,
      consent: opts.consentAll || consentValue(get('consent')[0])
    })
  })
  return { valid, invalid }
}
