// Boutique de l'établissement : libellés, états des commandes et règles de passage d'un état à l'autre.
// Sans accès à la base : utilisable côté navigateur (catalogue, commandes) et testé à part.

export const PRODUCT_TYPES = {
  PHYSICAL: { label: 'Produit', hint: 'Carnet de santé, médicament en vente libre, carte, timbre…' },
  DIGITAL: { label: 'Numérique', hint: 'Attestation, code d’accès, carte de recharge, document : le lien ou le code part après le paiement.' },
  SERVICE: { label: 'Service', hint: 'Livraison, prise en charge prioritaire, photocopie, consultation complémentaire…' }
} as const
export type ProductType = keyof typeof PRODUCT_TYPES
export const isProductType = (v: unknown): v is ProductType => typeof v === 'string' && Object.prototype.hasOwnProperty.call(PRODUCT_TYPES, v)

/** Moments où un produit est proposé au visiteur. */
export const SHOP_MOMENTS = {
  BOOKING: { label: 'À la prise de rendez-vous', hint: 'sur la page du rendez-vous' },
  WAITING: { label: 'Pendant l’attente', hint: 'sur la page du ticket et l’écran TV' },
  AFTER: { label: 'Après le service', hint: 'sur le ticket terminé, pendant 24 h' }
} as const
export type ShopMoment = keyof typeof SHOP_MOMENTS
export const isShopMoment = (v: unknown): v is ShopMoment => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHOP_MOMENTS, v)

export const ORDER_STATUS = {
  REQUESTED: { label: 'Demandée', visitor: 'Commande envoyée, l’établissement va la confirmer', tone: 'warning' },
  CONFIRMED: { label: 'Confirmée', visitor: 'Confirmée : à régler au guichet ou à la caisse', tone: 'info' },
  PAID: { label: 'Payée', visitor: 'Payée : à retirer', tone: 'success' },
  DELIVERED: { label: 'Remise', visitor: 'Remise', tone: 'success' },
  CANCELLED: { label: 'Annulée', visitor: 'Annulée', tone: 'neutral' },
  REFUNDED: { label: 'Remboursée', visitor: 'Remboursée', tone: 'neutral' }
} as const
export type OrderStatus = keyof typeof ORDER_STATUS
export const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ORDER_STATUS, v)

/** Libellé « remise » selon ce qui a été acheté. */
export function deliveredLabel(types: string[]) {
  if (types.length && types.every(t => t === 'DIGITAL')) return 'Envoyée'
  if (types.length && types.every(t => t === 'SERVICE')) return 'Réalisée'
  return 'Remise'
}

export const SHOP_PAY_METHODS = {
  CASH: 'Espèces',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN Mobile Money',
  MOOV_MONEY: 'Moov Money',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement',
  OFFERED: 'Offert'
} as const
export type ShopPayMethod = keyof typeof SHOP_PAY_METHODS
export const isShopPayMethod = (v: unknown): v is ShopPayMethod => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SHOP_PAY_METHODS, v)

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  REQUESTED: ['CONFIRMED', 'PAID', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: []
}

/** Passages autorisés : une commande n'est remise qu'une fois payée ; annulée et remboursée sont définitives. */
export const canTransition = (from: string, to: string) => isOrderStatus(from) && isOrderStatus(to) && NEXT[from].includes(to)
export const nextStatuses = (from: string): OrderStatus[] => (isOrderStatus(from) ? NEXT[from] : [])
/** Le motif est obligatoire pour annuler ou rembourser. */
export const needsReason = (to: string) => to === 'CANCELLED' || to === 'REFUNDED'
/** Le visiteur peut annuler tant que rien n'est encaissé. */
export const visitorCanCancel = (status: string) => status === 'REQUESTED' || status === 'CONFIRMED'
/** Commandes encore à traiter par l'équipe. */
export const OPEN_STATUSES: OrderStatus[] = ['REQUESTED', 'CONFIRMED', 'PAID']
/** Commandes comptées dans le chiffre d'affaires. */
export const SOLD_STATUSES: OrderStatus[] = ['PAID', 'DELIVERED']

export const MAX_CART_LINES = 10
export const MAX_QTY = 10
export const FREE_PLAN_PRODUCTS = 10

export interface CartLine { productId: string; qty: number }
export interface PricedProduct { id: string; name: string; type: string; price: number; stock: number | null }

/**
 * Panier vérifié côté serveur : produits connus seulement, quantités bornées, lignes fusionnées, stock respecté.
 * Renvoie les lignes à enregistrer et le total, ou un message pour le visiteur.
 */
export function priceCart(lines: CartLine[], products: PricedProduct[]): { ok: true; items: { productId: string; name: string; type: string; unitPrice: number; qty: number; amount: number }[]; total: number } | { ok: false; error: string } {
  const byId = new Map(products.map(p => [p.id, p]))
  const merged = new Map<string, number>()
  for (const l of lines) {
    if (!l || typeof l.productId !== 'string') continue
    const q = Math.floor(Number(l.qty))
    if (!Number.isFinite(q) || q < 1) continue
    merged.set(l.productId, (merged.get(l.productId) ?? 0) + q)
  }
  if (!merged.size) return { ok: false, error: 'Votre panier est vide' }
  if (merged.size > MAX_CART_LINES) return { ok: false, error: `${MAX_CART_LINES} articles différents au plus par commande` }
  const items = []
  for (const [id, qty] of Array.from(merged)) {
    const p = byId.get(id)
    if (!p) return { ok: false, error: 'Un article n’est plus disponible : rechargez la page' }
    if (qty > MAX_QTY) return { ok: false, error: `${MAX_QTY} exemplaires au plus de « ${p.name} »` }
    if (p.stock != null && qty > p.stock) return { ok: false, error: p.stock > 0 ? `Plus que ${p.stock} « ${p.name} » disponible${p.stock > 1 ? 's' : ''}` : `« ${p.name} » est épuisé` }
    items.push({ productId: p.id, name: p.name, type: p.type, unitPrice: p.price, qty, amount: p.price * qty })
  }
  return { ok: true, items, total: items.reduce((s, i) => s + i.amount, 0) }
}

/** Numéro lisible de commande et de reçu : 000123. */
export const orderNo = (n: number) => String(n).padStart(6, '0')

/** Prix affiché : « Offert » pour 0. */
export const priceLabel = (n: number) => (n === 0 ? 'Offert' : `${Math.round(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ')} FCFA`)

/** Pourcentage de remise d'un prix barré (null si pas de promotion). */
export const discountPct = (price: number, compareAt: number | null | undefined) =>
  compareAt && compareAt > price && compareAt > 0 ? Math.round(((compareAt - price) / compareAt) * 100) : null
