// Assistant d'analyse intégré : thèmes des commentaires des visiteurs (dictionnaire de mots-clés en français et en
// nouchi courant), masquage des données personnelles, réponses proposées. Sans service extérieur, sans base de données.

export const THEMES = {
  WAIT: { label: 'Attente', words: ['attente', 'attendre', 'attendu', 'attends', 'long', 'longue', 'lent', 'lente', 'lenteur', 'trop de monde', 'file', 'queue', 'retard', 'tard', 'heures', 'doucement', 'ca traine', 'ça traîne', 'gaspiller', 'perdu mon temps', 'perte de temps', 'pas vite'] },
  WELCOME: { label: 'Accueil et politesse', words: ['accueil', 'impoli', 'malpoli', 'poli', 'polie', 'personnel', 'agent', 'agents', 'gentil', 'gentille', 'aimable', 'desagreable', 'mepris', 'meprisant', 'crier', 'crie', 'parle mal', 'respect', 'souriant', 'souriante', 'sourire', 'mal parle', 'arrogant', 'arrogante', 'ignore', 'ignoree'] },
  ORIENTATION: { label: 'Orientation et informations', words: ['erreur', 'oubli', 'oublie', 'mauvais guichet', 'oriente', 'orientation', 'renvoye', 'envoye ailleurs', 'information', 'informations', 'explication', 'explique', 'compris', 'perdu', 'perdue', 'ballade', 'balade', 'on ma envoye'] },
  COMFORT: { label: 'Propreté et confort', words: ['propre', 'proprete', 'sale', 'salete', 'toilettes', 'wc', 'odeur', 'chaud', 'chaleur', 'climatisation', 'clim', 'ventilateur', 'chaise', 'chaises', 'assis', 'debout', 'confort', 'soleil', 'place', 'gate', 'gâté'] },
  PRICE: { label: 'Prix et paiement', words: ['prix', 'cher', 'chere', 'cout', 'payer', 'paye', 'argent', 'tarif', 'frais', 'monnaie', 'mobile money', 'wave', 'orange money'] },
  APP: { label: 'Application et ticket', words: ['application', 'appli', 'ticket', 'sms', 'notification', 'bug', 'ecran', 'numero appele', 'telephone', 'borne', 'qr'] },
  SPEED: { label: 'Rapidité', words: ['rapide', 'rapidement', 'vite', 'efficace', 'efficacite', 'pas attendu', 'sans attendre', 'fluide'] },
  KINDNESS: { label: 'Gentillesse de l’équipe', words: ['merci', 'gentil', 'gentille', 'aimable', 'souriant', 'souriante', 'accueillant', 'accueillante', 'patient', 'patiente', 'bien recu', 'bien accueilli'] }
} as const
export type ThemeId = keyof typeof THEMES

const NEGATIVE_THEMES: ThemeId[] = ['WAIT', 'WELCOME', 'ORIENTATION', 'COMFORT', 'PRICE', 'APP']
const POSITIVE_THEMES: ThemeId[] = ['SPEED', 'KINDNESS', 'WELCOME', 'APP']

const plain = (s: string) => ` ${s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `

/** Thèmes d'un commentaire. Une note de 4 ou 5 se lit côté « ce qui plaît », une note de 3 ou moins côté « ce qui déplaît ». */
export function themesOf(comment: string, rating: number): ThemeId[] {
  const text = plain(comment)
  const pool = rating >= 4 ? POSITIVE_THEMES : NEGATIVE_THEMES
  return pool.filter(id => THEMES[id].words.some(w => text.includes(` ${plain(w).trim()} `)))
}

// Nom annoncé par une civilité (« Madame Koné ») ; construit à l'exécution pour l'option Unicode
const CIVILITY = new RegExp("\\b(M\\.|Mr|Monsieur|Mme|Madame|Mlle|Mademoiselle|Dr|Docteur|Doctoresse|Maman|Tonton|Tantie)\\s+[A-ZÀ-Ý][\\p{L}'-]+", 'gu')

/**
 * Masque les données personnelles d'un commentaire avant affichage d'une citation ou envoi à une IA :
 * numéros, e-mails, et noms connus (visiteurs, équipe) ou annoncés par une civilité.
 */
export function anonymize(text: string, knownNames: string[] = []) {
  let out = text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]')
    .replace(/\+?\d[\d\s.-]{6,}\d/g, '[numéro]')
    .replace(CIVILITY, '$1 [nom]')
  const tokens = Array.from(new Set(knownNames.flatMap(n => n.split(/\s+/)).filter(t => t.length >= 3)))
  // Limites de mot qui tiennent compte des lettres accentuées (\b ne les connaît pas)
  for (const t of tokens) out = out.replace(new RegExp(`(?<![\\p{L}\\d])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\d])`, 'giu'), '[nom]')
  return out
}

export interface CommentInput { comment: string; rating: number }

/** Part de chaque thème parmi les commentaires classés, avec une citation (la plus courte, déjà anonymisée par l'appelant). */
export function themeBreakdown(items: CommentInput[]) {
  const pick = (positive: boolean) => {
    const rows = items.filter(i => (positive ? i.rating >= 4 : i.rating <= 3) && i.comment.trim())
    const tagged = rows.map(r => ({ ...r, themes: themesOf(r.comment, r.rating) })).filter(r => r.themes.length)
    const counts = new Map<ThemeId, { n: number; quote: string }>()
    for (const r of tagged) for (const t of r.themes) {
      const cur = counts.get(t)
      const quote = !cur || r.comment.length < cur.quote.length ? r.comment : cur.quote
      counts.set(t, { n: (cur?.n ?? 0) + 1, quote })
    }
    return {
      total: rows.length, classified: tagged.length,
      themes: Array.from(counts, ([id, v]) => ({ id, label: THEMES[id].label, count: v.n, share: Math.round((v.n / Math.max(1, tagged.length)) * 100), quote: v.quote.slice(0, 160) }))
        .sort((a, b) => b.count - a.count)
    }
  }
  return { negative: pick(false), positive: pick(true) }
}

const REPLIES: Record<string, string> = {
  WAIT: 'Bonjour{prenom}, merci pour votre retour. Nous sommes désolés pour l’attente lors de votre passage chez {org}. Nous renforçons l’équipe aux heures les plus chargées. Pouvons-nous vous rappeler pour en parler ?',
  WELCOME: 'Bonjour{prenom}, merci de nous avoir signalé l’accueil reçu chez {org}. Ce n’est pas ce que nous voulons pour nos visiteurs : nous en parlons avec l’équipe. Toutes nos excuses.',
  ERROR: 'Bonjour{prenom}, nous sommes désolés pour l’erreur lors de votre passage chez {org}. Nous voulons la corriger : pouvez-vous nous rappeler ou répondre à ce message ?',
  CLEANLINESS: 'Bonjour{prenom}, merci pour votre retour sur le confort de notre salle d’attente chez {org}. Nous avons transmis à l’équipe pour y remédier rapidement.',
  OTHER: 'Bonjour{prenom}, merci d’avoir pris le temps de donner votre avis sur {org}. Nous sommes désolés que votre passage ne se soit pas bien passé. Pouvons-nous vous rappeler pour en parler ?'
}

/** Réponse proposée à un avis négatif, selon son motif (ou le thème détecté dans le commentaire), à relire avant envoi. */
export function suggestReply(input: { reason: string | null; comment: string | null; rating: number; orgName: string; firstName?: string | null }) {
  const fromTheme = input.comment ? themesOf(input.comment, input.rating)[0] : undefined
  const key = input.reason && REPLIES[input.reason] ? input.reason
    : fromTheme === 'WAIT' ? 'WAIT' : fromTheme === 'WELCOME' ? 'WELCOME' : fromTheme === 'ORIENTATION' ? 'ERROR' : fromTheme === 'COMFORT' ? 'CLEANLINESS' : 'OTHER'
  return REPLIES[key].replace('{prenom}', input.firstName ? ` ${input.firstName}` : '').replace('{org}', input.orgName)
}
