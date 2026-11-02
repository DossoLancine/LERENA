import { describe, expect, it, vi } from 'vitest'

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

import { LEGAL_DOCS, legalDoc, type LegalContext } from '@/app/legal/content'
import { isExpectedError } from '@/lib/observability'
import { TicketError } from '@/lib/ticketing'
import { BillingError } from '@/lib/billing'

const ctx: LegalContext = { company: 'Lerena SAS', address: 'Cocody, Abidjan', rccm: 'CI-ABJ-1', taxId: '123', email: 'contact@lerena.ci', phone: '+225', dpo: 'dpo@lerena.ci', artci: 'en cours', retentionMonths: 12 }

describe('documents légaux', () => {
  it('cinq documents, chacun avec du contenu', () => {
    expect(LEGAL_DOCS.map(d => d.slug)).toEqual(['cgu', 'cgv', 'confidentialite', 'mentions-legales', 'sous-traitance'])
    for (const d of LEGAL_DOCS) expect(d.sections(ctx).length).toBeGreaterThan(1)
  })
  it('les coordonnées et la durée de conservation sont reprises', () => {
    const text = JSON.stringify(legalDoc('confidentialite')!.sections(ctx))
    expect(text).toContain('Lerena SAS')
    expect(text).toContain('dpo@lerena.ci')
    expect(text).toContain('12 mois')
  })
})

describe('journal d’erreurs', () => {
  it('les erreurs « métier » ne sont pas des incidents', () => {
    expect(isExpectedError(new TicketError('Service fermé'))).toBe(true)
    expect(isExpectedError(new BillingError('Limite atteinte'))).toBe(true)
    expect(isExpectedError(new Error('Panne'))).toBe(false)
  })
})
