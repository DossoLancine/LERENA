'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext, getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { getPlatformConfig } from '@/lib/platform'
import { sendEmail } from '@/lib/messaging'
import {
  BillingError, FEATURES, PAYMENT_METHODS, PRODUCT_KINDS, createOrderInvoice, getOrgBilling, monthlyRevenue,
  pricePerSite, smsAllowance, subscriptionInvoiceDraft, type InvoiceLine
} from '@/lib/billing'

// Abonnement vu par l'établissement (/dashboard/billing) : forfait, consommation, factures,
// changement de forfait, commandes au catalogue et déclaration de paiement.

const DENIED = { success: false as const, error: 'Réservé au responsable de l’établissement' }
const fail = (e: unknown) => ({ success: false as const, error: e instanceof BillingError || e instanceof Error ? e.message : 'Opération impossible' })

export async function getMyBilling() {
  const ctx = await getManagerContext('billing.view')
  if (!ctx) return null
  const [billing, config, sms, plans, products, invoices, counters, services] = await Promise.all([
    getOrgBilling(ctx.orgId), getPlatformConfig(), smsAllowance(ctx.orgId),
    prisma.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.invoice.findMany({ where: { organizationId: ctx.orgId, status: { not: 'DRAFT' } }, orderBy: { issuedAt: 'desc' }, take: 24, include: { payments: { select: { amount: true } } } }),
    prisma.counter.groupBy({ by: ['branchId'], where: { branch: { organizationId: ctx.orgId } }, _count: true }),
    prisma.service.groupBy({ by: ['branchId'], where: { branch: { organizationId: ctx.orgId }, isActive: true }, _count: true })
  ])
  const monthStart = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z')
  const ticketsMonth = await prisma.ticket.count({ where: { queue: { branch: { organizationId: ctx.orgId } }, createdAt: { gte: monthStart } } })
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { featuredUntil: true } })
  const { sub, plan, sites } = billing
  const draft = await subscriptionInvoiceDraft(ctx.orgId)
  return {
    state: billing.state, daysLeft: billing.daysLeft, until: billing.until?.toISOString() ?? null,
    plan: { id: plan.id, name: plan.name, tagline: plan.tagline, features: plan.features, maxCounters: plan.maxCounters, maxServices: plan.maxServices, maxTicketsMonth: plan.maxTicketsMonth, smsIncluded: plan.smsIncluded },
    cycle: sub.billingCycle, unitPrice: pricePerSite(sub, plan), discountPct: sub.discountPct, monthly: monthlyRevenue(sub, plan, sites), sites,
    nextInvoice: draft ? { total: draft.lines.reduce((s, l) => s + l.amount, 0), periodStart: draft.periodStart.toISOString() } : null,
    usage: {
      ticketsMonth,
      maxCountersUsed: Math.max(0, ...counters.map(c => c._count)),
      maxServicesUsed: Math.max(0, ...services.map(s => s._count)),
      sms
    },
    featuredUntil: org?.featuredUntil && org.featuredUntil > new Date() ? org.featuredUntil.toISOString() : null,
    plans: plans.map(p => ({ id: p.id, name: p.name, tagline: p.tagline, priceMonthly: p.priceMonthly, yearlyDiscountPct: p.yearlyDiscountPct, maxCounters: p.maxCounters, maxServices: p.maxServices, maxTicketsMonth: p.maxTicketsMonth, smsIncluded: p.smsIncluded, features: p.features, highlight: p.highlight })),
    products: products.map(p => ({ id: p.id, kind: p.kind, name: p.name, description: p.description, price: p.price, rentalMonthly: p.rentalMonthly, smsQuantity: p.smsQuantity, featuredDays: p.featuredDays })),
    invoices: invoices.map(i => ({ id: i.id, number: i.number, kind: i.kind, status: i.status, total: i.total, issuedAt: i.issuedAt.toISOString(), dueAt: i.dueAt.toISOString(), paid: i.payments.reduce((s, p) => s + p.amount, 0), overdue: i.status === 'SENT' && i.dueAt < new Date() })),
    paymentInstructions: config.paymentInstructions, featureLabels: FEATURES, productKinds: PRODUCT_KINDS, paymentMethods: PAYMENT_METHODS
  }
}

/** État de l'abonnement pour le bandeau du tableau de bord (essai bientôt fini, retard, suspension). */
export async function getBillingBanner() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const { state, daysLeft, until } = await getOrgBilling(ctx.orgId)
  const show = state === 'GRACE' || state === 'SUSPENDED' || state === 'CANCELLED' || (state === 'TRIAL' && daysLeft != null && daysLeft <= 7)
  return show ? { state, daysLeft, until: until?.toISOString() ?? null } : null
}

/**
 * Changement de forfait demandé par le responsable : immédiat pendant l'essai ou vers un forfait à prix public,
 * transmis à l'équipe Lerena pour un forfait sur devis.
 */
export async function changeMyPlan(planId: string, cycle: 'MONTHLY' | 'YEARLY') {
  const ctx = await getManagerContext('billing.manage')
  if (!ctx) return DENIED
  const plan = await prisma.plan.findFirst({ where: { id: planId, isActive: true, isPublic: true } })
  if (!plan) return { success: false as const, error: 'Forfait indisponible' }
  const { sub } = await getOrgBilling(ctx.orgId)
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })

  if (plan.priceMonthly == null) {
    const config = await getPlatformConfig()
    if (config.companyEmail) {
      await sendEmail({ to: config.companyEmail, purpose: 'ANNOUNCEMENT', organizationId: ctx.orgId, subject: `Demande de devis ${plan.name} — ${org?.name}`, text: `${org?.name} demande le forfait ${plan.name} (${cycle === 'YEARLY' ? 'annuel' : 'mensuel'}).` })
    }
    await audit({ action: 'PLAN_QUOTE_REQUESTED', targetType: 'Plan', targetId: plan.id, organizationId: ctx.orgId, details: plan.name })
    return { success: true as const, quote: true }
  }

  // Descendre de forfait : vérifier que l'existant tient dans les nouvelles limites
  if (plan.maxCounters != null || plan.maxServices != null) {
    const [counters, services] = await Promise.all([
      prisma.counter.groupBy({ by: ['branchId'], where: { branch: { organizationId: ctx.orgId } }, _count: true }),
      prisma.service.groupBy({ by: ['branchId'], where: { branch: { organizationId: ctx.orgId }, isActive: true }, _count: true })
    ])
    if (plan.maxCounters != null && counters.some(c => c._count > plan.maxCounters!)) return { success: false as const, error: `Le forfait ${plan.name} permet ${plan.maxCounters} guichets par site : retirez-en d’abord.` }
    if (plan.maxServices != null && services.some(s => s._count > plan.maxServices!)) return { success: false as const, error: `Le forfait ${plan.name} permet ${plan.maxServices} services par site : désactivez-en d’abord.` }
  }
  await prisma.subscription.update({ where: { id: sub.id }, data: { planId: plan.id, billingCycle: cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY', customPricePerSite: null } })
  await audit({ action: 'PLAN_CHANGED_BY_CLIENT', targetType: 'Subscription', targetId: sub.id, organizationId: ctx.orgId, details: `${plan.name} · ${cycle}` })
  revalidatePath('/dashboard', 'layout')
  return { success: true as const, quote: false }
}

/** Commande au catalogue : crée la facture ; les SMS ou la mise en avant s'activent au paiement. */
export async function orderProducts(items: { productId: string; qty: number; rental?: boolean }[]) {
  const ctx = await getManagerContext('billing.manage')
  if (!ctx) return DENIED
  if (!items.length) return { success: false as const, error: 'Panier vide' }
  try {
    const invoice = await createOrderInvoice(ctx.orgId, items, ctx.userId)
    await audit({ action: 'ORDER_CREATED', targetType: 'Invoice', targetId: invoice.id, organizationId: ctx.orgId, details: `${invoice.number} · ${invoice.total}` })
    revalidatePath('/dashboard/billing')
    return { success: true as const, id: invoice.id, number: invoice.number }
  } catch (e) { return fail(e) }
}

/** « J'ai payé » : le paiement est vérifié puis enregistré par l'équipe Lerena. */
export async function declarePayment(invoiceId: string, method: string, reference: string) {
  const ctx = await getManagerContext('billing.manage')
  if (!ctx) return DENIED
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, organizationId: ctx.orgId }, select: { id: true, number: true, total: true, status: true, notes: true } })
  if (!invoice || invoice.status !== 'SENT') return { success: false as const, error: 'Facture introuvable ou déjà réglée' }
  const label = PAYMENT_METHODS[method as keyof typeof PAYMENT_METHODS]
  if (!label || !reference.trim()) return { success: false as const, error: 'Indiquez le moyen de paiement et la référence de la transaction' }
  const line = `Paiement déclaré le ${new Date().toLocaleDateString('fr-FR')} : ${label}, référence ${reference.trim().slice(0, 60)}`
  await prisma.invoice.update({ where: { id: invoice.id }, data: { notes: [invoice.notes, line].filter(Boolean).join('\n') } })
  const config = await getPlatformConfig()
  if (config.companyEmail) await sendEmail({ to: config.companyEmail, purpose: 'ANNOUNCEMENT', organizationId: ctx.orgId, subject: `Paiement déclaré — ${invoice.number}`, text: line })
  await audit({ action: 'PAYMENT_DECLARED', targetType: 'Invoice', targetId: invoice.id, organizationId: ctx.orgId, details: line })
  revalidatePath('/dashboard/billing')
  return { success: true as const }
}

/** Facture imprimable : visible par l'établissement concerné et par l'équipe Lerena. */
export async function getInvoiceDocument(invoiceId: string) {
  const [admin, ctx] = await Promise.all([getSuperAdmin(), getManagerContext('billing.view')])
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { id: true, name: true, address: true, city: true, phone: true, email: true } }, payments: { orderBy: { receivedAt: 'asc' } } }
  })
  if (!invoice || (!admin && ctx?.orgId !== invoice.organizationId)) return null
  const config = await getPlatformConfig()
  return {
    invoice: {
      ...invoice, lines: (invoice.lines as unknown as InvoiceLine[]) ?? [],
      issuedAt: invoice.issuedAt.toISOString(), dueAt: invoice.dueAt.toISOString(), paidAt: invoice.paidAt?.toISOString() ?? null,
      periodStart: invoice.periodStart?.toISOString() ?? null, periodEnd: invoice.periodEnd?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(), appliedAt: invoice.appliedAt?.toISOString() ?? null,
      payments: invoice.payments.map(p => ({ id: p.id, amount: p.amount, method: PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS] ?? p.method, reference: p.reference, receivedAt: p.receivedAt.toISOString() }))
    },
    seller: {
      name: config.companyName || config.appName, address: config.companyAddress, taxId: config.companyTaxId, rccm: config.companyRccm,
      phone: config.companyPhone, email: config.companyEmail, paymentInstructions: config.paymentInstructions
    },
    isAdmin: !!admin
  }
}
