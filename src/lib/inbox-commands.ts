// Messages reçus des visiteurs : reconnaissance des commandes du menu (pas un robot de conversation)
// et textes des réponses automatiques. Sans accès à la base : testé à part.

export type Command =
  | { kind: 'STOP' } | { kind: 'MENU' } | { kind: 'MY_TICKET' } | { kind: 'MY_APPT' } | { kind: 'CANCEL_APPT' } | { kind: 'HUMAN' }
  | { kind: 'TAKE_TICKET'; code: string } | { kind: 'YES' } | { kind: 'NO' } | { kind: 'CHOICE'; n: number } | { kind: 'TEXT' }

export type BotState = 'TICKET_SERVICE' | 'CONFIRM_CANCEL' | null

const clean = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[.!?,;:]+$/g, '').replace(/\s+/g, ' ').trim()

const BUTTONS: Record<string, Command> = {
  CMD_TICKET: { kind: 'MY_TICKET' }, CMD_RDV: { kind: 'MY_APPT' }, CMD_ANNULER: { kind: 'CANCEL_APPT' }, CMD_ACCUEIL: { kind: 'HUMAN' },
  CMD_MENU: { kind: 'MENU' }, CMD_OUI: { kind: 'YES' }, CMD_NON: { kind: 'NO' }
}

/** Commande d'un message, selon l'étape en cours (un chiffre choisit un service pendant la prise de ticket). */
export function parseCommand(text: string, opts: { buttonId?: string | null; state?: BotState } = {}): Command {
  if (opts.buttonId) {
    if (BUTTONS[opts.buttonId]) return BUTTONS[opts.buttonId]
    const svc = /^SVC_(\d{1,2})$/.exec(opts.buttonId)
    if (svc) return { kind: 'CHOICE', n: Number(svc[1]) }
  }
  const t = clean(text ?? '')
  if (!t) return { kind: 'TEXT' }
  if (/^(stop|arret|desabonner|desinscrire)\b/.test(t)) return { kind: 'STOP' }
  if (opts.state === 'TICKET_SERVICE' && /^\d{1,2}$/.test(t)) return { kind: 'CHOICE', n: Number(t) }
  if (opts.state === 'CONFIRM_CANCEL') {
    if (/^(oui|o|yes|ok|d accord|confirme|confirmer)$/.test(t)) return { kind: 'YES' }
    if (/^(non|n|no)$/.test(t)) return { kind: 'NO' }
  }
  const take = /^ticket ([a-z0-9-]{2,12})$/.exec(t)
  if (take) return { kind: 'TAKE_TICKET', code: take[1].toUpperCase() }
  if (/^(1|mon ticket|ticket|mon numero)$/.test(t)) return { kind: 'MY_TICKET' }
  if (/^(2|rdv|rendez vous|rendez-vous|mon rdv|mon rendez vous|mon rendez-vous)$/.test(t)) return { kind: 'MY_APPT' }
  if (/^(3|annuler|annuler mon rdv|annuler mon rendez vous|annuler mon rendez-vous|annulation)$/.test(t)) return { kind: 'CANCEL_APPT' }
  if (/^(4|accueil|humain|agent|conseiller|parler a l accueil|parler a quelqu un|parler a un agent)$/.test(t)) return { kind: 'HUMAN' }
  if (/^(0|menu|aide|help|options|bonjour|bonsoir|salut|allo)$/.test(t)) return { kind: 'MENU' }
  return { kind: 'TEXT' }
}

export const MENU_BUTTONS = [
  { id: 'CMD_TICKET', title: 'Mon ticket' },
  { id: 'CMD_RDV', title: 'Mon rendez-vous' },
  { id: 'CMD_ANNULER', title: 'Annuler mon RDV' },
  { id: 'CMD_ACCUEIL', title: 'Parler à l’accueil' }
]

export const menuText = (org: string) =>
  `${org} : répondez par un chiffre.\n1. Mon ticket\n2. Mon rendez-vous\n3. Annuler mon rendez-vous\n4. Parler à l'accueil`

export const defaultAway = (org: string) =>
  `${org} est fermé pour le moment. Votre message est bien reçu : l'accueil vous répondra à la réouverture.`

export const ackText = (org: string) => `${org} : merci, votre message est transmis à l'accueil.`

/** Code proposé pour un établissement : initiales du nom (« Hôpital Mère-Enfant » → HME). */
export function suggestCode(name: string) {
  const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(w => w && !['DE', 'DU', 'DES', 'LA', 'LE', 'LES', 'ET', 'L', 'D'].includes(w))
  const initials = words.map(w => w[0]).join('')
  return (initials.length >= 2 ? initials : words.join('')).slice(0, 8) || 'LERENA'
}

export const isValidCode = (code: string) => /^[A-Z0-9-]{2,12}$/.test(code)
