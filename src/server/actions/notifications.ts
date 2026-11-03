'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { smsEnabled } from '@/lib/sms'
import { emailEnabled } from '@/lib/messaging'

// Paramètres → Notifications : alertes SMS aux visiteurs et usage des messages du mois

export async function getNotificationSettings() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [org, usage] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { smsTurnAlerts: true } }),
    prisma.outboundMessage.groupBy({
      by: ['channel', 'status'],
      where: { organizationId: ctx.orgId, createdAt: { gte: monthStart } },
      _count: { _all: true }
    })
  ])
  const count = (channel: string, status: string) => usage.find(u => u.channel === channel && u.status === status)?._count._all ?? 0
  return {
    smsTurnAlerts: !!org?.smsTurnAlerts,
    smsProviderReady: await smsEnabled(),
    emailProviderReady: await emailEnabled(),
    month: monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    sms: { sent: count('SMS', 'SENT'), simulated: count('SMS', 'SIMULATED'), failed: count('SMS', 'FAILED') },
    email: { sent: count('EMAIL', 'SENT'), simulated: count('EMAIL', 'SIMULATED'), failed: count('EMAIL', 'FAILED') }
  }
}

export async function setSmsTurnAlerts(enabled: boolean) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false }
  await prisma.organization.update({ where: { id: ctx.orgId }, data: { smsTurnAlerts: !!enabled } })
  await audit({ action: 'NOTIFICATIONS_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId, details: `Alertes SMS : ${enabled ? 'activées' : 'désactivées'}` })
  return { success: true }
}
