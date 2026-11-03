import { prisma } from '@/lib/prisma'
import { deleteCustomersOfUser } from '@/lib/customers'

// Droits des personnes (loi n° 2013-450) : export de toutes les données d'un compte, et suppression
// (le compte disparaît ; ses tickets et rendez-vous restent dans les statistiques, sans nom ni numéro).

export class PersonalDataError extends Error { readonly expected = true }

export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastLoginAt: true,
      termsAcceptedAt: true, termsVersion: true, twoFactorEnabled: true,
      tickets: { orderBy: { createdAt: 'desc' }, select: { displayNum: true, status: true, createdAt: true, calledAt: true, completedAt: true, priorityReason: true, service: { select: { name: true } }, queue: { select: { branch: { select: { name: true, organization: { select: { name: true } } } } } } } },
      appointments: { orderBy: { scheduledDate: 'desc' }, select: { scheduledDate: true, status: true, source: true, createdAt: true, service: { select: { name: true } }, organization: { select: { name: true } } } },
      favorites: { select: { createdAt: true, organization: { select: { name: true } } } },
      authSessions: { orderBy: { createdAt: 'desc' }, select: { createdAt: true, lastSeenAt: true, userAgent: true, revokedAt: true } },
      memberships: { select: { role: true, organization: { select: { name: true } } } }
    }
  })
  if (!user) throw new PersonalDataError('Compte introuvable')
  const to = [user.phone, user.email].filter((v): v is string => !!v)
  const messages = to.length ? await prisma.outboundMessage.findMany({ where: { to: { in: to } }, orderBy: { createdAt: 'desc' }, select: { channel: true, purpose: true, status: true, createdAt: true, body: true } }) : []
  return {
    exportedAt: new Date().toISOString(),
    notice: 'Export de vos données Lerena (loi ivoirienne n° 2013-450). Les dates sont en temps universel (UTC).',
    account: { name: user.name, email: user.email, phone: user.phone, role: user.role, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, termsAcceptedAt: user.termsAcceptedAt, termsVersion: user.termsVersion, twoFactorEnabled: user.twoFactorEnabled },
    establishments: user.memberships.map(m => ({ establishment: m.organization.name, role: m.role })),
    tickets: user.tickets.map(t => ({ number: t.displayNum, establishment: t.queue.branch.organization.name, site: t.queue.branch.name, service: t.service?.name, status: t.status, priority: t.priorityReason, takenAt: t.createdAt, calledAt: t.calledAt, completedAt: t.completedAt })),
    appointments: user.appointments.map(a => ({ establishment: a.organization.name, service: a.service?.name, date: a.scheduledDate, status: a.status, bookedAt: a.createdAt, via: a.source })),
    favorites: user.favorites.map(f => ({ establishment: f.organization.name, addedAt: f.createdAt })),
    sessions: user.authSessions.map(s => ({ startedAt: s.createdAt, lastSeenAt: s.lastSeenAt, device: s.userAgent, closedAt: s.revokedAt })),
    messages: messages.map(m => ({ channel: m.channel, purpose: m.purpose, status: m.status, sentAt: m.createdAt, text: m.body }))
  }
}

/**
 * Suppression d'un compte visiteur : tickets et rendez-vous anonymisés (statistiques conservées),
 * contenu des messages effacé, puis compte supprimé avec ses favoris, sessions et abonnements aux notifications.
 * Les comptes d'équipe se suppriment depuis l'établissement (Paramètres → Équipe).
 */
export async function deleteUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, phone: true, email: true, _count: { select: { memberships: true, networkMemberships: true } } } })
  if (!user) throw new PersonalDataError('Compte introuvable')
  if (user.role !== 'CLIENT' || user._count.memberships > 0 || user._count.networkMemberships > 0) {
    throw new PersonalDataError('Compte d’équipe : il se supprime depuis l’établissement (Paramètres → Équipe & agents).')
  }
  const to = [user.phone, user.email].filter((v): v is string => !!v)
  // Fiches visiteurs (CRM) dans tous les établissements : notes et étiquettes comprises
  await deleteCustomersOfUser(userId, user.phone)
  await prisma.complaint.deleteMany({ where: { ticket: { userId } } })
  await prisma.$transaction([
    prisma.ticket.updateMany({ where: { userId }, data: { userId: null, guestName: null, guestPhone: null, notes: null, npsComment: null } }),
    prisma.appointment.updateMany({ where: { userId }, data: { userId: null, guestName: null, guestPhone: null, notes: null, manageTokenHash: null } }),
    ...(user.phone ? [
      prisma.ticket.updateMany({ where: { guestPhone: user.phone }, data: { guestName: null, guestPhone: null } }),
      prisma.appointment.updateMany({ where: { guestPhone: user.phone }, data: { guestName: null, guestPhone: null } })
    ] : []),
    prisma.outboundMessage.updateMany({ where: { to: { in: to } }, data: { to: '[effacé]', body: '[effacé]' } }),
    prisma.user.delete({ where: { id: userId } })
  ])
}
