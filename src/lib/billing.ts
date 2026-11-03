import { cache } from 'react'
import { claimOnce } from '@/lib/locks'
import type { Invoice, Plan, Prisma, Subscription } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPlatformConfig } from '@/lib/platform'
import { appUrl, sendEmail } from '@/lib/messaging'

// Modèle économique : abonnement par site (forfaits modifiables), essai, catalogue (SMS, mise en avant,
// matériel, installation), factures et paiements enregistrés (Mobile Money, virement, espèces).

// Erreur « métier » attendue (message affiché à la personne) : pas un incident à surveiller
export class BillingError extends Error { readonly expected = true }

/** Message d'une limite de forfait (sinon null), pour les actions qui renvoient { success, error }. */
export const limitMessage = (e: unknown) => (e instanceof BillingError ? e.message : null)

/** Exécute une vérification de forfait ; renvoie son message si elle échoue. */
export async function checkLimit(fn: () => Promise<void>) {
  try { await fn(); return null } catch (e) { const m = limitMessage(e); if (m) return m; throw e }
}

export { FEATURES, PRODUCT_KINDS, PAYMENT_METHODS, fcfa, type Feature } from '@/lib/billing-labels'
import { FEATURES, PAYMENT_METHODS, fcfa, type Feature } from '@/lib/billing-labels'

export interface InvoiceLine {
  label: string
  qty: number
  unitPrice: number
  amount: number
  productId?: string
  smsQuantity?: number
  featuredDays?: number
}

const DAY = 86400_000

// ---- Abonnement et état ----

/** Abonnement de l'établissement ; créé à la volée (essai) pour les établissements qui n'en ont pas encore. */
export async function ensureSubscription(orgId: string) {
  const existing = await prisma.subscription.findUnique({ where: { organizationId: orgId }, include: { plan: true } })
  if (existing) return existing
  const config = await getPlatformConfig()
  const plan = (config.trialPlanId && await prisma.plan.findUnique({ where: { id: config.trialPlanId } }))
    || await prisma.plan.findFirst({ where: { isActive: true }, orderBy: [{ highlight: 'desc' }, { sortOrder: 'asc' }] })
  if (!plan) throw new BillingError('Aucun forfait configuré')
  return prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, planId: plan.id, status: 'TRIAL', trialEndsAt: new Date(Date.now() + config.trialDays * DAY) },
    update: {},
    include: { plan: true }
  })
}

export type BillingStateName = 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'CANCELLED'
export interface BillingState { state: BillingStateName; until: Date | null; daysLeft: number | null }

/**
 * État effectif : l'essai ou la période payée court jusqu'à sa fin, puis un délai de grâce,
 * puis suspension (les tickets en ligne s'arrêtent, les données restent).
 */
export function billingState(sub: Pick<Subscription, 'status' | 'trialEndsAt' | 'currentPeriodEnd'>, graceDays: number, now = new Date()): BillingState {
  if (sub.status === 'CANCELLED') return { state: 'CANCELLED', until: null, daysLeft: null }
  if (sub.status === 'SUSPENDED') return { state: 'SUSPENDED', until: null, daysLeft: null }
  const end = sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd
  if (!end) return { state: sub.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE', until: null, daysLeft: null } // contrat sans échéance (sur mesure)
  const days = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY)
  if (now < end) return { state: sub.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE', until: end, daysLeft: days(end) }
  const graceEnd = new Date(end.getTime() + graceDays * DAY)
  if (now < graceEnd) return { state: 'GRACE', until: graceEnd, daysLeft: days(graceEnd) }
  return { state: 'SUSPENDED', until: null, daysLeft: null }
}

export const siteCount = async (orgId: string) =>
  Math.max(1, await prisma.branch.count({ where: { organizationId: orgId, isActive: true } }))

/** Prix mensuel HT d'un site (prix négocié sinon prix du forfait ; null = sur devis). */
export const pricePerSite = (sub: Pick<Subscription, 'customPricePerSite'>, plan: Pick<Plan, 'priceMonthly'>) =>
  sub.customPricePerSite ?? plan.priceMonthly

/** Revenu mensuel récurrent (HT) de l'abonnement, remises comprises (annuel ramené au mois). */
export function monthlyRevenue(sub: Pick<Subscription, 'customPricePerSite' | 'discountPct' | 'billingCycle'>, plan: Pick<Plan, 'priceMonthly' | 'yearlyDiscountPct'>, sites: number) {
  const unit = pricePerSite(sub, plan) ?? 0
  const yearly = sub.billingCycle === 'YEARLY' ? 1 - plan.yearlyDiscountPct / 100 : 1
  return Math.round(unit * sites * (1 - sub.discountPct / 100) * yearly)
}

/** Abonnement, forfait et état de l'établissement (une fois par requête). */
export const getOrgBilling = cache(async (orgId: string) => {
  const [sub, config, sites] = await Promise.all([ensureSubscription(orgId), getPlatformConfig(), siteCount(orgId)])
  return { sub, plan: sub.plan, sites, ...billingState(sub, config.graceDays) }
})

export async function hasFeature(orgId: string, feature: Feature) {
  const { plan } = await getOrgBilling(orgId)
  return plan.features.includes(feature)
}

// ---- Limites du forfait ----

const upgrade = (what: string) => `${what} : passez à un forfait supérieur dans Abonnement.`

export async function assertFeature(orgId: string, feature: Feature) {
  if (!(await hasFeature(orgId, feature))) throw new BillingError(upgrade(`« ${FEATURES[feature]} » n’est pas inclus dans votre forfait`))
}

export async function assertCanAddCounter(orgId: string, branchId: string) {
  const { plan } = await getOrgBilling(orgId)
  if (plan.maxCounters == null) return
  const n = await prisma.counter.count({ where: { branchId } })
  if (n >= plan.maxCounters) throw new BillingError(upgrade(`Votre forfait permet ${plan.maxCounters} guichets par site`))
}

export async function assertCanAddService(orgId: string, branchId: string) {
  const { plan } = await getOrgBilling(orgId)
  if (plan.maxServices == null) return
  const n = await prisma.service.count({ where: { branchId, isActive: true } })
  if (n >= plan.maxServices) throw new BillingError(upgrade(`Votre forfait permet ${plan.maxServices} services par site`))
}

export const assertCanAddSite = (orgId: string) => assertFeature(orgId, 'MULTI_SITE')

/**
 * Les tickets s'arrêtent si l'abonnement est suspendu, ou si le quota mensuel du site est atteint.
 * L'accueil (channel « staff ») peut toujours dépanner un visiteur sur place.
 */
export async function assertCanIssueTicket(orgId: string, branchId: string, channel: string) {
  const billing = await getOrgBilling(orgId)
  if (billing.state === 'SUSPENDED' || billing.state === 'CANCELLED') {
    throw new BillingError('Le service en ligne de cet établissement est momentanément indisponible.')
  }
  if (billing.plan.maxTicketsMonth == null || channel === 'staff') return
  const monthStart = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z')
  const n = await prisma.ticket.count({ where: { queue: { branchId }, createdAt: { gte: monthStart } } })
  if (n >= billing.plan.maxTicketsMonth) throw new BillingError('Cet établissement a atteint son nombre de tickets du mois : adressez-vous à l’accueil.')
}

// ---- SMS : quota mensuel du forfait, puis packs achetés ----

export async function smsAllowance(orgId: string) {
  const { plan, sites } = await getOrgBilling(orgId)
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { smsCredits: true } })
  const monthStart = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z')
  const used = await prisma.outboundMessage.count({ where: { organizationId: orgId, channel: 'SMS', status: { in: ['SENT', 'SIMULATED'] }, createdAt: { gte: monthStart } } })
  const included = plan.smsIncluded * sites
  return { included, used, includedLeft: Math.max(0, included - used), credits: org?.smsCredits ?? 0 }
}

/** Réserve un SMS pour l'établissement : quota du mois d'abord, puis crédits achetés. false = plus de SMS. */
export async function consumeSms(orgId: string) {
  const a = await smsAllowance(orgId)
  if (a.includedLeft > 0) {
    await warnSmsLow(orgId, a.includedLeft - 1 + a.credits)
    return true
  }
  const taken = await prisma.organization.updateMany({ where: { id: orgId, smsCredits: { gt: 0 } }, data: { smsCredits: { decrement: 1 } } })
  if (taken.count === 0) return false
  await prisma.smsLedger.create({ data: { organizationId: orgId, delta: -1, reason: 'SMS envoyé' } })
  await warnSmsLow(orgId, a.credits - 1)
  return true
}

/** Alerte aux responsables quand il reste 20 SMS, puis quand il n'en reste plus (une fois par seuil et par mois). */
async function warnSmsLow(orgId: string, remaining: number) {
  if (remaining !== 20 && remaining !== 0) return
  const month = new Date().toISOString().slice(0, 7)
  const claimed = await claimOnce(`sms-low:${orgId}:${month}:${remaining}`)
  if (!claimed) return
  const { notify } = await import('@/lib/notifications')
  await notify({
    event: 'SMS_LOW', orgId, url: '/dashboard/billing',
    title: remaining ? 'Plus que 20 SMS disponibles' : 'Plus aucun SMS disponible',
    body: remaining ? 'Achetez un pack dans Abonnement → Boutique pour ne pas interrompre rappels et campagnes.' : 'Les rappels et campagnes par SMS sont en pause : achetez un pack dans Abonnement → Boutique.'
  })
}

// ---- Factures ----

async function nextNumber(tx: Prisma.TransactionClient, prefix: string) {
  const year = new Date().getUTCFullYear()
  const last = await tx.invoice.findFirst({ where: { number: { startsWith: `${prefix}-${year}-` } }, orderBy: { number: 'desc' }, select: { number: true } })
  const seq = last ? Number(last.number.split('-').pop()) + 1 : 1
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

export async function createInvoice(input: {
  orgId: string
  kind: 'SUBSCRIPTION' | 'ORDER'
  lines: InvoiceLine[]
  periodStart?: Date | null
  periodEnd?: Date | null
  notes?: string | null
  createdById?: string | null
  notify?: boolean
}) {
  if (input.lines.length === 0) throw new BillingError('Facture vide')
  const config = await getPlatformConfig()
  const subtotal = input.lines.reduce((s, l) => s + l.amount, 0)
  const tax = Math.round(subtotal * config.taxRate / 100)
  let invoice: Invoice | null = null
  for (let attempt = 0; !invoice && attempt < 3; attempt++) {
    try {
      invoice = await prisma.$transaction(async tx => tx.invoice.create({
        data: {
          number: await nextNumber(tx, config.invoicePrefix),
          organizationId: input.orgId, kind: input.kind, status: 'SENT',
          periodStart: input.periodStart ?? null, periodEnd: input.periodEnd ?? null,
          dueAt: new Date(Date.now() + config.paymentTermDays * DAY),
          subtotal, taxRate: config.taxRate, tax, total: subtotal + tax,
          lines: input.lines as unknown as Prisma.InputJsonValue, notes: input.notes ?? null, createdById: input.createdById ?? null
        }
      }))
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e // numéro déjà pris par une facture simultanée : on recommence
    }
  }
  if (!invoice) throw new BillingError('Numérotation impossible, réessayez')
  if (input.notify !== false) {
    await notifyInvoice(invoice.id).catch(() => null)
    const { notify } = await import('@/lib/notifications')
    await notify({ event: 'INVOICE_DUE', orgId: input.orgId, url: `/dashboard/billing/invoices/${invoice.id}`, title: `Facture ${invoice.number} : ${fcfa(invoice.total)}`, body: `À régler avant le ${invoice.dueAt.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.` }).catch(() => null)
  }
  return invoice
}

/** Lignes et période de la prochaine facture d'abonnement (null : forfait sur devis sans prix négocié). */
export async function subscriptionInvoiceDraft(orgId: string, from?: Date) {
  const { sub, plan, sites } = await getOrgBilling(orgId)
  const unit = pricePerSite(sub, plan)
  if (unit == null) return null
  const yearly = sub.billingCycle === 'YEARLY'
  const months = yearly ? 12 : 1
  const start = from ?? (sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd) ?? new Date()
  const periodStart = start.getTime() < Date.now() - 30 * DAY ? new Date() : start
  const periodEnd = new Date(periodStart)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + months)
  const lines: InvoiceLine[] = [{ label: `Forfait ${plan.name} — ${sites} site${sites > 1 ? 's' : ''} × ${months} mois`, qty: sites * months, unitPrice: unit, amount: unit * sites * months }]
  const base = lines[0].amount
  if (yearly && plan.yearlyDiscountPct) lines.push({ label: `Remise paiement annuel (${plan.yearlyDiscountPct} %)`, qty: 1, unitPrice: -Math.round(base * plan.yearlyDiscountPct / 100), amount: -Math.round(base * plan.yearlyDiscountPct / 100) })
  const afterYearly = lines.reduce((s, l) => s + l.amount, 0)
  if (sub.discountPct) lines.push({ label: `Remise commerciale (${sub.discountPct} %)`, qty: 1, unitPrice: -Math.round(afterYearly * sub.discountPct / 100), amount: -Math.round(afterYearly * sub.discountPct / 100) })
  return { lines, periodStart, periodEnd }
}

export async function createSubscriptionInvoice(orgId: string, createdById?: string | null) {
  const draft = await subscriptionInvoiceDraft(orgId)
  if (!draft) throw new BillingError('Forfait sur devis : indiquez un prix négocié par site avant de facturer')
  const open = await prisma.invoice.findFirst({ where: { organizationId: orgId, kind: 'SUBSCRIPTION', status: { in: ['SENT', 'DRAFT'] } }, select: { number: true } })
  if (open) throw new BillingError(`La facture ${open.number} est déjà en attente de paiement`)
  return createInvoice({ orgId, kind: 'SUBSCRIPTION', createdById, ...draft })
}

/** Commande au catalogue (packs SMS, mise en avant, matériel, installation). */
export async function createOrderInvoice(orgId: string, items: { productId: string; qty: number; rental?: boolean }[], createdById?: string | null) {
  const products = await prisma.product.findMany({ where: { id: { in: items.map(i => i.productId) }, isActive: true } })
  const lines: InvoiceLine[] = items.flatMap(item => {
    const p = products.find(x => x.id === item.productId)
    const qty = Math.max(1, Math.min(100, Math.floor(item.qty)))
    if (!p) return []
    const rent = item.rental && p.rentalMonthly != null
    const unit = rent ? p.rentalMonthly! : p.price
    return [{
      label: rent ? `${p.name} — location 1 mois` : p.name, qty, unitPrice: unit, amount: unit * qty, productId: p.id,
      ...(p.smsQuantity ? { smsQuantity: p.smsQuantity * qty } : {}),
      ...(p.featuredDays ? { featuredDays: p.featuredDays * qty } : {})
    }]
  })
  return createInvoice({ orgId, kind: 'ORDER', lines, createdById })
}

/** Encaissement : une fois la facture soldée, ses effets s'appliquent (période payée, SMS, mise en avant). */
export async function recordPayment(input: { invoiceId: string; amount: number; method: keyof typeof PAYMENT_METHODS; reference?: string | null; recordedById?: string | null }) {
  const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId }, include: { payments: true } })
  if (!invoice) throw new BillingError('Facture introuvable')
  if (invoice.status === 'VOID') throw new BillingError('Facture annulée')
  if (invoice.status === 'PAID') throw new BillingError('Facture déjà réglée')
  if (!(input.amount > 0)) throw new BillingError('Montant invalide')
  await prisma.payment.create({ data: { invoiceId: invoice.id, amount: Math.round(input.amount), method: input.method, reference: input.reference?.trim() || null, recordedById: input.recordedById ?? null } })
  const paid = invoice.payments.reduce((s, p) => s + p.amount, 0) + Math.round(input.amount)
  if (paid < invoice.total) return { paid, remaining: invoice.total - paid, settled: false }
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } })
  await applyInvoice(invoice.id)
  return { paid, remaining: 0, settled: true }
}

async function applyInvoice(invoiceId: string) {
  // Une seule application, même si deux paiements arrivent en même temps
  const claim = await prisma.invoice.updateMany({ where: { id: invoiceId, appliedAt: null }, data: { appliedAt: new Date() } })
  if (claim.count === 0) return
  const invoice = (await prisma.invoice.findUnique({ where: { id: invoiceId } }))!
  const lines = (invoice.lines as unknown as InvoiceLine[]) ?? []

  if (invoice.kind === 'SUBSCRIPTION' && invoice.periodEnd) {
    const sub = await ensureSubscription(invoice.organizationId)
    const end = sub.currentPeriodEnd && sub.currentPeriodEnd > invoice.periodEnd ? sub.currentPeriodEnd : invoice.periodEnd
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', currentPeriodEnd: end, suspendedAt: null } })
  }
  const sms = lines.reduce((s, l) => s + (l.smsQuantity ?? 0), 0)
  if (sms > 0) {
    await prisma.organization.update({ where: { id: invoice.organizationId }, data: { smsCredits: { increment: sms } } })
    await prisma.smsLedger.create({ data: { organizationId: invoice.organizationId, delta: sms, reason: `Facture ${invoice.number}`, invoiceId } })
  }
  const days = lines.reduce((s, l) => s + (l.featuredDays ?? 0), 0)
  if (days > 0) {
    const org = await prisma.organization.findUnique({ where: { id: invoice.organizationId }, select: { featuredUntil: true } })
    const from = org?.featuredUntil && org.featuredUntil > new Date() ? org.featuredUntil : new Date()
    await prisma.organization.update({ where: { id: invoice.organizationId }, data: { featuredUntil: new Date(from.getTime() + days * DAY) } })
  }
}

/** Facture envoyée par e-mail à l'établissement (adresse de la fiche, sinon ses responsables). */
export async function notifyInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { id: true, name: true, email: true, members: { where: { role: 'MANAGER' }, select: { user: { select: { email: true } } } } } } }
  })
  if (!invoice) return
  const to = invoice.organization.email || invoice.organization.members.map(m => m.user.email).find(Boolean)
  if (!to) return
  const config = await getPlatformConfig()
  await sendEmail({
    to, purpose: 'INVOICE', organizationId: invoice.organization.id,
    subject: `Facture ${invoice.number} — ${fcfa(invoice.total)}`,
    text: `Bonjour,\n\nVotre facture ${invoice.number} de ${fcfa(invoice.total)} est disponible, à régler avant le ${invoice.dueAt.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.\n\nLa consulter : ${appUrl()}/dashboard/billing/invoices/${invoice.id}\n${config.paymentInstructions ? `\nPaiement :\n${config.paymentInstructions}\n` : ''}\nMerci de votre confiance,\n${config.companyName || config.appName}`
  })
}

// ---- Tâche planifiée : factures de renouvellement ----

/** Prépare la facture de la période suivante 7 jours avant la fin de l'essai ou de la période payée. */
export async function runBillingJobs() {
  const soon = new Date(Date.now() + 7 * DAY)
  const subs = await prisma.subscription.findMany({
    where: { OR: [{ status: 'TRIAL', trialEndsAt: { lte: soon } }, { status: 'ACTIVE', currentPeriodEnd: { lte: soon } }] },
    select: { organizationId: true }, take: 200
  })
  let created = 0
  for (const { organizationId } of subs) {
    try { await createSubscriptionInvoice(organizationId); created++ } catch { /* déjà facturé ou sur devis */ }
  }
  return { renewalInvoices: created }
}
