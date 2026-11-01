'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { getPlatformConfig } from '@/lib/platform'
import { requestPasswordReset } from '@/server/actions/account'
import {
  BillingError, FEATURES, PAYMENT_METHODS, billingState, createInvoice, createSubscriptionInvoice, ensureSubscription,
  monthlyRevenue, notifyInvoice, recordPayment, siteCount, smsAllowance, type Feature, type InvoiceLine
} from '@/lib/billing'

// Console de la startup (/admin) : clients, forfaits, catalogue, factures, paiements, réglages de facturation.
// Réservée au SUPER_ADMIN ; chaque changement est tracé dans le journal.

const DENIED = { success: false as const, error: 'Accès réservé à l’administration de la plateforme' }
const fail = (e: unknown) => ({ success: false as const, error: e instanceof BillingError || e instanceof Error ? e.message : 'Opération impossible' })
const DAY = 86400_000
const int = (v: unknown, min = 0, max = 1e9) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min }
const optInt = (v: unknown, min = 0) => (v === '' || v == null ? null : int(v, min))
const text = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

function refresh(orgId?: string) {
  revalidatePath('/admin', 'layout')
  if (orgId) revalidatePath(`/admin/clients/${orgId}`)
}

// ---- Vue d'ensemble ----

const monthKey = (d: Date) => d.toISOString().slice(0, 7)

/** Indicateurs de la startup : revenu récurrent, clients, encaissements, impayés, essais, activité. */
export async function getAdminOverview() {
  if (!(await getSuperAdmin())) return null
  const config = await getPlatformConfig()
  const now = new Date()
  const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const [orgs, payments, openInvoices, tickets30, ticketsByDay, users, plans] = await Promise.all([
    prisma.organization.findMany({
      select: { id: true, name: true, createdAt: true, subscription: { include: { plan: true } }, _count: { select: { branches: { where: { isActive: true } } } } }
    }),
    prisma.payment.findMany({ where: { receivedAt: { gte: yearAgo } }, orderBy: { receivedAt: 'desc' }, include: { invoice: { select: { number: true, organization: { select: { id: true, name: true } } } } } }),
    prisma.invoice.findMany({ where: { status: 'SENT' }, orderBy: { dueAt: 'asc' }, include: { organization: { select: { id: true, name: true } }, payments: { select: { amount: true } } } }),
    prisma.ticket.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } } }),
    prisma.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*) AS n FROM "Ticket" WHERE "createdAt" >= ${new Date(now.getTime() - 30 * DAY)} GROUP BY 1 ORDER BY 1`,
    prisma.user.count(),
    prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  ])

  let mrr = 0
  const byPlan = new Map<string, { name: string; clients: number; mrr: number }>(plans.map(p => [p.id, { name: p.name, clients: 0, mrr: 0 }]))
  const counts = { TRIAL: 0, ACTIVE: 0, GRACE: 0, SUSPENDED: 0, CANCELLED: 0 }
  const trialsEnding: { id: string; name: string; daysLeft: number }[] = []
  for (const o of orgs) {
    if (!o.subscription) { counts.TRIAL++; continue }
    const st = billingState(o.subscription, config.graceDays, now)
    counts[st.state]++
    const paying = st.state === 'ACTIVE' || st.state === 'GRACE'
    const m = paying ? monthlyRevenue(o.subscription, o.subscription.plan, Math.max(1, o._count.branches)) : 0
    mrr += m
    const p = byPlan.get(o.subscription.planId)
    if (p && (paying || st.state === 'TRIAL')) { p.clients++; p.mrr += m }
    if (st.state === 'TRIAL' && st.daysLeft != null && st.daysLeft <= 7) trialsEnding.push({ id: o.id, name: o.name, daysLeft: st.daysLeft })
  }
  const paying = counts.ACTIVE + counts.GRACE

  // 12 derniers mois : encaissements et nouveaux clients
  const months: { key: string; label: string; cash: number; newClients: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push({ key: monthKey(d), label: d.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', ''), cash: 0, newClients: 0 })
  }
  const idx = new Map(months.map((m, i) => [m.key, i]))
  for (const p of payments) { const i = idx.get(monthKey(p.receivedAt)); if (i != null) months[i].cash += p.amount }
  for (const o of orgs) { const i = idx.get(monthKey(o.createdAt)); if (i != null) months[i].newClients++ }

  const days = new Map(ticketsByDay.map(r => [r.day.toISOString().slice(0, 10), Number(r.n)]))
  const activity = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now.getTime() - (29 - i) * DAY).toISOString().slice(0, 10)
    return { day: d, n: days.get(d) ?? 0 }
  })

  const unpaid = openInvoices.map(i => ({ id: i.id, number: i.number, org: i.organization, due: i.total - i.payments.reduce((s, p) => s + p.amount, 0), dueAt: i.dueAt.toISOString(), overdue: i.dueAt < now }))
  return {
    mrr, arr: mrr * 12, arpa: paying ? Math.round(mrr / paying) : 0,
    clients: orgs.length, counts, users, tickets30,
    cashThisMonth: payments.filter(p => p.receivedAt >= monthStart).reduce((s, p) => s + p.amount, 0),
    unpaidTotal: unpaid.reduce((s, i) => s + i.due, 0),
    overdueTotal: unpaid.filter(i => i.overdue).reduce((s, i) => s + i.due, 0),
    months, activity,
    byPlan: Array.from(byPlan.values()).filter(p => p.clients > 0),
    trialsEnding: trialsEnding.sort((a, b) => a.daysLeft - b.daysLeft),
    overdue: unpaid.filter(i => i.overdue).slice(0, 8),
    recentPayments: payments.slice(0, 8).map(p => ({ id: p.id, amount: p.amount, method: PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method, receivedAt: p.receivedAt.toISOString(), invoice: p.invoice.number, org: p.invoice.organization }))
  }
}

// ---- Clients ----

export async function getClients() {
  if (!(await getSuperAdmin())) return null
  const config = await getPlatformConfig()
  const since = new Date(Date.now() - 30 * DAY)
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, city: true, category: true, isActive: true, createdAt: true, featuredUntil: true,
      network: { select: { name: true } },
      subscription: { include: { plan: { select: { id: true, name: true, priceMonthly: true, yearlyDiscountPct: true } } } },
      _count: { select: { branches: { where: { isActive: true } }, members: true } },
      invoices: { where: { status: 'SENT' }, select: { total: true, dueAt: true } }
    }
  })
  const tickets = await prisma.ticket.groupBy({ by: ['queueId'], where: { createdAt: { gte: since } }, _count: true, _max: { createdAt: true } })
  const queues = await prisma.queue.findMany({ where: { id: { in: tickets.map(t => t.queueId) } }, select: { id: true, branch: { select: { organizationId: true } } } })
  const orgOf = new Map(queues.map(q => [q.id, q.branch.organizationId]))
  const usage = new Map<string, { n: number; last: Date | null }>()
  for (const t of tickets) {
    const id = orgOf.get(t.queueId); if (!id) continue
    const u = usage.get(id) ?? { n: 0, last: null }
    u.n += t._count; if (t._max.createdAt && (!u.last || t._max.createdAt > u.last)) u.last = t._max.createdAt
    usage.set(id, u)
  }
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  return {
    plans,
    clients: orgs.map(o => {
      const sites = Math.max(1, o._count.branches)
      const sub = o.subscription
      const state = sub ? billingState(sub, config.graceDays) : { state: 'TRIAL' as const, until: null, daysLeft: null }
      const mrr = sub && (state.state === 'ACTIVE' || state.state === 'GRACE') ? monthlyRevenue(sub, sub.plan, sites) : 0
      const now = Date.now()
      return {
        id: o.id, name: o.name, city: o.city, category: o.category, isActive: o.isActive, network: o.network?.name ?? null,
        createdAt: o.createdAt.toISOString(), sites, members: o._count.members,
        planId: sub?.planId ?? null, planName: sub?.plan.name ?? '—', cycle: sub?.billingCycle ?? 'MONTHLY',
        state: state.state, daysLeft: state.daysLeft, mrr,
        due: o.invoices.reduce((s, i) => s + i.total, 0), overdue: o.invoices.some(i => i.dueAt.getTime() < now),
        featured: !!o.featuredUntil && o.featuredUntil.getTime() > now,
        tickets30d: usage.get(o.id)?.n ?? 0, lastActivity: usage.get(o.id)?.last?.toISOString() ?? null
      }
    })
  }
}

export async function getClient(orgId: string) {
  if (!(await getSuperAdmin())) return null
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      network: { select: { name: true } },
      branches: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, city: true, isActive: true, _count: { select: { counters: true, services: true } } } },
      members: { include: { user: { select: { id: true, name: true, email: true, phone: true, role: true, lastLoginAt: true, twoFactorEnabled: true } } } },
      invoices: { orderBy: { issuedAt: 'desc' }, take: 50, include: { payments: true } },
      smsLedger: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { devices: true } }
    }
  })
  if (!org) return null
  await ensureSubscription(orgId)
  const [sub, config, sites, sms, plans, auditRows] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } }),
    getPlatformConfig(), siteCount(orgId), smsAllowance(orgId),
    prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.auditLog.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 15 })
  ])
  const monthStart = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z')
  const ticketsMonth = await prisma.ticket.count({ where: { queue: { branch: { organizationId: orgId } }, createdAt: { gte: monthStart } } })
  const state = billingState(sub!, config.graceDays)
  return {
    org: {
      id: org.id, name: org.name, city: org.city, address: org.address, phone: org.phone, email: org.email, category: org.category,
      isActive: org.isActive, network: org.network?.name ?? null, createdAt: org.createdAt.toISOString(),
      smsCredits: org.smsCredits, featuredUntil: org.featuredUntil?.toISOString() ?? null, devices: org._count.devices
    },
    sub: {
      ...sub!, trialEndsAt: sub!.trialEndsAt?.toISOString() ?? null, currentPeriodEnd: sub!.currentPeriodEnd?.toISOString() ?? null,
      suspendedAt: sub!.suspendedAt?.toISOString() ?? null, cancelledAt: sub!.cancelledAt?.toISOString() ?? null,
      createdAt: sub!.createdAt.toISOString(), updatedAt: sub!.updatedAt.toISOString(), plan: { ...sub!.plan, createdAt: '', updatedAt: '' }
    },
    state: { ...state, until: state.until?.toISOString() ?? null },
    mrr: monthlyRevenue(sub!, sub!.plan, sites), sites, sms, ticketsMonth,
    plans: plans.map(p => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly })),
    branches: org.branches.map(b => ({ id: b.id, name: b.name, city: b.city, isActive: b.isActive, counters: b._count.counters, services: b._count.services })),
    members: org.members.map(m => ({ ...m.user, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null, orgRole: m.role })),
    invoices: org.invoices.map(i => ({ id: i.id, number: i.number, kind: i.kind, status: i.status, total: i.total, issuedAt: i.issuedAt.toISOString(), dueAt: i.dueAt.toISOString(), paidAt: i.paidAt?.toISOString() ?? null, paid: i.payments.reduce((s, p) => s + p.amount, 0) })),
    smsLedger: org.smsLedger.map(l => ({ id: l.id, delta: l.delta, reason: l.reason, createdAt: l.createdAt.toISOString() })),
    audit: auditRows.map(a => ({ id: a.id, action: a.action, details: a.details, createdAt: a.createdAt.toISOString() }))
  }
}

export async function updateSubscription(orgId: string, data: { planId: string; billingCycle: string; customPricePerSite: string | number | null; discountPct: string | number; notes?: string }) {
  if (!(await getSuperAdmin())) return DENIED
  try {
    const sub = await ensureSubscription(orgId)
    const plan = await prisma.plan.findUnique({ where: { id: data.planId } })
    if (!plan) return { success: false as const, error: 'Forfait introuvable' }
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id, billingCycle: data.billingCycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
        customPricePerSite: optInt(data.customPricePerSite), discountPct: int(data.discountPct, 0, 100), notes: text(data.notes, 2000)
      }
    })
    await audit({ action: 'SUBSCRIPTION_UPDATED', targetType: 'Subscription', targetId: sub.id, organizationId: orgId, details: `${plan.name} · ${data.billingCycle}` })
    refresh(orgId)
    return { success: true as const }
  } catch (e) { return fail(e) }
}

export async function extendTrial(orgId: string, days: number) {
  if (!(await getSuperAdmin())) return DENIED
  const sub = await ensureSubscription(orgId)
  const from = sub.trialEndsAt && sub.trialEndsAt > new Date() ? sub.trialEndsAt : new Date()
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'TRIAL', trialEndsAt: new Date(from.getTime() + int(days, 1, 365) * DAY), suspendedAt: null } })
  await audit({ action: 'TRIAL_EXTENDED', targetType: 'Subscription', targetId: sub.id, organizationId: orgId, details: `+${days} jours` })
  refresh(orgId)
  return { success: true as const }
}

/** Suspension (impayé, fraude…) ou réactivation : la suspension coupe les tickets en ligne, pas les données. */
export async function setSuspended(orgId: string, suspended: boolean, reason?: string) {
  if (!(await getSuperAdmin())) return DENIED
  const sub = await ensureSubscription(orgId)
  const next = suspended ? 'SUSPENDED' : (sub.currentPeriodEnd && sub.currentPeriodEnd > new Date() ? 'ACTIVE' : sub.trialEndsAt && sub.trialEndsAt > new Date() ? 'TRIAL' : 'ACTIVE')
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: next, suspendedAt: suspended ? new Date() : null } })
  await audit({ action: suspended ? 'CLIENT_SUSPENDED' : 'CLIENT_REACTIVATED', targetType: 'Subscription', targetId: sub.id, organizationId: orgId, details: text(reason) ?? undefined })
  refresh(orgId)
  return { success: true as const }
}

/** Résiliation : l'établissement reste consultable, plus aucun ticket en ligne. */
export async function cancelSubscription(orgId: string, reason?: string) {
  if (!(await getSuperAdmin())) return DENIED
  const sub = await ensureSubscription(orgId)
  await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  await audit({ action: 'SUBSCRIPTION_CANCELLED', targetType: 'Subscription', targetId: sub.id, organizationId: orgId, details: text(reason) ?? undefined })
  refresh(orgId)
  return { success: true as const }
}

export async function setFeatured(orgId: string, days: number) {
  if (!(await getSuperAdmin())) return DENIED
  const until = days > 0 ? new Date(Date.now() + int(days, 1, 365) * DAY) : null
  await prisma.organization.update({ where: { id: orgId }, data: { featuredUntil: until } })
  await audit({ action: 'FEATURED_SET', targetType: 'Organization', targetId: orgId, organizationId: orgId, details: until ? `jusqu’au ${until.toISOString().slice(0, 10)}` : 'retiré' })
  refresh(orgId)
  revalidatePath('/explore')
  return { success: true as const }
}

export async function adjustSmsCredits(orgId: string, delta: number, reason: string) {
  if (!(await getSuperAdmin())) return DENIED
  const d = Math.round(Number(delta))
  if (!d) return { success: false as const, error: 'Indiquez un nombre de SMS' }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { smsCredits: true } })
  if (!org) return { success: false as const, error: 'Établissement introuvable' }
  if (org.smsCredits + d < 0) return { success: false as const, error: `Solde insuffisant (${org.smsCredits} SMS)` }
  await prisma.organization.update({ where: { id: orgId }, data: { smsCredits: { increment: d } } })
  await prisma.smsLedger.create({ data: { organizationId: orgId, delta: d, reason: text(reason, 120) ?? 'Ajustement manuel' } })
  await audit({ action: 'SMS_CREDITS_ADJUSTED', targetType: 'Organization', targetId: orgId, organizationId: orgId, details: `${d > 0 ? '+' : ''}${d} SMS` })
  refresh(orgId)
  return { success: true as const }
}

// ---- Forfaits ----

export async function getPlans() {
  if (!(await getSuperAdmin())) return null
  const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { subscriptions: true } } } })
  return { plans: plans.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), subscribers: p._count.subscriptions })), features: FEATURES }
}

export async function savePlan(data: {
  id?: string; code: string; name: string; tagline?: string; priceMonthly: string | number | null; yearlyDiscountPct: string | number
  maxCounters: string | number | null; maxServices: string | number | null; maxTicketsMonth: string | number | null; smsIncluded: string | number
  features: string[]; isPublic: boolean; isActive: boolean; highlight: boolean; sortOrder: string | number
}) {
  if (!(await getSuperAdmin())) return DENIED
  const name = text(data.name, 40)
  const code = (text(data.code, 30) ?? name ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!name || !code) return { success: false as const, error: 'Nom du forfait requis' }
  const values = {
    code, name, tagline: text(data.tagline, 120), priceMonthly: optInt(data.priceMonthly), yearlyDiscountPct: int(data.yearlyDiscountPct, 0, 90),
    maxCounters: optInt(data.maxCounters, 1), maxServices: optInt(data.maxServices, 1), maxTicketsMonth: optInt(data.maxTicketsMonth, 1),
    smsIncluded: int(data.smsIncluded), features: data.features.filter((f): f is Feature => f in FEATURES),
    isPublic: !!data.isPublic, isActive: !!data.isActive, highlight: !!data.highlight, sortOrder: int(data.sortOrder)
  }
  try {
    const plan = data.id ? await prisma.plan.update({ where: { id: data.id }, data: values }) : await prisma.plan.create({ data: values })
    // Un seul forfait « mis en avant » sur la page des tarifs
    if (plan.highlight) await prisma.plan.updateMany({ where: { id: { not: plan.id } }, data: { highlight: false } })
    await audit({ action: data.id ? 'PLAN_UPDATED' : 'PLAN_CREATED', targetType: 'Plan', targetId: plan.id, details: `${plan.name} · ${plan.priceMonthly ?? 'sur devis'}` })
    refresh()
    return { success: true as const }
  } catch (e: any) {
    if (e?.code === 'P2002') return { success: false as const, error: 'Ce code de forfait existe déjà' }
    return fail(e)
  }
}

// ---- Catalogue ----

export async function getProducts() {
  if (!(await getSuperAdmin())) return null
  const products = await prisma.product.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  return products.map(p => ({ ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString() }))
}

export async function saveProduct(data: { id?: string; kind: string; name: string; description?: string; price: string | number; rentalMonthly?: string | number | null; smsQuantity?: string | number | null; featuredDays?: string | number | null; isActive: boolean; sortOrder?: string | number }) {
  if (!(await getSuperAdmin())) return DENIED
  const name = text(data.name, 80)
  if (!name) return { success: false as const, error: 'Nom requis' }
  const kind = ['SMS_PACK', 'FEATURED', 'HARDWARE', 'SETUP', 'OTHER'].includes(data.kind) ? data.kind : 'OTHER'
  if (kind === 'SMS_PACK' && !optInt(data.smsQuantity, 1)) return { success: false as const, error: 'Nombre de SMS du pack requis' }
  if (kind === 'FEATURED' && !optInt(data.featuredDays, 1)) return { success: false as const, error: 'Durée de mise en avant requise' }
  const values = {
    kind, name, description: text(data.description, 300), price: int(data.price),
    rentalMonthly: kind === 'HARDWARE' ? optInt(data.rentalMonthly) : null,
    smsQuantity: kind === 'SMS_PACK' ? optInt(data.smsQuantity, 1) : null,
    featuredDays: kind === 'FEATURED' ? optInt(data.featuredDays, 1) : null,
    isActive: !!data.isActive, sortOrder: int(data.sortOrder)
  }
  const product = data.id ? await prisma.product.update({ where: { id: data.id }, data: values }) : await prisma.product.create({ data: values })
  await audit({ action: data.id ? 'PRODUCT_UPDATED' : 'PRODUCT_CREATED', targetType: 'Product', targetId: product.id, details: `${product.name} · ${product.price}` })
  refresh()
  return { success: true as const }
}

// ---- Factures et paiements ----

export async function getInvoices(filter: { status?: string; q?: string } = {}) {
  if (!(await getSuperAdmin())) return null
  const q = filter.q?.trim()
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(filter.status === 'OVERDUE' ? { status: 'SENT', dueAt: { lt: new Date() } } : filter.status ? { status: filter.status } : {}),
      ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { organization: { name: { contains: q, mode: 'insensitive' } } }] } : {})
    },
    orderBy: { issuedAt: 'desc' }, take: 200,
    include: { organization: { select: { id: true, name: true } }, payments: { select: { amount: true } } }
  })
  return invoices.map(i => ({
    id: i.id, number: i.number, kind: i.kind, status: i.status, total: i.total, org: i.organization,
    issuedAt: i.issuedAt.toISOString(), dueAt: i.dueAt.toISOString(), paidAt: i.paidAt?.toISOString() ?? null,
    paid: i.payments.reduce((s, p) => s + p.amount, 0), overdue: i.status === 'SENT' && i.dueAt < new Date()
  }))
}

export async function invoiceSubscription(orgId: string) {
  const admin = await getSuperAdmin()
  if (!admin) return DENIED
  try {
    const invoice = await createSubscriptionInvoice(orgId, admin.id)
    await audit({ action: 'INVOICE_CREATED', targetType: 'Invoice', targetId: invoice.id, organizationId: orgId, details: `${invoice.number} · ${invoice.total}` })
    refresh(orgId)
    return { success: true as const, id: invoice.id, number: invoice.number }
  } catch (e) { return fail(e) }
}

/** Facture libre (matériel sur devis, prestation…). */
export async function createCustomInvoice(orgId: string, lines: { label: string; qty: number | string; unitPrice: number | string }[], notes?: string) {
  const admin = await getSuperAdmin()
  if (!admin) return DENIED
  const clean: InvoiceLine[] = lines.map(l => ({ label: text(l.label, 120) ?? '', qty: int(l.qty, 1, 10000), unitPrice: Math.round(Number(l.unitPrice) || 0), amount: 0 }))
    .filter(l => l.label && l.unitPrice !== 0).map(l => ({ ...l, amount: l.qty * l.unitPrice }))
  if (clean.length === 0) return { success: false as const, error: 'Ajoutez au moins une ligne' }
  try {
    const invoice = await createInvoice({ orgId, kind: 'ORDER', lines: clean, notes: text(notes, 1000), createdById: admin.id })
    await audit({ action: 'INVOICE_CREATED', targetType: 'Invoice', targetId: invoice.id, organizationId: orgId, details: `${invoice.number} · ${invoice.total}` })
    refresh(orgId)
    return { success: true as const, id: invoice.id, number: invoice.number }
  } catch (e) { return fail(e) }
}

export async function addPayment(invoiceId: string, data: { amount: number | string; method: string; reference?: string }) {
  const admin = await getSuperAdmin()
  if (!admin) return DENIED
  if (!(data.method in PAYMENT_METHODS)) return { success: false as const, error: 'Moyen de paiement inconnu' }
  try {
    const res = await recordPayment({ invoiceId, amount: Number(data.amount), method: data.method as keyof typeof PAYMENT_METHODS, reference: data.reference, recordedById: admin.id })
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { number: true, organizationId: true } })
    await audit({ action: 'PAYMENT_RECORDED', targetType: 'Invoice', targetId: invoiceId, organizationId: inv?.organizationId, details: `${inv?.number} · ${data.amount} · ${PAYMENT_METHODS[data.method as keyof typeof PAYMENT_METHODS]}` })
    refresh(inv?.organizationId)
    return { success: true as const, ...res }
  } catch (e) { return fail(e) }
}

export async function voidInvoice(invoiceId: string, reason?: string) {
  if (!(await getSuperAdmin())) return DENIED
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { status: true, number: true, organizationId: true } })
  if (!inv) return { success: false as const, error: 'Facture introuvable' }
  if (inv.status === 'PAID') return { success: false as const, error: 'Une facture réglée ne peut pas être annulée' }
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'VOID' } })
  await audit({ action: 'INVOICE_VOIDED', targetType: 'Invoice', targetId: invoiceId, organizationId: inv.organizationId, details: `${inv.number}${reason ? ' · ' + reason : ''}` })
  refresh(inv.organizationId)
  return { success: true as const }
}

export async function resendInvoice(invoiceId: string) {
  if (!(await getSuperAdmin())) return DENIED
  await notifyInvoice(invoiceId)
  return { success: true as const }
}

// ---- Réglages de facturation ----

export async function getBillingSettings() {
  if (!(await getSuperAdmin())) return null
  const [config, plans] = await Promise.all([getPlatformConfig(), prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })])
  return { config: { ...config, updatedAt: config.updatedAt.toISOString() }, plans }
}

export async function saveBillingSettings(data: {
  trialDays: number | string; trialPlanId: string; graceDays: number | string; paymentTermDays: number | string; taxRate: number | string; invoicePrefix: string
  companyName?: string; companyAddress?: string; companyTaxId?: string; companyRccm?: string; companyPhone?: string; companyEmail?: string; paymentInstructions?: string
}) {
  if (!(await getSuperAdmin())) return DENIED
  const prefix = (text(data.invoicePrefix, 8) ?? 'LER').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'LER'
  await prisma.platformConfig.upsert({
    where: { id: 'default' }, create: { id: 'default' },
    update: {
      trialDays: int(data.trialDays, 0, 365), trialPlanId: data.trialPlanId || null, graceDays: int(data.graceDays, 0, 90),
      paymentTermDays: int(data.paymentTermDays, 0, 120), taxRate: int(data.taxRate, 0, 50), invoicePrefix: prefix,
      companyName: text(data.companyName, 80), companyAddress: text(data.companyAddress, 200), companyTaxId: text(data.companyTaxId, 40),
      companyRccm: text(data.companyRccm, 40), companyPhone: text(data.companyPhone, 40), companyEmail: text(data.companyEmail, 80),
      paymentInstructions: text(data.paymentInstructions, 1000)
    }
  })
  await audit({ action: 'BILLING_SETTINGS_UPDATED', details: `essai ${data.trialDays} j · grâce ${data.graceDays} j · TVA ${data.taxRate} %` })
  refresh()
  return { success: true as const }
}

// ---- Utilisateurs de la plateforme ----

export async function searchUsers(q: string) {
  if (!(await getSuperAdmin())) return null
  const s = q.trim()
  const users = await prisma.user.findMany({
    where: s ? { OR: [{ name: { contains: s, mode: 'insensitive' } }, { email: { contains: s, mode: 'insensitive' } }, { phone: { contains: s } }] } : {},
    orderBy: { createdAt: 'desc' }, take: 50,
    select: {
      id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true, twoFactorEnabled: true, mustChangePassword: true,
      memberships: { select: { organization: { select: { id: true, name: true } } } },
      _count: { select: { tickets: true, authSessions: { where: { revokedAt: null } } } }
    }
  })
  return users.map(u => ({
    ...u, createdAt: u.createdAt.toISOString(), lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    orgs: u.memberships.map(m => m.organization), tickets: u._count.tickets, sessions: u._count.authSessions
  }))
}

/** Actions de support sur un compte : déconnexion partout, lien de réinitialisation, retrait de la double authentification. */
export async function supportUserAction(userId: string, action: 'SIGN_OUT' | 'RESET_LINK' | 'RESET_2FA') {
  const admin = await getSuperAdmin()
  if (!admin) return DENIED
  if (userId === admin.id && action !== 'RESET_LINK') return { success: false as const, error: 'Utilisez « Sécurité du compte » pour votre propre compte' }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, phone: true, role: true } })
  if (!user) return { success: false as const, error: 'Compte introuvable' }
  if (action === 'SIGN_OUT') {
    await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
    await prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  } else if (action === 'RESET_2FA') {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [], sessionVersion: { increment: 1 } } })
  } else {
    const id = user.email ?? user.phone
    if (!id) return { success: false as const, error: 'Ce compte n’a ni e-mail ni téléphone' }
    await requestPasswordReset(id)
  }
  await audit({ action: `SUPPORT_${action}`, targetType: 'User', targetId: userId, details: user.email ?? user.phone ?? undefined })
  return { success: true as const }
}
