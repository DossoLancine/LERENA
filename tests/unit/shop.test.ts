import { describe, expect, it } from 'vitest'
import { canTransition, deliveredLabel, discountPct, needsReason, nextStatuses, orderNo, priceCart, priceLabel, visitorCanCancel } from '@/lib/shop'
import { summarize, type SiteFigures } from '@/lib/report-summary'

const products = [
  { id: 'a', name: 'Attestation', type: 'DIGITAL', price: 2000, stock: null },
  { id: 'c', name: 'Carnet de santé', type: 'PHYSICAL', price: 5500, stock: 3 },
  { id: 'z', name: 'Épuisé', type: 'PHYSICAL', price: 1000, stock: 0 }
]

describe('états des commandes', () => {
  it('une commande n’est remise qu’une fois payée', () => {
    expect(canTransition('REQUESTED', 'DELIVERED')).toBe(false)
    expect(canTransition('CONFIRMED', 'DELIVERED')).toBe(false)
    expect(canTransition('PAID', 'DELIVERED')).toBe(true)
  })
  it('annulée et remboursée sont définitives', () => {
    expect(nextStatuses('CANCELLED')).toEqual([])
    expect(nextStatuses('REFUNDED')).toEqual([])
    expect(canTransition('CANCELLED', 'PAID')).toBe(false)
  })
  it('on ne rembourse que ce qui est encaissé, on n’annule pas ce qui l’est', () => {
    expect(canTransition('REQUESTED', 'REFUNDED')).toBe(false)
    expect(canTransition('PAID', 'CANCELLED')).toBe(false)
    expect(canTransition('DELIVERED', 'REFUNDED')).toBe(true)
  })
  it('motif obligatoire pour annuler ou rembourser ; le visiteur annule tant que rien n’est réglé', () => {
    expect(needsReason('CANCELLED') && needsReason('REFUNDED')).toBe(true)
    expect(needsReason('PAID')).toBe(false)
    expect(visitorCanCancel('CONFIRMED')).toBe(true)
    expect(visitorCanCancel('PAID')).toBe(false)
  })
  it('refuse les états inconnus', () => {
    expect(canTransition('REQUESTED', 'toString')).toBe(false)
    expect(canTransition('toString', 'PAID')).toBe(false)
  })
})

describe('panier', () => {
  it('relit les prix en base, fusionne les lignes et calcule le total', () => {
    const r = priceCart([{ productId: 'a', qty: 1 }, { productId: 'c', qty: 1 }, { productId: 'a', qty: 1 }], products)
    expect(r.ok && r.total).toBe(9500)
    expect(r.ok && r.items.find(i => i.productId === 'a')?.qty).toBe(2)
  })
  it('respecte le stock et signale les produits épuisés', () => {
    const over = priceCart([{ productId: 'c', qty: 4 }], products)
    expect(over.ok).toBe(false)
    expect(!over.ok && over.error).toMatch(/Plus que 3/)
    const none = priceCart([{ productId: 'z', qty: 1 }], products)
    expect(!none.ok && none.error).toMatch(/épuisé/)
  })
  it('refuse un produit inconnu, un panier vide ou des quantités farfelues', () => {
    expect(priceCart([{ productId: 'x', qty: 1 }], products).ok).toBe(false)
    expect(priceCart([], products).ok).toBe(false)
    expect(priceCart([{ productId: 'a', qty: -3 }, { productId: 'a', qty: Number.NaN }], products).ok).toBe(false)
    expect(priceCart([{ productId: 'a', qty: 11 }], products).ok).toBe(false)
  })
})

describe('affichage', () => {
  it('prix, remise, numéro et libellé de remise', () => {
    expect(priceLabel(0)).toBe('Offert')
    expect(priceLabel(7500)).toBe('7 500 FCFA')
    expect(discountPct(4000, 5000)).toBe(20)
    expect(discountPct(5000, 4000)).toBeNull()
    expect(orderNo(42)).toBe('000042')
    expect(deliveredLabel(['DIGITAL'])).toBe('Envoyée')
    expect(deliveredLabel(['SERVICE'])).toBe('Réalisée')
    expect(deliveredLabel(['DIGITAL', 'PHYSICAL'])).toBe('Remise')
  })
})

describe('rapport', () => {
  const norm = (t: string) => t.replace(/[\u202f\u00a0]/g, ' ')
  const site = (id: string, o: Partial<SiteFigures> = {}): SiteFigures => ({ id, name: id, tickets: 10, served: 10, absent: 0, waitSum: 100, waitCount: 10, ratingSum: 40, ratingCount: 10, appointments: 0, noShows: 0, complaints: 0, peakHour: 9, ...o })
  it('ajoute les ventes de la boutique, limitées aux sites du lecteur', () => {
    const data = { sites: [site('A', { salesCount: 3, salesAmount: 12000 }), site('B', { salesCount: 1, salesAmount: 500 })], previous: [], waitAlertMin: 45 }
    expect(summarize(data, null).lines.some(l => norm(l.text) === 'Boutique : 4 ventes pour 12 500 FCFA.')).toBe(true)
    expect(summarize(data, ['B']).lines.some(l => norm(l.text) === 'Boutique : 1 vente pour 500 FCFA.')).toBe(true)
  })
})
