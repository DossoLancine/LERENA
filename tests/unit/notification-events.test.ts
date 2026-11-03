import { describe, expect, it } from 'vitest'
import { defaultChannels, eventsForRole, inQuietHours } from '@/lib/notification-events'

const at = (h: number) => new Date(Date.UTC(2026, 10, 3, h, 30))

describe('notifications', () => {
  it('heures de silence à cheval sur minuit (21 h – 7 h)', () => {
    expect(inQuietHours(21, 7, at(22))).toBe(true)
    expect(inQuietHours(21, 7, at(3))).toBe(true)
    expect(inQuietHours(21, 7, at(7))).toBe(false)
    expect(inQuietHours(21, 7, at(12))).toBe(false)
  })

  it('heures de silence dans la journée (12 h – 14 h) et désactivées', () => {
    expect(inQuietHours(12, 14, at(13))).toBe(true)
    expect(inQuietHours(12, 14, at(14))).toBe(false)
    expect(inQuietHours(null, null, at(23))).toBe(false)
    expect(inQuietHours(8, 8, at(8))).toBe(false)
  })

  it('préréglages par rôle : l’agent ne reçoit pas les factures, le responsable oui', () => {
    expect(eventsForRole('AGENT').map(e => e.id)).not.toContain('INVOICE_DUE')
    expect(eventsForRole('MANAGER').map(e => e.id)).toContain('INVOICE_DUE')
    expect(defaultChannels('COMPLAINT_NEW', 'MANAGER')).toEqual(['APP', 'PUSH', 'EMAIL'])
    expect(defaultChannels('APPOINTMENT_NEW', 'RECEPTION')).toEqual(['APP', 'PUSH'])
    expect(defaultChannels('INCONNU', 'MANAGER')).toEqual(['APP'])
  })
})
