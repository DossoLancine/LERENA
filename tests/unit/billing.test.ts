import { describe, expect, it, vi } from 'vitest'

vi.mock('react', () => ({ cache: (fn: unknown) => fn }))

import { billingState, monthlyRevenue } from '@/lib/billing'
import { fcfa } from '@/lib/billing-labels'

const DAY = 86400_000
const now = new Date('2026-11-01T12:00:00Z')
const at = (days: number) => new Date(now.getTime() + days * DAY)

describe('état de l’abonnement', () => {
  it('essai en cours, avec les jours restants', () => {
    expect(billingState({ status: 'TRIAL', trialEndsAt: at(10), currentPeriodEnd: null }, 7, now)).toMatchObject({ state: 'TRIAL', daysLeft: 10 })
  })
  it('essai terminé : délai de grâce puis suspension', () => {
    expect(billingState({ status: 'TRIAL', trialEndsAt: at(-3), currentPeriodEnd: null }, 7, now)).toMatchObject({ state: 'GRACE', daysLeft: 4 })
    expect(billingState({ status: 'TRIAL', trialEndsAt: at(-8), currentPeriodEnd: null }, 7, now).state).toBe('SUSPENDED')
  })
  it('période payée, puis retard', () => {
    expect(billingState({ status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: at(20) }, 7, now).state).toBe('ACTIVE')
    expect(billingState({ status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: at(-1) }, 7, now).state).toBe('GRACE')
  })
  it('contrat sur mesure sans échéance : toujours actif', () => {
    expect(billingState({ status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: null }, 7, now).state).toBe('ACTIVE')
  })
  it('suspension et résiliation manuelles priment', () => {
    expect(billingState({ status: 'SUSPENDED', trialEndsAt: at(30), currentPeriodEnd: null }, 7, now).state).toBe('SUSPENDED')
    expect(billingState({ status: 'CANCELLED', trialEndsAt: null, currentPeriodEnd: at(30) }, 7, now).state).toBe('CANCELLED')
  })
})

describe('revenu mensuel', () => {
  const plan = { priceMonthly: 45000, yearlyDiscountPct: 15 }
  it('prix par site × nombre de sites', () => {
    expect(monthlyRevenue({ customPricePerSite: null, discountPct: 0, billingCycle: 'MONTHLY' }, plan, 3)).toBe(135000)
  })
  it('prix négocié, remise commerciale et remise annuelle', () => {
    expect(monthlyRevenue({ customPricePerSite: 40000, discountPct: 0, billingCycle: 'MONTHLY' }, plan, 1)).toBe(40000)
    expect(monthlyRevenue({ customPricePerSite: null, discountPct: 10, billingCycle: 'MONTHLY' }, plan, 2)).toBe(81000)
    expect(monthlyRevenue({ customPricePerSite: null, discountPct: 0, billingCycle: 'YEARLY' }, plan, 1)).toBe(38250)
  })
  it('forfait sur devis sans prix négocié : 0', () => {
    expect(monthlyRevenue({ customPricePerSite: null, discountPct: 0, billingCycle: 'MONTHLY' }, { priceMonthly: null, yearlyDiscountPct: 15 }, 4)).toBe(0)
  })
})

describe('format FCFA', () => {
  it('espaces normales entre milliers', () => {
    expect(fcfa(1234567)).toBe('1 234 567 FCFA')
  })
})
