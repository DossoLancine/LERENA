import { prisma } from '@/lib/prisma'

// Durées de conservation (loi ivoirienne n° 2013-450 : données adéquates et conservées le temps nécessaire).
// Les données techniques sont supprimées vite ; les tickets et rendez-vous sont anonymisés après la durée
// réglée dans la console (12 mois par défaut) : les statistiques restent, les noms et numéros disparaissent.

const DAY = 86400_000
const ago = (days: number) => new Date(Date.now() - days * DAY)

export async function runRetentionJobs() {
  const config = await prisma.platformConfig.findUnique({ where: { id: 'default' }, select: { retentionMonths: true } })
  const months = Math.max(1, config?.retentionMonths ?? 12)
  const cutoff = new Date()
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)

  const [rate, logins, resets, phones, sessions, errors, smsBodies, messages, tickets, appointments, notifications] = await Promise.all([
    prisma.rateEvent.deleteMany({ where: { createdAt: { lt: ago(1) } } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: ago(30) } } }),
    prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: ago(7) } } }),
    prisma.phoneVerification.deleteMany({ where: { expiresAt: { lt: ago(1) } } }),
    prisma.authSession.deleteMany({ where: { OR: [{ revokedAt: { lt: ago(90) } }, { lastSeenAt: { lt: ago(90) } }] } }),
    prisma.errorEvent.deleteMany({ where: { resolvedAt: { lt: ago(90) } } }),
    // Contenu des SMS et e-mails effacé après 6 mois (le fait qu'un message soit parti reste, pour la facturation)
    prisma.outboundMessage.updateMany({ where: { createdAt: { lt: ago(183) }, NOT: { body: '[effacé]' } }, data: { body: '[effacé]', to: '[effacé]' } }),
    prisma.outboundMessage.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.ticket.updateMany({
      where: { createdAt: { lt: cutoff }, OR: [{ guestName: { not: null } }, { guestPhone: { not: null } }, { userId: { not: null } }, { notes: { not: null } }, { npsComment: { not: null } }] },
      data: { guestName: null, guestPhone: null, userId: null, notes: null, npsComment: null }
    }),
    prisma.appointment.updateMany({
      where: { scheduledDate: { lt: cutoff }, OR: [{ guestName: { not: null } }, { guestPhone: { not: null } }, { userId: { not: null } }, { notes: { not: null } }] },
      data: { guestName: null, guestPhone: null, userId: null, notes: null, manageTokenHash: null, code: null }
    }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })
  ])
  // Fiches visiteurs sans passage ni rendez-vous depuis la durée réglée, sauf accord pour recevoir des messages
  const complaints = await prisma.complaint.deleteMany({ where: { createdAt: { lt: cutoff } } })
  const customers = await prisma.customer.deleteMany({ where: { lastSeenAt: { lt: cutoff }, consentAt: null } })
  // Notes libres des agents sur l'historique des tickets
  const notes = await prisma.ticketEvent.updateMany({ where: { createdAt: { lt: cutoff }, note: { not: null } }, data: { note: null } })

  return {
    retention: {
      months,
      purged: rate.count + logins.count + resets.count + phones.count + sessions.count + errors.count + messages.count + notifications.count,
      smsBodiesErased: smsBodies.count,
      ticketsAnonymized: tickets.count,
      appointmentsAnonymized: appointments.count,
      notesErased: notes.count,
      customersDeleted: customers.count,
      complaintsDeleted: complaints.count
    }
  }
}
