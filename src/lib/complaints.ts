import { prisma } from '@/lib/prisma'
import { appUrl, sendEmail } from '@/lib/messaging'
import { refreshCustomersOfTickets } from '@/lib/customers'
import { FEEDBACK_REASONS, type FeedbackReason } from '@/lib/customer-labels'

// Satisfaction et réclamations : la note donnée après le passage, avec commentaire et motif facultatifs.
// Une note de 2 étoiles ou moins, ou un 3 accompagné d'un motif ou d'un commentaire négatif, ouvre un avis « à traiter ».

// Mots qui signalent un mécontentement dans un commentaire (sans accents, en minuscules)
const NEGATIVE = /\b(lent|lente|lenteur|long|longue|attente|attendu|attendre|mal|mauvais|mauvaise|impoli|impolie|irrespect|desagreable|nul|nulle|honte|inadmissible|inacceptable|scandale|scandaleux|catastroph\w*|decu|decue|decevant|mecontent\w*|sale|perdu|oublie|erreur|jamais|pire|arnaque|insulte|mepris\w*|crie|criee|ignore|ignoree)\b/

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const isNegativeComment = (comment: string | null | undefined) => !!comment && NEGATIVE.test(plain(comment))

export const needsAction = (score: number, comment: string | null, reason: string | null) =>
  score <= 2 || (score === 3 && (!!reason || isNegativeComment(comment)))

export const isFeedbackReason = (r: unknown): r is FeedbackReason => typeof r === 'string' && Object.prototype.hasOwnProperty.call(FEEDBACK_REASONS, r)

/** Enregistre la note (et la complète si le visiteur ajoute ensuite un commentaire) ; ouvre ou met à jour l'avis à traiter. */
export async function recordRating(ticketId: string, score: number, extra: { comment?: string | null; reason?: string | null } = {}) {
  const comment = extra.comment?.trim().replace(/\s+/g, ' ').slice(0, 500) || null
  const reason = isFeedbackReason(extra.reason) ? extra.reason : null
  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { npsScore: score, npsAt: new Date(), ...(extra.comment !== undefined ? { npsComment: comment } : {}), ...(extra.reason !== undefined ? { npsReason: reason } : {}) },
    select: { id: true, npsComment: true, npsReason: true, customerId: true, displayNum: true, counterName: true, service: { select: { name: true } }, queue: { select: { branch: { select: { organizationId: true, name: true, organization: { select: { name: true } } } } } } }
  })
  await refreshCustomersOfTickets([ticketId])

  const orgId = ticket.queue.branch.organizationId
  const existing = await prisma.complaint.findUnique({ where: { ticketId }, select: { id: true, status: true } })
  if (!needsAction(score, ticket.npsComment, ticket.npsReason)) {
    // Note relevée ensuite (5 étoiles après un 2) : l'avis encore ouvert n'a plus lieu d'être
    if (existing?.status === 'OPEN') await prisma.complaint.delete({ where: { id: existing.id } })
    return { complaint: false }
  }
  const data = { rating: score, comment: ticket.npsComment, reason: ticket.npsReason, customerId: ticket.customerId }
  if (existing) {
    await prisma.complaint.update({ where: { id: existing.id }, data })
    return { complaint: true }
  }
  const created = await prisma.complaint.create({ data: { ...data, organizationId: orgId, ticketId } , select: { id: true } })
  await alertManagers(orgId, {
    id: created.id, orgName: ticket.queue.branch.organization.name, site: ticket.queue.branch.name,
    score, comment: ticket.npsComment, reason: ticket.npsReason, ticket: ticket.displayNum, service: ticket.service.name, counter: ticket.counterName
  }).catch(() => null)
  return { complaint: true }
}

/** Les responsables sont prévenus par e-mail de chaque nouvel avis à traiter (objectif : réponse sous 48 h). */
async function alertManagers(orgId: string, c: { id: string; orgName: string; site: string; score: number; comment: string | null; reason: string | null; ticket: string; service: string; counter: string | null }) {
  const managers = await prisma.organizationMember.findMany({ where: { organizationId: orgId, role: 'MANAGER' }, select: { user: { select: { email: true } } } })
  const to = Array.from(new Set(managers.map(m => m.user.email).filter((e): e is string => !!e)))
  const text = [
    `Avis à traiter chez ${c.orgName} (${c.site})`, '',
    `${c.score} étoile${c.score > 1 ? 's' : ''} sur 5${c.reason ? ` · ${FEEDBACK_REASONS[c.reason as FeedbackReason]}` : ''}`,
    c.comment ? `« ${c.comment} »` : 'Sans commentaire',
    `Ticket ${c.ticket} · ${c.service}${c.counter ? ` · ${c.counter}` : ''}`, '',
    `Traiter l'avis : ${appUrl()}/dashboard/feedback?id=${c.id}`
  ].join('\n')
  for (const email of to) await sendEmail({ to: email, subject: `Avis à traiter : ${c.score}/5, ${c.service}`, text, purpose: 'COMPLAINT_NEW', organizationId: orgId })
}
