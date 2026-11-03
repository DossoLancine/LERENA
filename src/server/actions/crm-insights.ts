'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { hasFeature } from '@/lib/billing'
import { audit } from '@/lib/audit'
import { findOrCreateCustomer, mergeCustomers, refreshCustomerStats } from '@/lib/customers'
import { MAX_IMPORT_ROWS, type ImportRow } from '@/lib/customer-import'
import { normalizePhone } from '@/lib/phone'
import { TAG_COLORS } from '@/lib/customer-labels'
import { SEGMENTS, segmentWhere, type CustomerSegment } from '@/lib/customer-segments'

// Pilotage du fichier visiteurs (forfaits avec « Pilotage, import et export ») : tableau de bord, import CSV,
// doublons et fusion, export. Réservé au responsable ; import, fusion et export sont inscrits au journal.

const DAY = 86400_000
const upgrade = 'Le pilotage, l’import et l’export des visiteurs sont inclus à partir du forfait Pro (Abonnement).'

async function insightsContext() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  return { ...ctx, enabled: await hasFeature(ctx.orgId, 'CRM_INSIGHTS').catch(() => false) }
}

const monthStart = (offset: number) => {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1))
}

/** Tableau de bord du fichier visiteurs : chiffres clés, 6 derniers mois, points d'attention. */
export async function getCrmInsights() {
  const ctx = await insightsContext()
  if (!ctx) return null
  if (!ctx.enabled) return { enabled: false as const }
  const org = { organizationId: ctx.orgId }
  const now = Date.now()
  const d90 = new Date(now - 90 * DAY)
  const thisMonth = monthStart(0)
  const from = monthStart(-5)

  const [total, active, returning, lost, newThisMonth, consenting, appts, noShows, ratings, lapsed, repeatNoShow, unhappy, dueFollowUps, openComplaints, monthly] = await Promise.all([
    prisma.customer.count({ where: org }),
    prisma.customer.count({ where: { ...org, lastVisitAt: { gte: d90 } } }),
    prisma.customer.count({ where: { ...org, lastVisitAt: { gte: d90 }, visits: { gte: 2 } } }),
    prisma.customer.count({ where: { ...org, visits: { gte: 1 }, lastVisitAt: { lt: d90 } } }),
    prisma.customer.count({ where: { ...org, firstSeenAt: { gte: thisMonth } } }),
    prisma.customer.count({ where: { ...org, consentAt: { not: null }, optedOutAt: null } }),
    prisma.appointment.count({ where: { ...org, scheduledDate: { gte: d90, lt: new Date() }, status: { in: ['COMPLETED', 'NO_SHOW', 'CONFIRMED'] } } }),
    prisma.appointment.count({ where: { ...org, scheduledDate: { gte: d90, lt: new Date() }, status: 'NO_SHOW' } }),
    prisma.ticket.aggregate({ where: { queue: { branch: { organizationId: ctx.orgId } }, npsScore: { not: null }, createdAt: { gte: d90 } }, _avg: { npsScore: true }, _count: { npsScore: true } }),
    prisma.customer.count({ where: { ...org, ...segmentWhere('lapsed') } }),
    prisma.customer.count({ where: { ...org, ...segmentWhere('noshow') } }),
    prisma.customer.count({ where: { ...org, ...segmentWhere('unhappy') } }),
    prisma.customerFollowUp.count({ where: { ...org, status: 'OPEN', dueDate: { lte: new Date(now) } } }),
    prisma.complaint.count({ where: { ...org, status: 'OPEN' } }),
    // Par mois : visiteurs venus, dont nouveaux (premier passage ce mois-là), et passages
    prisma.$queryRaw<{ month: Date; visitors: number; newcomers: number; visits: number }[]>`
      SELECT date_trunc('month', t."createdAt") AS month,
        count(DISTINCT t."customerId")::int AS visitors,
        count(DISTINCT t."customerId") FILTER (WHERE date_trunc('month', c."firstSeenAt") = date_trunc('month', t."createdAt"))::int AS newcomers,
        count(*)::int AS visits
      FROM "Ticket" t JOIN "Customer" c ON c.id = t."customerId"
      WHERE c."organizationId" = ${ctx.orgId} AND t."createdAt" >= ${from} AND t.status <> 'CANCELLED'
      GROUP BY 1 ORDER BY 1`
  ])

  const months = Array.from({ length: 6 }, (_, i) => monthStart(i - 5))
  const series = months.map(m => {
    const row = monthly.find(r => new Date(r.month).getTime() === m.getTime())
    return {
      label: m.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      visitors: row?.visitors ?? 0, newcomers: row?.newcomers ?? 0, returning: (row?.visitors ?? 0) - (row?.newcomers ?? 0), visits: row?.visits ?? 0
    }
  })

  return {
    enabled: true as const,
    kpis: {
      total, active, newThisMonth, lost,
      returnRate: active ? Math.round((returning / active) * 100) : 0,
      consentRate: total ? Math.round((consenting / total) * 100) : 0,
      noShowRate: appts ? Math.round((noShows / appts) * 100) : 0,
      satisfaction: ratings._avg.npsScore != null ? Math.round(ratings._avg.npsScore * 10) / 10 : null,
      ratingsCount: ratings._count.npsScore
    },
    series,
    watch: [
      { id: 'lapsed', label: 'À relancer', hint: 'Pas revenus depuis 90 jours', count: lapsed, href: '/dashboard/visitors?segment=lapsed' },
      { id: 'noshow', label: 'Absents répétés', hint: '2 absences et plus', count: repeatNoShow, href: '/dashboard/visitors?segment=noshow' },
      { id: 'unhappy', label: 'Mécontents', hint: 'Dernière note de 2 étoiles ou moins', count: unhappy, href: '/dashboard/visitors?segment=unhappy' },
      { id: 'followups', label: 'Suivis du jour', hint: 'En retard ou prévus aujourd’hui', count: dueFollowUps, href: '/dashboard/followups' },
      { id: 'complaints', label: 'Avis à traiter', hint: 'Visiteurs mécontents sans réponse', count: openComplaints, href: '/dashboard/feedback' }
    ]
  }
}

// ---- Import ----

/** Analyse puis importe un lot de lignes (déjà lues et vérifiées dans le navigateur). dryRun : rien n'est écrit. */
export async function importCustomers(rows: ImportRow[], opts: { dryRun: boolean }) {
  const ctx = await insightsContext()
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (!ctx.enabled) return { success: false as const, error: upgrade }
  if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS) return { success: false as const, error: `${MAX_IMPORT_ROWS} lignes au maximum par import` }

  // Revérification côté serveur ; doublons dans le fichier : la première ligne l'emporte, les suivantes complètent
  const byPhone = new Map<string, ImportRow>()
  let duplicatesInFile = 0
  for (const r of rows) {
    const phone = normalizePhone(r?.phone)
    if (!phone) continue
    const prev = byPhone.get(phone)
    if (prev) {
      duplicatesInFile++
      prev.name ??= r.name
      prev.tags = Array.from(new Set([...prev.tags, ...(r.tags ?? [])]))
      prev.note = [prev.note, r.note].filter(Boolean).join(' · ') || null
      prev.consent = prev.consent || !!r.consent
      continue
    }
    byPhone.set(phone, {
      phone,
      name: typeof r.name === 'string' ? r.name.trim().slice(0, 60) || null : null,
      tags: Array.isArray(r.tags) ? r.tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 30)).filter(Boolean).slice(0, 10) : [],
      note: typeof r.note === 'string' ? r.note.trim().slice(0, 1000) || null : null,
      consent: !!r.consent
    })
  }
  const list = Array.from(byPhone.values())
  const existing = await prisma.customer.findMany({ where: { organizationId: ctx.orgId, phone: { in: list.map(r => r.phone) } }, select: { phone: true } })
  const known = new Set(existing.map(e => e.phone))
  const summary = { rows: list.length, created: list.filter(r => !known.has(r.phone)).length, updated: known.size, duplicatesInFile, consent: list.filter(r => r.consent).length }
  if (opts.dryRun) return { success: true as const, ...summary }

  const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } })
  const tagNames = Array.from(new Set(list.flatMap(r => r.tags)))
  const tags = new Map<string, string>()
  for (let i = 0; i < tagNames.length; i++) {
    const name = tagNames[i]
    const tag = await prisma.customerTag.upsert({
      where: { organizationId_name: { organizationId: ctx.orgId, name } },
      update: {}, create: { organizationId: ctx.orgId, name, color: TAG_COLORS[i % TAG_COLORS.length] }, select: { id: true }
    })
    tags.set(name, tag.id)
  }

  const touched: string[] = []
  for (const r of list) {
    const id = await findOrCreateCustomer({ orgId: ctx.orgId, phone: r.phone, name: r.name })
    if (!id) continue
    touched.push(id)
    await Promise.all([
      // Accord : seulement ajouté, jamais retiré par un import ; un ancien « STOP » est respecté
      r.consent ? prisma.customer.updateMany({ where: { id, consentAt: null, optedOutAt: null }, data: { consentAt: new Date(), consentChannel: 'IMPORT' } }) : null,
      r.tags.length ? prisma.customerTagLink.createMany({ data: r.tags.map(t => ({ customerId: id, tagId: tags.get(t)! })), skipDuplicates: true }) : null,
      r.note ? prisma.customerNote.create({ data: { customerId: id, authorId: ctx.userId, authorName: me?.name ?? 'Import', text: `Import : ${r.note}` } }) : null
    ])
  }
  await refreshCustomerStats(touched)
  await audit({ action: 'CUSTOMERS_IMPORTED', targetType: 'Customer', organizationId: ctx.orgId, details: `${summary.created} créées, ${summary.updated} complétées, ${summary.consent} avec accord` })
  return { success: true as const, ...summary }
}

export async function getImportContext() {
  const ctx = await insightsContext()
  if (!ctx) return null
  const config = await prisma.platformConfig.findUnique({ where: { id: 'default' }, select: { defaultCountryCode: true } })
  return { enabled: ctx.enabled, countryCode: config?.defaultCountryCode ?? '+225' }
}

// ---- Doublons ----

const simplify = (name: string | null) => (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1).sort().join(' ')

/** Fiches qui semblent être la même personne : même nom (ordre des mots, accents et majuscules ignorés), ou compte sans numéro et fiche du même nom. */
export async function findDuplicates() {
  const ctx = await insightsContext()
  if (!ctx) return null
  if (!ctx.enabled) return { enabled: false as const }
  const [customers, ignored] = await Promise.all([
    prisma.customer.findMany({
      where: { organizationId: ctx.orgId, name: { not: null } },
      select: { id: true, name: true, phone: true, userId: true, visits: true, noShows: true, firstSeenAt: true, lastVisitAt: true, consentAt: true, _count: { select: { notes: true, tags: true } } },
      take: 20000
    }),
    prisma.customerDuplicateIgnore.findMany({ where: { organizationId: ctx.orgId }, select: { customerA: true, customerB: true } })
  ])
  const skip = new Set(ignored.map(i => `${i.customerA}|${i.customerB}`))
  const groups = new Map<string, typeof customers>()
  for (const c of customers) {
    const key = simplify(c.name)
    if (key.length < 3) continue
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const pairs: { a: (typeof customers)[number]; b: (typeof customers)[number]; why: string }[] = []
  for (const list of Array.from(groups.values())) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]].sort((x, y) => (x.id < y.id ? -1 : 1))
      if (skip.has(`${a.id}|${b.id}`)) continue
      // Deux comptes Lerena différents avec deux numéros : deux personnes homonymes, probablement
      if (a.userId && b.userId) continue
      pairs.push({ a, b, why: !a.phone || !b.phone ? 'Même nom, une fiche sans numéro' : 'Même nom, numéros différents' })
    }
  }
  pairs.sort((x, y) => (y.a.visits + y.b.visits) - (x.a.visits + x.b.visits))
  return { enabled: true as const, pairs: pairs.slice(0, 200), total: pairs.length }
}

export async function mergeDuplicate(keepId: string, removeId: string) {
  const ctx = await insightsContext()
  if (!ctx?.enabled) return { success: false as const, error: 'Non autorisé' }
  try {
    await mergeCustomers(ctx.orgId, keepId, removeId)
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Fusion impossible' }
  }
  await audit({ action: 'CUSTOMERS_MERGED', targetType: 'Customer', targetId: keepId, organizationId: ctx.orgId, details: `fiche ${removeId} fusionnée` })
  return { success: true as const }
}

export async function ignoreDuplicate(aId: string, bId: string) {
  const ctx = await insightsContext()
  if (!ctx?.enabled) return { success: false as const, error: 'Non autorisé' }
  const [customerA, customerB] = [aId, bId].sort()
  const found = await prisma.customer.count({ where: { organizationId: ctx.orgId, id: { in: [customerA, customerB] } } })
  if (found !== 2) return { success: false as const, error: 'Fiche introuvable' }
  await prisma.customerDuplicateIgnore.upsert({ where: { organizationId_customerA_customerB: { organizationId: ctx.orgId, customerA, customerB } }, update: {}, create: { organizationId: ctx.orgId, customerA, customerB } })
  return { success: true as const }
}

// ---- Export ----

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v)
  // Pas de formule interprétée par le tableur (=, +, -, @ en tête)
  const safe = /^[=+\-@]/.test(s) && !/^\+\d+$/.test(s) ? `'${s}` : s
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

/** Export CSV (point-virgule, pour Excel) du segment ou de l'étiquette choisis. Inscrit au journal avec le nombre de fiches. */
export async function exportCustomers(input: { segment?: CustomerSegment; tagId?: string | null }) {
  const ctx = await insightsContext()
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (!ctx.enabled) return { success: false as const, error: upgrade }
  const segment = input.segment && SEGMENTS.includes(input.segment) ? input.segment : 'all'
  const rows = await prisma.customer.findMany({
    where: { organizationId: ctx.orgId, ...segmentWhere(segment), ...(input.tagId ? { tags: { some: { tagId: input.tagId } } } : {}) },
    orderBy: { lastSeenAt: 'desc' }, take: 20000,
    select: { name: true, phone: true, visits: true, noShows: true, ratingAvg: true, firstSeenAt: true, lastVisitAt: true, consentAt: true, optedOutAt: true, tags: { select: { tag: { select: { name: true } } } } }
  })
  const header = ['Nom', 'Téléphone', 'Passages', 'Absences', 'Note moyenne', 'Premier passage', 'Dernier passage', 'Étiquettes', 'Accord messages']
  const lines = rows.map(r => [
    r.name, r.phone, r.visits, r.noShows, r.ratingAvg != null ? r.ratingAvg.toFixed(1).replace('.', ',') : '',
    day(r.firstSeenAt), day(r.lastVisitAt), r.tags.map(t => t.tag.name).join(', '),
    r.optedOutAt ? 'STOP' : r.consentAt ? 'Oui' : 'Non'
  ].map(csvCell).join(';'))
  await audit({ action: 'CUSTOMERS_EXPORTED', targetType: 'Customer', organizationId: ctx.orgId, details: `${rows.length} fiches · segment ${segment}${input.tagId ? ' · étiquette' : ''}` })
  return { success: true as const, count: rows.length, csv: '﻿' + [header.join(';'), ...lines].join('\r\n') }
}
