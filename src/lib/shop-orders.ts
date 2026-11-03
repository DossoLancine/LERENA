import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notifications'
import { notifyOrg } from '@/lib/realtime'
import { sendPushToTicket } from '@/lib/push'
import { appUrl, sendEmail, sendWhatsAppMessage } from '@/lib/messaging'
import { canTransition, deliveredLabel, isShopPayMethod, needsReason, orderNo, priceCart, priceLabel, SHOP_PAY_METHODS, type CartLine, type OrderStatus, type ShopMoment } from '@/lib/shop'

// Boutique côté serveur : produits proposés à un moment donné, commande du visiteur, validation par l'équipe.

/** Image servie par l'application quand elle est enregistrée dans la base (évite de la renvoyer à chaque rafraîchissement). */
export const productImage = (p: { id: string; imageUrl: string | null; updatedAt: Date }) =>
  !p.imageUrl ? null : p.imageUrl.startsWith('data:') ? `/api/shop/image/${p.id}?v=${p.updatedAt.getTime()}` : p.imageUrl

const PUBLIC_PRODUCT = { id: true, type: true, name: true, description: true, imageUrl: true, price: true, compareAtPrice: true, stock: true, updatedAt: true } satisfies Prisma.ShopProductSelect

/** Produits actifs proposés sur ce site, pour ce service et à ce moment. */
export async function productsFor(orgId: string, branchId: string, serviceId: string | null, moment: ShopMoment) {
  const rows = await prisma.shopProduct.findMany({
    where: {
      organizationId: orgId, isActive: true, moments: { has: moment },
      AND: [
        { OR: [{ branchIds: { isEmpty: true } }, { branchIds: { has: branchId } }] },
        serviceId ? { OR: [{ serviceIds: { isEmpty: true } }, { serviceIds: { has: serviceId } }] } : { serviceIds: { isEmpty: true } }
      ]
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 30,
    select: PUBLIC_PRODUCT
  })
  return rows.map(p => ({ id: p.id, type: p.type, name: p.name, description: p.description, image: productImage(p), price: p.price, compareAtPrice: p.compareAtPrice, soldOut: p.stock != null && p.stock <= 0, left: p.stock != null && p.stock <= 5 ? Math.max(0, p.stock) : null }))
}

export type PublicProduct = Awaited<ReturnType<typeof productsFor>>[number]

const ORDER_INCLUDE = { items: { select: { id: true, productId: true, name: true, type: true, unitPrice: true, qty: true, amount: true } } } satisfies Prisma.ShopOrderInclude

/** Commande telle que la voit le visiteur ; le contenu numérique n'apparaît qu'une fois payée. */
export async function visitorOrders(where: Prisma.ShopOrderWhereInput) {
  const orders = await prisma.shopOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10, include: { items: { select: { name: true, type: true, unitPrice: true, qty: true, amount: true, product: { select: { digitalContent: true } } } } } })
  return orders.map(o => {
    const paid = o.status === 'PAID' || o.status === 'DELIVERED'
    return {
      id: o.id, number: orderNo(o.number), status: o.status, total: o.total, createdAt: o.createdAt.toISOString(), paymentMethod: o.paymentMethod,
      deliveredLabel: deliveredLabel(o.items.map(i => i.type)),
      items: o.items.map(i => ({ name: i.name, type: i.type, qty: i.qty, amount: i.amount, content: paid && i.type === 'DIGITAL' ? i.product?.digitalContent ?? null : null }))
    }
  })
}

export type VisitorOrder = Awaited<ReturnType<typeof visitorOrders>>[number]

async function nextNumber(tx: Prisma.TransactionClient, orgId: string) {
  const last = await tx.shopOrder.aggregate({ where: { organizationId: orgId }, _max: { number: true } })
  return (last._max.number ?? 0) + 1
}

export class ShopError extends Error { readonly expected = true }

/**
 * Commande du visiteur : prix et stock relus en base, stock réservé (rendu si la commande est annulée),
 * numéro propre à l'établissement. L'équipe du site est prévenue.
 */
export async function placeOrder(input: { orgId: string; branchId: string; serviceId: string | null; moment: ShopMoment; ticketId?: string | null; appointmentId?: string | null; customerId?: string | null; userId?: string | null; lines: CartLine[] }) {
  const offered = await productsFor(input.orgId, input.branchId, input.serviceId, input.moment)
  const ids = offered.map(p => p.id)
  const products = await prisma.shopProduct.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, type: true, price: true, stock: true, lowStockAt: true } })
  const cart = priceCart(input.lines, products)
  if (!cart.ok) throw new ShopError(cart.error)

  let order = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await prisma.$transaction(async tx => {
        for (const it of cart.items) {
          const p = products.find(x => x.id === it.productId)!
          if (p.stock == null) continue
          const r = await tx.shopProduct.updateMany({ where: { id: p.id, stock: { gte: it.qty } }, data: { stock: { decrement: it.qty } } })
          if (!r.count) throw new ShopError(`« ${p.name} » vient d’être épuisé`)
        }
        return tx.shopOrder.create({
          data: {
            organizationId: input.orgId, branchId: input.branchId, number: await nextNumber(tx, input.orgId), total: cart.total, moment: input.moment,
            ticketId: input.ticketId ?? null, appointmentId: input.appointmentId ?? null, customerId: input.customerId ?? null, userId: input.userId ?? null,
            items: { create: cart.items }, events: { create: { status: 'REQUESTED' } }
          },
          include: ORDER_INCLUDE
        })
      })
    } catch (e) {
      // Deux commandes au même instant : même numéro, on recommence
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 2) continue
      throw e
    }
  }
  if (!order) throw new ShopError('Commande impossible pour le moment, réessayez')

  const n = cart.items.reduce((s, i) => s + i.qty, 0)
  await Promise.all([
    notify({
      event: 'ORDER_NEW', orgId: input.orgId, siteId: input.branchId,
      title: `Commande ${orderNo(order.number)} · ${priceLabel(order.total)}`,
      body: `${n} article${n > 1 ? 's' : ''} : ${cart.items.map(i => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', ')}`.slice(0, 180),
      url: '/reception/orders', groupKey: `orders:${input.branchId}`, groupTitle: c => `${c} nouvelles commandes`
    }).catch(() => null),
    notifyOrg(input.orgId).catch(() => null),
    lowStockCheck(input.orgId, cart.items.map(i => i.productId))
  ])
  return order
}

/** Stock bas : un avis aux responsables quand un produit passe sous son seuil. */
async function lowStockCheck(orgId: string, productIds: string[]) {
  const low = await prisma.shopProduct.findMany({ where: { id: { in: productIds }, stock: { not: null }, lowStockAt: { not: null } }, select: { id: true, name: true, stock: true, lowStockAt: true } })
  for (const p of low) {
    if (p.stock! > p.lowStockAt!) continue
    await notify({ event: 'STOCK_LOW', orgId, roles: ['MANAGER'], title: p.stock! <= 0 ? `« ${p.name} » est épuisé` : `Stock bas : « ${p.name} »`, body: `Il reste ${Math.max(0, p.stock!)} exemplaire${p.stock! > 1 ? 's' : ''}.`, url: '/dashboard/shop', groupKey: `stock:${p.id}` }).catch(() => null)
  }
}

/**
 * Passage d'une commande à un nouvel état par l'équipe (ou annulation par le visiteur, actorId vide).
 * « Payée » exige le mode de paiement ; « Annulée » et « Remboursée » exigent un motif.
 */
export async function moveOrder(orderId: string, orgId: string, to: OrderStatus, opts: { actorId: string | null; method?: string | null; reason?: string | null; siteIds?: string[] | null }) {
  const order = await prisma.shopOrder.findFirst({ where: { id: orderId, organizationId: orgId, ...(opts.siteIds ? { branchId: { in: opts.siteIds } } : {}) }, include: { items: true } })
  if (!order) throw new ShopError('Commande introuvable')
  if (!canTransition(order.status, to)) throw new ShopError('Cette commande ne peut plus passer à cet état')
  const reason = opts.reason?.trim().slice(0, 300) || null
  if (needsReason(to) && !reason) throw new ShopError('Indiquez le motif')
  if (to === 'PAID' && !isShopPayMethod(opts.method)) throw new ShopError('Choisissez le mode de paiement')

  const now = new Date()
  const data: Prisma.ShopOrderUpdateInput = { status: to }
  if (to === 'PAID') Object.assign(data, { paidAt: now, paidById: opts.actorId, paymentMethod: opts.method })
  if (to === 'DELIVERED') data.deliveredAt = now
  if (to === 'CANCELLED' || to === 'REFUNDED') Object.assign(data, { closedAt: now, closedReason: reason })

  const updated = await prisma.$transaction(async tx => {
    // Compare-et-échange : deux personnes qui cliquent en même temps ne font qu'un seul passage
    const r = await tx.shopOrder.updateMany({ where: { id: order.id, status: order.status }, data: data as Prisma.ShopOrderUpdateManyMutationInput })
    if (!r.count) throw new ShopError('La commande vient d’être modifiée : rechargez')
    await tx.shopOrderEvent.create({ data: { orderId: order.id, status: to, actorId: opts.actorId, note: to === 'PAID' ? SHOP_PAY_METHODS[opts.method as keyof typeof SHOP_PAY_METHODS] : reason } })
    // Annulée avant la remise : le stock réservé revient
    if (to === 'CANCELLED') {
      for (const it of order.items) if (it.productId) await tx.shopProduct.updateMany({ where: { id: it.productId, stock: { not: null } }, data: { stock: { increment: it.qty } } })
    }
    return tx.shopOrder.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE })
  })

  if (to === 'PAID') await deliverDigital(order.id).catch(e => console.error('Envoi du produit numérique :', e))
  await notifyOrg(orgId).catch(() => null)
  return updated
}

/** Produit numérique payé : le lien ou le code part au visiteur (ticket, puis WhatsApp ou SMS, puis e-mail). */
export async function deliverDigital(orderId: string) {
  const o = await prisma.shopOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, number: true, organizationId: true, ticketId: true, appointmentId: true, digitalSentAt: true,
      organization: { select: { name: true } },
      customer: { select: { phone: true, optedOutAt: true } },
      items: { where: { type: 'DIGITAL' }, select: { name: true, product: { select: { digitalContent: true } } } }
    }
  })
  const lines = (o?.items ?? []).filter(i => i.product?.digitalContent).map(i => `${i.name} : ${i.product!.digitalContent}`)
  if (!o || !lines.length || o.digitalSentAt) return false
  const claimed = await prisma.shopOrder.updateMany({ where: { id: o.id, digitalSentAt: null }, data: { digitalSentAt: new Date() } })
  if (!claimed.count) return false

  const text = `${o.organization.name} · commande ${orderNo(o.number)}\n${lines.join('\n')}`
  const ticket = o.ticketId ? await prisma.ticket.findUnique({ where: { id: o.ticketId }, select: { id: true, guestPhone: true, user: { select: { phone: true, email: true } } } }) : null
  if (ticket) await sendPushToTicket(ticket.id, { title: 'Votre achat est disponible', body: lines.join(' · ').slice(0, 140), url: `/ticket/${ticket.id}`, tag: `order-${o.id}` }).catch(() => null)
  // Message de service lié à un achat : envoyé même sans accord pour les messages d'information
  const phone = o.customer?.phone || ticket?.guestPhone || ticket?.user?.phone
  if (phone) await sendWhatsAppMessage({ to: phone, text, purpose: 'SHOP_ORDER', organizationId: o.organizationId, ticketId: o.ticketId }).catch(() => null)
  const email = ticket?.user?.email
  if (email) await sendEmail({ to: email, subject: `Votre achat · ${o.organization.name}`, text: `${text}\n\nReçu : ${appUrl()}/shop/receipt/${o.id}`, purpose: 'SHOP_ORDER', organizationId: o.organizationId }).catch(() => null)
  return true
}

/** Ticket quitté ou rendez-vous annulé : les commandes pas encore réglées sont annulées (le stock revient). */
export async function cancelUnpaidOrders(where: { ticketId?: string; appointmentId?: string }, orgId: string, reason: string) {
  const open = await prisma.shopOrder.findMany({ where: { organizationId: orgId, ...where, status: { in: ['REQUESTED', 'CONFIRMED'] } }, select: { id: true } })
  for (const o of open) await moveOrder(o.id, orgId, 'CANCELLED', { actorId: null, reason }).catch(() => null)
  return open.length
}
