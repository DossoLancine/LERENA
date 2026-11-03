'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { sendSmsWithStatus } from '@/lib/messaging'
import { normalizePhone } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_BODY, normalizeSms } from '@/lib/campaign-text'
import { isFeedbackReason } from '@/lib/complaints'
import { FEEDBACK_REASONS, type FeedbackReason } from '@/lib/customer-labels'

// Satisfaction et réclamations (tous les forfaits) : avis à traiter, traitement, statistiques. Réservé au responsable.

type Result = { success: true } | { success: false; error: string }
const denied = { success: false as const, error: 'Non autorisé' }
const HOUR = 3600_000

const complaintSelect = {
  id: true, rating: true, comment: true, reason: true, status: true, closeReason: true, resolution: true, closedAt: true, closedByName: true, createdAt: true,
  customer: { select: { id: true, name: true, phone: true, visits: true } },
  ticket: {
    select: {
      displayNum: true, createdAt: true, queuedAt: true, calledAt: true, completedAt: true, counterName: true, guestName: true, guestPhone: true,
      service: { select: { name: true } }, user: { select: { name: true, phone: true } }, queue: { select: { branch: { select: { name: true } } } }
    }
  },
  _count: { select: { events: true } }
} as const

type Row = { ticket: { guestName: string | null; guestPhone: string | null; user: { name: string | null; phone: string | null } | null; calledAt: Date | null; queuedAt: Date } ; customer: { name: string | null; phone: string | null } | null }
const who = (c: Row) => ({
  name: c.customer?.name ?? c.ticket.guestName ?? c.ticket.user?.name ?? null,
  phone: normalizePhone(c.customer?.phone ?? c.ticket.guestPhone ?? c.ticket.user?.phone ?? null),
  waitMin: c.ticket.calledAt ? Math.max(0, Math.round((c.ticket.calledAt.getTime() - c.ticket.queuedAt.getTime()) / 60000)) : null
})

/** Avis à traiter (les plus anciens d'abord) ou traités (les plus récents d'abord). */
export async function listComplaints(status: 'OPEN' | 'CLOSED' = 'OPEN') {
  const ctx = await getManagerContext('visitors.view')
  if (!ctx) return null
  const [items, open, overdue] = await Promise.all([
    prisma.complaint.findMany({
      where: { organizationId: ctx.orgId, status, ...(ctx.siteIds ? { ticket: { queue: { branchId: { in: ctx.siteIds } } } } : {}) },
      orderBy: status === 'OPEN' ? { createdAt: 'asc' } : { closedAt: 'desc' },
      take: 100, select: complaintSelect
    }),
    prisma.complaint.count({ where: { organizationId: ctx.orgId, status: 'OPEN' } }),
    prisma.complaint.count({ where: { organizationId: ctx.orgId, status: 'OPEN', createdAt: { lt: new Date(Date.now() - 48 * HOUR) } } })
  ])
  return { items: items.map(c => ({ ...c, ...who(c) })), open, overdue }
}

/** Avis complet avec son historique de traitement. */
export async function getComplaint(id: string) {
  const ctx = await getManagerContext('visitors.view')
  if (!ctx) return null
  const c = await prisma.complaint.findFirst({
    where: { id, organizationId: ctx.orgId, ...(ctx.siteIds ? { ticket: { queue: { branchId: { in: ctx.siteIds } } } } : {}) },
    select: { ...complaintSelect, events: { orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, text: true, authorName: true, createdAt: true } } }
  })
  return c ? { ...c, ...who(c) } : null
}

export async function getOpenComplaintsCount() {
  const ctx = await getManagerContext('visitors.view')
  if (!ctx) return 0
  return prisma.complaint.count({ where: { organizationId: ctx.orgId, status: 'OPEN' } })
}

async function ownComplaint(id: string) {
  const ctx = await getManagerContext('feedback.manage')
  if (!ctx) return null
  const c = await prisma.complaint.findFirst({ where: { id, organizationId: ctx.orgId }, select: { id: true } })
  if (!c) return null
  const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } })
  return { ...ctx, name: me?.name ?? 'Responsable' }
}

export async function addComplaintEvent(id: string, kind: 'NOTE' | 'CALL', text?: string): Promise<Result> {
  const ctx = await ownComplaint(id)
  if (!ctx) return denied
  const clean = text?.trim().slice(0, 1000) || null
  if (kind === 'NOTE' && !clean) return { success: false, error: 'La note est vide' }
  await prisma.complaintEvent.create({ data: { complaintId: id, kind, text: kind === 'CALL' ? clean ?? 'Visiteur appelé' : clean, authorName: ctx.name } })
  return { success: true }
}

/** Réponse au visiteur par SMS (excuses, proposition de rappel…). Un SMS de service, envoyé même sans accord pour les campagnes. */
export async function replyToComplaint(id: string, text: string): Promise<Result> {
  const ctx = await ownComplaint(id)
  if (!ctx) return denied
  const c = await getComplaint(id)
  if (!c?.phone) return { success: false, error: 'Pas de numéro pour ce visiteur' }
  const body = normalizeSms(text).trim().slice(0, MAX_BODY)
  if (body.length < 2) return { success: false, error: 'Le message est vide' }
  if (!(await rateLimit(`complaint-sms:${ctx.userId}`, 30, HOUR))) return { success: false, error: 'Trop de messages envoyés : réessayez dans une heure' }
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } })
  const status = await sendSmsWithStatus({ to: c.phone, text: `${org?.name ?? 'Lerena'} : ${body}`, purpose: 'COMPLAINT_REPLY', organizationId: ctx.orgId })
  if (status === 'SKIPPED') return { success: false, error: 'Plus de SMS disponibles : achetez un pack dans Abonnement → Boutique' }
  if (status === 'FAILED') return { success: false, error: 'L’opérateur a refusé le message. Vérifiez le numéro.' }
  await prisma.complaintEvent.create({ data: { complaintId: id, kind: 'SMS', text: body, authorName: ctx.name } })
  return { success: true }
}

export async function closeComplaint(id: string, input: { closeReason: string; resolution?: string }): Promise<Result> {
  const ctx = await ownComplaint(id)
  if (!ctx) return denied
  if (!isFeedbackReason(input.closeReason)) return { success: false, error: 'Choisissez la cause' }
  const resolution = input.resolution?.trim().slice(0, 500) || null
  await prisma.$transaction([
    prisma.complaint.update({ where: { id }, data: { status: 'CLOSED', closeReason: input.closeReason, resolution, closedAt: new Date(), closedByName: ctx.name } }),
    prisma.complaintEvent.create({ data: { complaintId: id, kind: 'CLOSED', text: [FEEDBACK_REASONS[input.closeReason], resolution].filter(Boolean).join(' · '), authorName: ctx.name } })
  ])
  await audit({ action: 'COMPLAINT_CLOSED', targetType: 'Complaint', targetId: id, organizationId: ctx.orgId, details: input.closeReason })
  return { success: true }
}

export async function reopenComplaint(id: string): Promise<Result> {
  const ctx = await ownComplaint(id)
  if (!ctx) return denied
  await prisma.$transaction([
    prisma.complaint.update({ where: { id }, data: { status: 'OPEN', closedAt: null, closedByName: null } }),
    prisma.complaintEvent.create({ data: { complaintId: id, kind: 'REOPENED', authorName: ctx.name } })
  ])
  return { success: true }
}

// ---- Statistiques ----

const weekStart = (d: Date) => {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day
}
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

/** Satisfaction sur 8 semaines : moyenne, répartition, par service, par guichet, par semaine, motifs et délai de traitement. */
export async function getSatisfactionStats() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  const since = weekStart(new Date(Date.now() - 7 * 7 * 86400_000))
  const [ratings, complaints, completed] = await Promise.all([
    prisma.ticket.findMany({
      where: { queue: { branch: { organizationId: ctx.orgId } }, npsScore: { not: null }, createdAt: { gte: since } },
      select: { npsScore: true, createdAt: true, counterName: true, service: { select: { name: true } } }
    }),
    prisma.complaint.findMany({ where: { organizationId: ctx.orgId, createdAt: { gte: since } }, select: { status: true, reason: true, closeReason: true, createdAt: true, closedAt: true } }),
    prisma.ticket.count({ where: { queue: { branch: { organizationId: ctx.orgId } }, status: 'COMPLETED', createdAt: { gte: since } } })
  ])
  const scores = ratings.map(r => r.npsScore!)

  const group = (key: (r: (typeof ratings)[number]) => string | null) => {
    const map = new Map<string, number[]>()
    for (const r of ratings) { const k = key(r); if (k) map.set(k, [...(map.get(k) ?? []), r.npsScore!]) }
    return Array.from(map, ([label, xs]) => ({ label, avg: avg(xs)!, count: xs.length })).sort((a, b) => a.avg - b.avg || b.count - a.count)
  }

  const weeks = Array.from({ length: 8 }, (_, i) => new Date(since.getTime() + i * 7 * 86400_000))
  const byWeek = weeks.map(w => {
    const xs = ratings.filter(r => weekStart(r.createdAt).getTime() === w.getTime()).map(r => r.npsScore!)
    return { label: w.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }), value: avg(xs) ?? 0, count: xs.length }
  })

  // Cause retenue par l'établissement, sinon motif donné par le visiteur
  const reasons = new Map<FeedbackReason, number>()
  for (const c of complaints) {
    const r = (c.closeReason ?? c.reason) as FeedbackReason | null
    if (isFeedbackReason(r)) reasons.set(r, (reasons.get(r) ?? 0) + 1)
  }

  const closed = complaints.filter(c => c.closedAt)
  const hours = closed.map(c => (c.closedAt!.getTime() - c.createdAt.getTime()) / HOUR).sort((a, b) => a - b)
  return {
    average: avg(scores),
    count: scores.length,
    responseRate: completed ? Math.round((scores.length / completed) * 100) : 0,
    distribution: [5, 4, 3, 2, 1].map(s => ({ stars: s, count: scores.filter(x => x === s).length })),
    byService: group(r => r.service.name),
    byCounter: group(r => r.counterName),
    byWeek,
    reasons: Array.from(reasons, ([reason, count]) => ({ reason, label: FEEDBACK_REASONS[reason], count })).sort((a, b) => b.count - a.count),
    complaints: {
      total: complaints.length,
      open: complaints.filter(c => c.status === 'OPEN').length,
      within48h: closed.length ? Math.round((hours.filter(h => h <= 48).length / closed.length) * 100) : null,
      medianHours: hours.length ? Math.round(hours[Math.floor(hours.length / 2)]) : null
    }
  }
}
