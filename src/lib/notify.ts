import { prisma } from '@/lib/prisma'
import { sendPushToTicket, type PushPayload } from '@/lib/push'
import { sendSmsMessage } from '@/lib/messaging'

// Prévenir un visiteur : notification push d'abord ; SMS en complément si l'établissement l'a activé,
// que le visiteur ne reçoit pas de push et qu'un numéro est connu. Au plus 2 SMS par ticket (coût).

const MAX_SMS_PER_TICKET = 2

export async function notifyTicket(ticketId: string, payload: PushPayload, sms?: string) {
  await sendPushToTicket(ticketId, payload)
  if (!sms) return

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        guestPhone: true,
        user: { select: { phone: true } },
        _count: { select: { pushSubscriptions: true } },
        queue: { select: { branch: { select: { organization: { select: { id: true, smsTurnAlerts: true } } } } } }
      }
    })
    const org = ticket?.queue.branch.organization
    const phone = ticket?.guestPhone || ticket?.user?.phone
    if (!ticket || !org?.smsTurnAlerts || !phone || ticket._count.pushSubscriptions > 0) return
    const { hasFeature } = await import('@/lib/billing')
    if (!(await hasFeature(org.id, 'SMS_ALERTS'))) return

    const already = await prisma.outboundMessage.count({ where: { ticketId, channel: 'SMS', purpose: 'TURN_SOON' } })
    if (already >= MAX_SMS_PER_TICKET) return
    await sendSmsMessage({ to: phone, text: sms, purpose: 'TURN_SOON', organizationId: org.id, ticketId })
  } catch (error) {
    console.error('Alerte SMS :', error)
  }
}
