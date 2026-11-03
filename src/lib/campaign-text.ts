// Texte des SMS de l'établissement : variables, modèles prêts à l'emploi, nombre de parties.
// Utilisable côté navigateur (aperçu en direct) comme côté serveur (envoi).

export const VARIABLES = [
  { key: '{prénom}', label: 'Prénom', sample: 'Aya' },
  { key: '{établissement}', label: 'Établissement', sample: '' },
  { key: '{lien}', label: 'Lien de réservation', sample: '' },
  { key: '{service}', label: 'Dernier service', sample: 'Consultation' },
  { key: '{date}', label: 'Prochain rendez-vous', sample: 'mardi 12 novembre' }
] as const

export interface MessageValues {
  firstName: string | null
  orgName: string
  link: string
  service: string | null
  nextDate: string | null
}

/** Remplace les variables ; une variable sans valeur disparaît proprement (espaces et virgules en trop retirés). */
export function renderMessage(body: string, v: MessageValues) {
  return normalizeSms(body)
    .replace(/\{pr[ée]nom\}/gi, v.firstName ?? '')
    .replace(/\{[ée]tablissement\}/gi, v.orgName)
    .replace(/\{lien\}/gi, v.link)
    .replace(/\{service\}/gi, v.service ?? '')
    .replace(/\{date\}/gi, v.nextDate ?? '')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/^[,\s]+/, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

/** Ponctuation typographique ramenée à l'alphabet SMS : le message reste en 160 caractères par partie. */
export const normalizeSms = (text: string) => text
  .replace(/[\u2018\u2019\u02bc]/g, "'").replace(/\u00ab[\s\u00a0\u202f]*/g, '"').replace(/[\s\u00a0\u202f]*\u00bb/g, '"').replace(/[\u201c\u201d]/g, '"')
  .replace(/\u2026/g, '...').replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2013\u2014]/g, '-')

export const firstNameOf = (name: string | null) => {
  const first = name?.trim().split(/\s+/)[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : null
}

export const stopFooter = (base: string, token: string) => `\nSTOP : ${base.replace(/^https?:\/\//, '')}/stop/${token}`

// Alphabet SMS standard (GSM 03.38) : au-delà, le message passe en Unicode (70 caractères par partie au lieu de 160)
const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXT = '^{}\\[~]|€'

export function smsParts(text: string) {
  let gsm = true
  let length = 0
  for (const ch of text) {
    if (GSM.includes(ch)) length += 1
    else if (GSM_EXT.includes(ch)) length += 2
    else { gsm = false; break }
  }
  if (!gsm) length = Array.from(text).length
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  const parts = length <= single ? 1 : Math.ceil(length / multi)
  return { length, parts, unicode: !gsm, perPart: parts === 1 ? single : multi }
}

export const MAX_BODY = 320

export const TEMPLATES = [
  { id: 'closure', label: 'Fermeture exceptionnelle', body: 'Bonjour {prénom}, {établissement} sera exceptionnellement fermé le [date]. Merci de votre compréhension. Prendre un ticket ou un rendez-vous : {lien}' },
  { id: 'documents', label: 'Documents prêts', body: "Bonjour {prénom}, vos documents sont prêts chez {établissement}. Passez les retirer aux heures d'ouverture, sans attendre : {lien}" },
  { id: 'vaccination', label: 'Campagne de vaccination', body: 'Bonjour {prénom}, campagne de vaccination chez {établissement} du [date] au [date]. Réservez votre passage : {lien}' },
  { id: 'renewal', label: 'Rappel de renouvellement', body: 'Bonjour {prénom}, pensez à renouveler votre {service} chez {établissement}. Réservez votre créneau : {lien}' },
  { id: 'new-service', label: 'Nouveau service', body: 'Bonjour {prénom}, nouveau chez {établissement} : [service]. Prenez rendez-vous dès maintenant : {lien}' }
] as const
