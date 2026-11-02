'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { getPlatformConfig } from '@/lib/platform'
import { sendEmail } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { HOUR, RATE_LIMITED, rateLimit, requestIp } from '@/lib/rate-limit'

// Prospects : demandes de démonstration envoyées depuis /tarifs, suivies dans la console (/admin/leads).

const DENIED = { success: false as const, error: 'Accès réservé à l’administration de la plateforme' }
const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
export type LeadStatus = 'NEW' | 'CONTACTED' | 'DEMO' | 'WON' | 'LOST'
const STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'DEMO', 'WON', 'LOST']

export async function submitLead(input: { contactName: string; organization: string; sector?: string; city?: string; phone: string; email?: string; sites?: string | number; message?: string; website?: string }) {
  // Champ invisible rempli seulement par les robots
  if (input.website) return { success: true as const }
  const ip = requestIp()
  if (ip && !(await rateLimit(`lead:${ip}`, 5, HOUR))) return { success: false as const, error: RATE_LIMITED }
  const contactName = clean(input.contactName, 80)
  const organization = clean(input.organization, 120)
  const phone = normalizePhone(input.phone ?? '')
  if (!contactName || !organization) return { success: false as const, error: 'Indiquez votre nom et celui de l’établissement' }
  if (!phone) return { success: false as const, error: 'Numéro de téléphone invalide' }
  const email = clean(input.email, 120)
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { success: false as const, error: 'E-mail invalide' }
  const sites = input.sites === '' || input.sites == null ? null : Math.max(1, Math.min(500, Math.round(Number(input.sites)) || 1))

  const lead = await prisma.lead.create({
    data: { contactName, organization, phone, email, sites, sector: clean(input.sector, 60), city: clean(input.city, 60), message: clean(input.message, 1000) }
  })
  const config = await getPlatformConfig()
  const to = process.env.ALERT_EMAIL || config.companyEmail
  if (to) {
    await sendEmail({
      to, purpose: 'ANNOUNCEMENT',
      subject: `Nouvelle demande de démo : ${organization}`,
      text: `${contactName} — ${organization}${lead.city ? ` (${lead.city})` : ''}\nTéléphone : ${phone}${email ? `\nE-mail : ${email}` : ''}${sites ? `\nSites : ${sites}` : ''}${lead.sector ? `\nSecteur : ${lead.sector}` : ''}${lead.message ? `\n\n${lead.message}` : ''}`
    }).catch(() => null)
  }
  revalidatePath('/admin/leads')
  return { success: true as const }
}

export async function getLeads() {
  if (!(await getSuperAdmin())) return null
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
  return leads.map(l => ({ ...l, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() }))
}

export async function updateLead(id: string, data: { status?: string; notes?: string }) {
  if (!(await getSuperAdmin())) return DENIED
  const status = data.status && STATUSES.includes(data.status as LeadStatus) ? data.status : undefined
  const lead = await prisma.lead.update({ where: { id }, data: { ...(status ? { status } : {}), ...(data.notes !== undefined ? { notes: clean(data.notes, 2000) } : {}) } })
  if (status) await audit({ action: 'LEAD_UPDATED', targetType: 'Lead', targetId: id, details: `${lead.organization} → ${status}` })
  revalidatePath('/admin/leads')
  return { success: true as const }
}

/** Forfaits publics et offres du catalogue pour la page Tarifs (sans connexion). */
export async function getPublicPricing() {
  const [plans, products, config] = await Promise.all([
    prisma.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.product.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, kind: true, name: true, description: true, price: true, rentalMonthly: true } }),
    getPlatformConfig()
  ])
  return {
    trialDays: config.trialDays,
    plans: plans.map(p => ({ id: p.id, name: p.name, tagline: p.tagline, priceMonthly: p.priceMonthly, yearlyDiscountPct: p.yearlyDiscountPct, maxCounters: p.maxCounters, maxServices: p.maxServices, maxTicketsMonth: p.maxTicketsMonth, smsIncluded: p.smsIncluded, features: p.features, highlight: p.highlight })),
    products
  }
}
