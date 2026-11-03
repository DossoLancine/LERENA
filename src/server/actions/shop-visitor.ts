'use server'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'
import { hashSecret, isPlausibleSecret } from '@/lib/secrets'
import { rateLimit, RATE_LIMITED } from '@/lib/rate-limit'
import { moveOrder, placeOrder, productsFor, ShopError, visitorOrders } from '@/lib/shop-orders'
import { OPEN_STATUSES, visitorCanCancel, type CartLine, type ShopMoment } from '@/lib/shop'

// Boutique côté visiteur : depuis son ticket (pendant l'attente, après le service) ou le lien de son rendez-vous.
// Le lien du ticket ou du rendez-vous fait office d'accès, comme pour le suivi du ticket.

const MAX_OPEN_ORDERS = 3
const AFTER_WINDOW_MS = 24 * 3600_000

type Source = {
  orgId: string; orgName: string; branchId: string; serviceId: string | null; moment: ShopMoment | null
  ticketId: string | null; appointmentId: string | null; customerId: string | null; userId: string | null
  orderWhere: { OR: object[] }
}

async function fromTicket(ticketId: string): Promise<Source | null> {
  if (typeof ticketId !== 'string' || ticketId.length > 40) return null
  const [user, t] = await Promise.all([
    getSessionUser(),
    prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, userId: true, status: true, completedAt: true, serviceId: true, customerId: true, queue: { select: { branchId: true, branch: { select: { organization: { select: { id: true, name: true } } } } } } } })
  ])
  if (!t || (t.userId && t.userId !== user?.id)) return null
  const moment: ShopMoment | null = ['WAITING', 'CALLED', 'SERVING'].includes(t.status) ? 'WAITING'
    : t.status === 'COMPLETED' && t.completedAt && Date.now() - t.completedAt.getTime() < AFTER_WINDOW_MS ? 'AFTER' : null
  // Commandes du ticket et de son rendez-vous (une commande passée en réservant suit le visiteur à son arrivée)
  const appts = await prisma.appointment.findMany({ where: { ticketId: t.id }, select: { id: true } })
  return {
    orgId: t.queue.branch.organization.id, orgName: t.queue.branch.organization.name, branchId: t.queue.branchId, serviceId: t.serviceId, moment,
    ticketId: t.id, appointmentId: null, customerId: t.customerId, userId: t.userId,
    orderWhere: { OR: [{ ticketId: t.id }, ...(appts.length ? [{ appointmentId: { in: appts.map(a => a.id) } }] : [])] }
  }
}

async function fromAppointment(token: string): Promise<Source | null> {
  if (!isPlausibleSecret(token)) return null
  const a = await prisma.appointment.findUnique({ where: { manageTokenHash: hashSecret(token) }, select: { id: true, status: true, scheduledDate: true, serviceId: true, branchId: true, customerId: true, userId: true, ticketId: true, organization: { select: { id: true, name: true } } } })
  if (!a) return null
  const moment: ShopMoment | null = a.status === 'CONFIRMED' && !a.ticketId && a.scheduledDate.getTime() > Date.now() - 3600_000 ? 'BOOKING' : null
  return {
    orgId: a.organization.id, orgName: a.organization.name, branchId: a.branchId, serviceId: a.serviceId, moment,
    ticketId: null, appointmentId: a.id, customerId: a.customerId, userId: a.userId,
    orderWhere: { OR: [{ appointmentId: a.id }] }
  }
}

async function shopOf(src: Source | null) {
  if (!src) return null
  const [products, orders] = await Promise.all([
    src.moment ? productsFor(src.orgId, src.branchId, src.serviceId, src.moment) : Promise.resolve([]),
    visitorOrders({ organizationId: src.orgId, ...src.orderWhere })
  ])
  return { orgName: src.orgName, moment: src.moment, products, orders }
}

async function order(src: Source | null, lines: CartLine[]) {
  if (!src) return { success: false as const, error: 'Ticket introuvable' }
  if (!src.moment) return { success: false as const, error: 'La boutique n’est plus disponible pour ce passage' }
  if (!Array.isArray(lines)) return { success: false as const, error: 'Panier invalide' }
  if (!(await rateLimit(`shop:${src.ticketId ?? src.appointmentId}`, 8, 3600_000))) return { success: false as const, error: RATE_LIMITED }
  const open = await prisma.shopOrder.count({ where: { organizationId: src.orgId, ...src.orderWhere, status: { in: OPEN_STATUSES } } })
  if (open >= MAX_OPEN_ORDERS) return { success: false as const, error: 'Vous avez déjà des commandes en cours : finalisez-les au guichet' }
  try {
    const o = await placeOrder({ orgId: src.orgId, branchId: src.branchId, serviceId: src.serviceId, moment: src.moment, ticketId: src.ticketId, appointmentId: src.appointmentId, customerId: src.customerId, userId: src.userId, lines: lines.slice(0, 20) })
    return { success: true as const, id: o.id }
  } catch (e) {
    if (e instanceof ShopError) return { success: false as const, error: e.message }
    throw e
  }
}

async function cancel(src: Source | null, orderId: string) {
  if (!src) return { success: false as const, error: 'Ticket introuvable' }
  const o = await prisma.shopOrder.findFirst({ where: { id: orderId, organizationId: src.orgId, ...src.orderWhere }, select: { id: true, status: true } })
  if (!o) return { success: false as const, error: 'Commande introuvable' }
  if (!visitorCanCancel(o.status)) return { success: false as const, error: 'Cette commande est déjà réglée : voyez l’établissement' }
  try {
    await moveOrder(o.id, src.orgId, 'CANCELLED', { actorId: null, reason: 'Annulée par le visiteur' })
    return { success: true as const }
  } catch (e) {
    if (e instanceof ShopError) return { success: false as const, error: e.message }
    throw e
  }
}

export async function getTicketShop(ticketId: string) { return shopOf(await fromTicket(ticketId)) }
export async function placeTicketOrder(ticketId: string, lines: CartLine[]) { return order(await fromTicket(ticketId), lines) }
export async function cancelTicketOrder(ticketId: string, orderId: string) { return cancel(await fromTicket(ticketId), orderId) }

export async function getAppointmentShop(token: string) { return shopOf(await fromAppointment(token)) }
export async function placeAppointmentOrder(token: string, lines: CartLine[]) { return order(await fromAppointment(token), lines) }
export async function cancelAppointmentOrder(token: string, orderId: string) { return cancel(await fromAppointment(token), orderId) }

/** Parcours « vu → ajouté » : compté une fois par produit et par page (le navigateur évite les doublons). */
export async function trackShop(kind: 'view' | 'add', productIds: string[]) {
  if (!Array.isArray(productIds) || !productIds.length || (kind !== 'view' && kind !== 'add')) return
  const ids = Array.from(new Set(productIds.filter(id => typeof id === 'string' && id.length <= 40))).slice(0, 30)
  // SQL direct : ne touche pas à la date de modification (qui sert de version à l'image du produit)
  const q = kind === 'view'
    ? prisma.$executeRaw`UPDATE "ShopProduct" SET "views" = "views" + 1 WHERE "id" = ANY(${ids}) AND "isActive" = true`
    : prisma.$executeRaw`UPDATE "ShopProduct" SET "adds" = "adds" + 1 WHERE "id" = ANY(${ids}) AND "isActive" = true`
  await q.catch(() => null)
}
