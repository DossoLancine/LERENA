import { describe, expect, it } from 'vitest'
import { METHOD_LABELS, passwordlessAllowed, ssoAllowed } from '@/lib/auth-method-labels'
import { SSO_ERRORS } from '@/lib/sign-in'
import { AUTH_TEMPLATE } from '@/lib/whatsapp-templates'

describe('méthodes de connexion', () => {
  it('code et lien : visiteurs seulement (les équipes gardent mot de passe et double authentification)', () => {
    expect(passwordlessAllowed('CLIENT')).toBe(true)
    for (const r of ['MANAGER', 'RECEPTION', 'AGENT', 'SUPER_ADMIN', 'ORG_ADMIN', 'VIEWER']) expect(passwordlessAllowed(r)).toBe(false)
  })
  it('Google ou Microsoft : visiteurs et équipes d’établissement, jamais l’administration de la plateforme', () => {
    for (const r of ['CLIENT', 'MANAGER', 'RECEPTION', 'AGENT']) expect(ssoAllowed(r)).toBe(true)
    for (const r of ['SUPER_ADMIN', 'ORG_ADMIN', 'VIEWER']) expect(ssoAllowed(r)).toBe(false)
  })
  it('libellés des appareils et messages d’erreur en français', () => {
    expect(METHOD_LABELS.PHONE_CODE).toMatch(/SMS ou WhatsApp/)
    expect(SSO_ERRORS.SSO_UNKNOWN).toMatch(/Équipe/)
  })
  it('modèle WhatsApp du code : un seul paramètre, nom accepté par Meta', () => {
    expect(AUTH_TEMPLATE.name).toMatch(/^[a-z0-9_]+$/)
    expect(AUTH_TEMPLATE.body).toContain('{{1}}')
    expect(AUTH_TEMPLATE.body).not.toContain('{{2}}')
  })
})
