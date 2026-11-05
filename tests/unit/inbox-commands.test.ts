import { describe, expect, it } from 'vitest'
import { isValidCode, menuText, parseCommand, suggestCode } from '@/lib/inbox-commands'
import { templateForPurpose, templateParam, WHATSAPP_TEMPLATES } from '@/lib/whatsapp-templates'
import { smsParts } from '@/lib/campaign-text'

const kind = (t: string, o?: Parameters<typeof parseCommand>[1]) => parseCommand(t, o).kind

describe('commandes du menu', () => {
  it('chiffres, mots et boutons', () => {
    expect(kind('1')).toBe('MY_TICKET')
    expect(kind('Mon ticket')).toBe('MY_TICKET')
    expect(kind('2')).toBe('MY_APPT')
    expect(kind('Mon rendez-vous ?')).toBe('MY_APPT')
    expect(kind('3')).toBe('CANCEL_APPT')
    expect(kind('Annuler')).toBe('CANCEL_APPT')
    expect(kind('4')).toBe('HUMAN')
    expect(kind('Parler à l’accueil')).toBe('HUMAN')
    expect(kind('menu')).toBe('MENU')
    expect(kind('Bonjour')).toBe('MENU')
    expect(kind('', { buttonId: 'CMD_RDV' })).toBe('MY_APPT')
    expect(kind('Oui, annuler', { buttonId: 'CMD_OUI' })).toBe('YES')
  })
  it('STOP retire l’accord, même en majuscules ou accentué', () => {
    expect(kind('STOP')).toBe('STOP')
    expect(kind('Arrêt svp')).toBe('STOP')
  })
  it('TICKET suivi d’un code prend un ticket dans cet établissement', () => {
    expect(parseCommand('ticket hme')).toEqual({ kind: 'TAKE_TICKET', code: 'HME' })
    expect(parseCommand('TICKET HME2')).toEqual({ kind: 'TAKE_TICKET', code: 'HME2' })
  })
  it('un chiffre choisit un service pendant la prise de ticket, et seulement alors', () => {
    expect(parseCommand('5', { state: 'TICKET_SERVICE' })).toEqual({ kind: 'CHOICE', n: 5 })
    expect(parseCommand('1', { state: 'TICKET_SERVICE' })).toEqual({ kind: 'CHOICE', n: 1 })
    expect(kind('5')).toBe('TEXT')
    expect(parseCommand('', { buttonId: 'SVC_3' })).toEqual({ kind: 'CHOICE', n: 3 })
  })
  it('OUI / NON seulement pendant une confirmation', () => {
    expect(kind('oui', { state: 'CONFIRM_CANCEL' })).toBe('YES')
    expect(kind('Non.', { state: 'CONFIRM_CANCEL' })).toBe('NO')
    expect(kind('oui')).toBe('TEXT')
  })
  it('un vrai message reste un message (il part à l’accueil)', () => {
    expect(kind('Je serai en retard de 10 minutes')).toBe('TEXT')
    expect(kind('1 question sur mes résultats')).toBe('TEXT')
  })
})

describe('codes et textes', () => {
  it('code proposé à partir du nom', () => {
    expect(suggestCode('Hôpital Mère-Enfant')).toBe('HME')
    expect(suggestCode('Mairie de Cocody')).toBe('MC')
    expect(isValidCode('HME')).toBe(true)
    expect(isValidCode('H')).toBe(false)
    expect(isValidCode('hme')).toBe(false)
  })
  it('le menu tient en un SMS', () => {
    expect(smsParts(menuText('Hôpital Mère-Enfant')).parts).toBe(1)
  })
})

describe('modèles WhatsApp', () => {
  it('chaque motif d’envoi aux visiteurs a son modèle', () => {
    for (const p of ['APPOINTMENT_REMINDER', 'TURN_SOON', 'FOLLOW_UP', 'CAMPAIGN', 'CONVERSATION', 'SHOP_ORDER', 'ALERT']) expect(templateForPurpose(p)).not.toBeNull()
    expect(templateForPurpose('CAMPAIGN')?.category).toBe('MARKETING')
  })
  it('noms acceptés par Meta et deux paramètres', () => {
    for (const t of WHATSAPP_TEMPLATES) {
      expect(t.name).toMatch(/^[a-z0-9_]+$/)
      expect(t.body).toContain('{{1}}')
      expect(t.body).toContain('{{2}}')
      expect(t.body.trim().endsWith('}}') && t.body.trim().startsWith('{{')).toBe(false)
    }
  })
  it('paramètre sans retour à la ligne ni espaces en série', () => {
    expect(templateParam('Ligne 1\nLigne 2')).toBe('Ligne 1 · Ligne 2')
    expect(templateParam('a      b')).toBe('a   b')
    expect(templateParam('')).toBe('-')
  })
})

describe('SMS : alphabet et parties', () => {
  it('les lettres hors alphabet SMS sont converties : le message reste à 160 caractères par partie', () => {
    const r = smsParts('Hôpital Mère-Enfant : votre tour approche, présentez-vous à l’accueil, c’est bientôt fini.')
    expect(r.unicode).toBe(false)
    expect(r.parts).toBe(1)
  })
  it('un émoji fait passer en Unicode (70 par partie)', () => {
    expect(smsParts('Merci 🙏').unicode).toBe(true)
    expect(smsParts('x'.repeat(161)).parts).toBe(2)
    expect(smsParts('x'.repeat(160)).parts).toBe(1)
  })
})
