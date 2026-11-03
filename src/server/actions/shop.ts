'use server'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getManagerContext, getMemberAccess } from '@/lib/session'
import { audit } from '@/lib/audit'
import { hasFeature } from '@/lib/billing'
import { moveOrder, productImage, ShopError } from '@/lib/shop-orders'
import { FREE_PLAN_PRODUCTS, isOrderStatus, isProductType, isShopMoment, OPEN_STATUSES, orderNo, SOLD_STATUSES, type OrderStatus } from '@/lib/shop'

// Boutique côté équipe : catalogue (droit « catalogue »), commandes (droit « encaisser »), ventes.

const DAY = 86400_000

async function sellerContext() {
  const ctx = await getMemberAccess()
  return ctx && ctx.can('shop.sell') ? ctx : null
}

const inScope = (siteIds: string[] | null, branchIds: string[]) => !siteIds || (branchIds.length > 0 && branchIds.every(id => siteIds.includes(id)))

// ---- Catalogue ----

export async function getCatalog() {
  const ctx = await getManagerContext('shop.manage')
  if (!ctx) return null
  const [products, sites, services, unlimited] = await Promise.all([
    prisma.shopProduct.findMany({ where: { organizationId: ctx.orgId }, orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }] }),
    prisma.branch.findMany({ where: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true } }),
    prisma.service.findMany({ where: { isActive: true, branch: { organizationId: ctx.orgId, ...(ctx.siteIds ? { id: { in: ctx.siteIds } } : {}) } }, orderBy: { name: 'asc' }, select: { id: true, name: true, branchId: true } }),
    hasFeature(ctx.orgId, 'SHOP_UNLIMITED')
  ])
  return {
    scoped: !!ctx.siteIds,
    limit: unlimited ? null : FREE_PLAN_PRODUCTS,
    activeCount: products.filter(p => p.isActive).length,
    sites, services,
    products: products.map(p => ({
      id: p.id, type: p.type, name: p.name, description: p.description, image: productImage(p), imageIsLink: !!p.imageUrl && !p.imageUrl.startsWith('data:'),
      price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, lowStockAt: p.lowStockAt, branchIds: p.branchIds, serviceIds: p.serviceIds,
      moments: p.moments, digitalContent: p.digitalContent, isActive: p.isActive, views: p.views, adds: p.adds,
      editable: inScope(ctx.siteIds, p.branchIds)
    }))
  }
}

export interface ProductInput {
  id?: string
  type: string
  name: string
  description?: string | null
  /** Image : data:image/… (réduite par le navigateur), lien https, null pour l'enlever, undefined pour la garder. */
  image?: string | null
  price: number
  compareAtPrice?: number | null
  stock?: number | null
  lowStockAt?: number | null
  branchIds: string[]
  serviceIds: string[]
  moments: string[]
  digitalContent?: string | null
  isActive: boolean
}

const int = (v: unknown, min: number, max: number) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Math.min(max, Math.max(min, Math.round(Number(v)))))
const MAX_IMAGE = 400_000

function checkImage(image: string | null | undefined) {
  if (image === undefined || image === null) return image
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image) && image.length <= MAX_IMAGE) return image
  if (/^https:\/\/[^\s"'<>]{4,500}$/.test(image)) return image
  throw new ShopError('Image refusée : photo PNG, JPEG ou WebP, ou lien https')
}

export async function saveProduct(input: ProductInput) {
  const ctx = await getManagerContext('shop.manage')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  try {
    const name = input.name?.trim().slice(0, 80)
    if (!name) throw new ShopError('Indiquez le nom')
    if (!isProductType(input.type)) throw new ShopError('Type inconnu')
    const price = int(input.price, 0, 10_000_000)
    if (price == null) throw new ShopError('Indiquez le prix (0 si offert)')
    const compareAtPrice = int(input.compareAtPrice, 0, 10_000_000)
    if (compareAtPrice != null && compareAtPrice <= price) throw new ShopError('Le prix barré doit être plus élevé que le prix')
    const moments = Array.from(new Set((input.moments ?? []).filter(isShopMoment)))
    if (!moments.length) throw new ShopError('Choisissez au moins un moment où le proposer')

    const [orgSites, orgServices] = await Promise.all([
      prisma.branch.findMany({ where: { organizationId: ctx.orgId }, select: { id: true } }),
      prisma.service.findMany({ where: { branch: { organizationId: ctx.orgId } }, select: { id: true } })
    ])
    let branchIds = (input.branchIds ?? []).filter(id => orgSites.some(s => s.id === id))
    // Un responsable de site ne vend que sur ses sites
    if (ctx.siteIds) { branchIds = branchIds.filter(id => ctx.siteIds!.includes(id)); if (!branchIds.length) branchIds = ctx.siteIds }
    const serviceIds = (input.serviceIds ?? []).filter(id => orgServices.some(s => s.id === id))
    const image = checkImage(input.image)
    const data = {
      type: input.type, name, description: input.description?.trim().slice(0, 300) || null, price, compareAtPrice,
      stock: int(input.stock, 0, 1_000_000), lowStockAt: int(input.lowStockAt, 0, 1_000_000), branchIds, serviceIds, moments,
      digitalContent: input.type === 'DIGITAL' ? input.digitalContent?.trim().slice(0, 500) || null : null,
      isActive: !!input.isActive, ...(image !== undefined ? { imageUrl: image } : {})
    }

    const existing = input.id ? await prisma.shopProduct.findFirst({ where: { id: input.id, organizationId: ctx.orgId } }) : null
    if (input.id && !existing) throw new ShopError('Produit introuvable')
    if (existing && !inScope(ctx.siteIds, existing.branchIds)) throw new ShopError('Ce produit est géré par la direction')
    // Forfait Essentiel : 10 produits actifs
    if (data.isActive && !existing?.isActive && !(await hasFeature(ctx.orgId, 'SHOP_UNLIMITED'))) {
      const active = await prisma.shopProduct.count({ where: { organizationId: ctx.orgId, isActive: true } })
      if (active >= FREE_PLAN_PRODUCTS) throw new ShopError(`Votre forfait permet ${FREE_PLAN_PRODUCTS} produits actifs : désactivez-en un ou passez à un forfait supérieur dans Abonnement.`)
    }

    const saved = existing
      ? await prisma.shopProduct.update({ where: { id: existing.id }, data })
      : await prisma.shopProduct.create({ data: { ...data, organizationId: ctx.orgId } })
    if (!existing) await audit({ action: 'PRODUCT_CREATED', targetType: 'ShopProduct', targetId: saved.id, organizationId: ctx.orgId, details: `${name} · ${price} FCFA` })
    else if (existing.price !== price || existing.compareAtPrice !== compareAtPrice) {
      await audit({ action: 'PRODUCT_PRICE_CHANGED', targetType: 'ShopProduct', targetId: saved.id, organizationId: ctx.orgId, details: `${name} : ${existing.price} → ${price} FCFA${compareAtPrice != null ? ` (barré ${compareAtPrice})` : ''}` })
    }
    return { success: true as const, id: saved.id }
  } catch (e) {
    if (e instanceof ShopError) return { success: false as const, error: e.message }
    throw e
  }
}

/** Supprime un produit jamais commandé ; sinon il est seulement désactivé (les reçus gardent leur historique). */
export async function deleteProduct(id: string) {
  const ctx = await getManagerContext('shop.manage')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const p = await prisma.shopProduct.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true, name: true, branchIds: true, _count: { select: { items: true } } } })
  if (!p) return { success: false as const, error: 'Produit introuvable' }
  if (!inScope(ctx.siteIds, p.branchIds)) return { success: false as const, error: 'Ce produit est géré par la direction' }
  if (p._count.items) {
    await prisma.shopProduct.update({ where: { id: p.id }, data: { isActive: false } })
    return { success: true as const, archived: true }
  }
  await prisma.shopProduct.delete({ where: { id: p.id } })
  await audit({ action: 'PRODUCT_DELETED', targetType: 'ShopProduct', targetId: p.id, organizationId: ctx.orgId, details: p.name })
  return { success: true as const, archived: false }
}

// ---- Commandes ----

export type OrderBucket = 'todo' | 'pay' | 'deliver' | 'done'
const BUCKETS: Record<OrderBucket, OrderStatus[]> = { todo: ['REQUESTED'], pay: ['CONFIRMED'], deliver: ['PAID'], done: ['DELIVERED', 'CANCELLED', 'REFUNDED'] }

const STAFF_ORDER = {
  items: { select: { id: true, name: true, type: true, unitPrice: true, qty: true, amount: true } },
  branch: { select: { name: true } },
  customer: { select: { id: true, name: true, phone: true } }
} satisfies Prisma.ShopOrderInclude

type StaffOrderRow = Prisma.ShopOrderGetPayload<{ include: typeof STAFF_ORDER }>

async function shape(orders: StaffOrderRow[]) {
  const ticketIds = orders.map(o => o.ticketId).filter((x): x is string => !!x)
  const apptIds = orders.map(o => o.appointmentId).filter((x): x is string => !!x)
  const actorIds = orders.map(o => o.paidById).filter((x): x is string => !!x)
  const [tickets, appts, actors] = await Promise.all([
    ticketIds.length ? prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, displayNum: true, status: true, guestName: true, user: { select: { name: true } } } }) : [],
    apptIds.length ? prisma.appointment.findMany({ where: { id: { in: apptIds } }, select: { id: true, scheduledDate: true, guestName: true, ticketId: true } }) : [],
    actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : []
  ])
  return orders.map(o => {
    const t = tickets.find(x => x.id === o.ticketId)
    const a = appts.find(x => x.id === o.appointmentId)
    return {
      id: o.id, number: orderNo(o.number), status: o.status, total: o.total, moment: o.moment, createdAt: o.createdAt.toISOString(),
      paymentMethod: o.paymentMethod, paidAt: o.paidAt?.toISOString() ?? null, paidBy: actors.find(x => x.id === o.paidById)?.name ?? null,
      closedReason: o.closedReason, site: o.branch.name, items: o.items,
      who: o.customer?.name || t?.guestName || t?.user?.name || a?.guestName || o.customer?.phone || null,
      customerId: o.customer?.id ?? null,
      ticket: t ? { id: t.id, displayNum: t.displayNum, status: t.status } : null,
      appointment: a ? { scheduledDate: a.scheduledDate.toISOString() } : null
    }
  })
}

export type StaffOrder = Awaited<ReturnType<typeof shape>>[number]

export async function getOrders(bucket: OrderBucket = 'todo') {
  const ctx = await sellerContext()
  if (!ctx) return null
  const statuses = BUCKETS[bucket] ?? BUCKETS.todo
  const scope = { organizationId: ctx.orgId, ...(ctx.siteIds ? { branchId: { in: ctx.siteIds } } : {}) }
  const [orders, counts] = await Promise.all([
    prisma.shopOrder.findMany({
      where: { ...scope, status: { in: statuses }, ...(bucket === 'done' ? { updatedAt: { gte: new Date(Date.now() - 7 * DAY) } } : {}) },
      orderBy: { createdAt: bucket === 'done' ? 'desc' : 'asc' }, take: 100, include: STAFF_ORDER
    }),
    prisma.shopOrder.groupBy({ by: ['status'], where: { ...scope, status: { in: OPEN_STATUSES } }, _count: true })
  ])
  const c = (s: string) => counts.find(x => x.status === s)?._count ?? 0
  return { orders: await shape(orders), counts: { todo: c('REQUESTED'), pay: c('CONFIRMED'), deliver: c('PAID') } }
}

/** Nombre de commandes à traiter (pastille de l'accueil). */
export async function countOpenOrders() {
  const ctx = await sellerContext()
  if (!ctx) return 0
  return prisma.shopOrder.count({ where: { organizationId: ctx.orgId, ...(ctx.siteIds ? { branchId: { in: ctx.siteIds } } : {}), status: { in: OPEN_STATUSES } } })
}

/** Commandes du visiteur appelé au guichet (ticket et rendez-vous dont il est issu). */
export async function getTicketOrders(ticketId: string) {
  const ctx = await sellerContext()
  if (!ctx || typeof ticketId !== 'string') return []
  const t = await prisma.ticket.findFirst({ where: { id: ticketId, queue: { branch: { organizationId: ctx.orgId } } }, select: { id: true } })
  if (!t) return []
  const appts = await prisma.appointment.findMany({ where: { ticketId: t.id }, select: { id: true } })
  const orders = await prisma.shopOrder.findMany({
    where: { organizationId: ctx.orgId, OR: [{ ticketId: t.id }, ...(appts.length ? [{ appointmentId: { in: appts.map(a => a.id) } }] : [])], status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    orderBy: { createdAt: 'asc' }, include: STAFF_ORDER
  })
  return shape(orders)
}

export async function setOrderStatus(orderId: string, status: string, opts: { method?: string | null; reason?: string | null } = {}) {
  const ctx = await sellerContext()
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (!isOrderStatus(status)) return { success: false as const, error: 'État inconnu' }
  try {
    const o = await moveOrder(orderId, ctx.orgId, status, { actorId: ctx.userId, method: opts.method, reason: opts.reason, siteIds: ctx.siteIds })
    if (status === 'REFUNDED' || status === 'CANCELLED') {
      await audit({ action: status === 'REFUNDED' ? 'ORDER_REFUNDED' : 'ORDER_CANCELLED', targetType: 'ShopOrder', targetId: o.id, organizationId: ctx.orgId, details: `Commande ${orderNo(o.number)} · ${o.total} FCFA · ${opts.reason ?? ''}`.slice(0, 300) })
    }
    return { success: true as const }
  } catch (e) {
    if (e instanceof ShopError) return { success: false as const, error: e.message }
    throw e
  }
}

export async function getOrderHistory(orderId: string) {
  const ctx = await sellerContext()
  if (!ctx) return []
  const events = await prisma.shopOrderEvent.findMany({ where: { orderId, order: { organizationId: ctx.orgId, ...(ctx.siteIds ? { branchId: { in: ctx.siteIds } } : {}) } }, orderBy: { createdAt: 'asc' } })
  const actors = await prisma.user.findMany({ where: { id: { in: events.map(e => e.actorId).filter((x): x is string => !!x) } }, select: { id: true, name: true } })
  return events.map(e => ({ status: e.status, at: e.createdAt.toISOString(), by: e.actorId ? actors.find(a => a.id === e.actorId)?.name ?? 'Équipe' : 'Visiteur', note: e.note }))
}

// ---- Ventes ----

export async function getShopStats(days = 30) {
  const ctx = await getManagerContext()
  if (!ctx || !(ctx.can('stats.view') || ctx.can('shop.manage'))) return null
  const period = [7, 30, 90].includes(days) ? days : 30
  const since = new Date(Date.now() - period * DAY)
  const scope = { organizationId: ctx.orgId, ...(ctx.siteIds ? { branchId: { in: ctx.siteIds } } : {}) }
  const [orders, products] = await Promise.all([
    prisma.shopOrder.findMany({ where: { ...scope, createdAt: { gte: since } }, select: { status: true, total: true, paidAt: true, createdAt: true, paidById: true, paymentMethod: true, branch: { select: { name: true } }, items: { select: { productId: true, name: true, qty: true, amount: true } } } }),
    prisma.shopProduct.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true, views: true, adds: true } })
  ])
  const sold = orders.filter(o => (SOLD_STATUSES as string[]).includes(o.status))
  const revenue = sold.reduce((s, o) => s + o.total, 0)

  const byDay = new Map<string, number>()
  for (let i = period - 1; i >= 0; i--) byDay.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0)
  for (const o of sold) { const k = (o.paidAt ?? o.createdAt).toISOString().slice(0, 10); if (byDay.has(k)) byDay.set(k, byDay.get(k)! + o.total) }

  const group = <K extends string>(rows: { key: K; amount: number; qty?: number }[]) => {
    const m = new Map<K, { amount: number; qty: number; orders: number }>()
    for (const r of rows) { const g = m.get(r.key) ?? { amount: 0, qty: 0, orders: 0 }; g.amount += r.amount; g.qty += r.qty ?? 0; g.orders += 1; m.set(r.key, g) }
    return Array.from(m, ([key, v]) => ({ key, ...v })).sort((a, b) => b.amount - a.amount)
  }
  const byProduct = group(sold.flatMap(o => o.items.map(i => ({ key: i.name, amount: i.amount, qty: i.qty }))))
  const bySite = group(sold.map(o => ({ key: o.branch.name, amount: o.total })))
  const sellerIds = Array.from(new Set(sold.map(o => o.paidById).filter((x): x is string => !!x)))
  const sellers = sellerIds.length ? await prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } }) : []
  const bySeller = group(sold.map(o => ({ key: sellers.find(s => s.id === o.paidById)?.name ?? 'Non renseigné', amount: o.total })))
  const byMethod = group(sold.map(o => ({ key: o.paymentMethod ?? 'OTHER', amount: o.total })))

  // Parcours : vus et ajoutés (compteurs depuis la création du produit), réservés et payés sur la période
  const funnel = {
    views: products.reduce((s, p) => s + p.views, 0),
    adds: products.reduce((s, p) => s + p.adds, 0),
    ordered: orders.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0),
    paid: sold.reduce((s, o) => s + o.items.reduce((q, i) => q + i.qty, 0), 0)
  }
  return {
    period, revenue, orders: orders.length, sold: sold.length,
    cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    refunded: orders.filter(o => o.status === 'REFUNDED').reduce((s, o) => s + o.total, 0),
    avgBasket: sold.length ? Math.round(revenue / sold.length) : null,
    byDay: Array.from(byDay, ([day, amount]) => ({ day, amount })),
    byProduct: byProduct.slice(0, 10), bySite, bySeller, byMethod, funnel
  }
}

/** Achats d'un visiteur (fiche du fichier visiteurs). */
export async function getCustomerPurchases(customerId: string) {
  const ctx = await getMemberAccess()
  if (!ctx || !ctx.can('visitors.view')) return []
  const orders = await prisma.shopOrder.findMany({
    where: { customerId, organizationId: ctx.orgId, ...(ctx.siteIds ? { branchId: { in: ctx.siteIds } } : {}) },
    orderBy: { createdAt: 'desc' }, take: 20, include: { items: { select: { name: true, qty: true } }, branch: { select: { name: true } } }
  })
  return orders.map(o => ({ id: o.id, number: orderNo(o.number), status: o.status, total: o.total, createdAt: o.createdAt.toISOString(), site: o.branch.name, items: o.items.map(i => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', ') }))
}
