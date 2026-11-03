import { prisma } from '@/lib/prisma'
import { claimOnce } from '@/lib/locks'
import { notify } from '@/lib/notifications'

// Revue des accès : le 1er de chaque mois (à partir de 8 h), le Propriétaire et le DG de chaque établissement sont
// prévenus des comptes inactifs depuis 60 jours. Les accès temporaires expirés sont, eux, déjà coupés à leur date.

const INACTIVE_DAYS = 60

export async function runAccessReview(now = new Date()) {
  if (now.getUTCDate() !== 1 || now.getUTCHours() < 8) return { accessReviews: 0 }
  const month = now.toISOString().slice(0, 7)
  const since = new Date(now.getTime() - INACTIVE_DAYS * 86400_000)
  const inactive = await prisma.organizationMember.findMany({
    where: { disabledAt: null, createdAt: { lt: since }, user: { OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: since } }] } },
    select: { organizationId: true }
  })
  const byOrg = new Map<string, number>()
  for (const m of inactive) byOrg.set(m.organizationId, (byOrg.get(m.organizationId) ?? 0) + 1)
  let sent = 0
  for (const [orgId, count] of Array.from(byOrg)) {
    const claimed = await claimOnce(`access-review:${orgId}:${month}`, now)
    if (!claimed) continue
    const heads = await prisma.organizationMember.findMany({ where: { organizationId: orgId, accessRole: { in: ['OWNER', 'DG'] }, disabledAt: null }, select: { userId: true } })
    if (!heads.length) continue
    await notify({
      event: 'ACCESS_REVIEW', orgId, userIds: heads.map(h => h.userId), url: '/dashboard/settings/team',
      title: `${count} compte${count > 1 ? 's' : ''} inactif${count > 1 ? 's' : ''} depuis ${INACTIVE_DAYS} jours`,
      body: 'Revue mensuelle des accès : suspendez les comptes qui ne servent plus.'
    })
    sent++
  }
  return { accessReviews: sent }
}
