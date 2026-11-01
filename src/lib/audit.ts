import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/session'

// Journal d'audit des actions sensibles : création d'établissement, de compte, changements d'équipe,
// remise à zéro de file… Un échec d'écriture ne bloque jamais l'action elle-même.

export async function audit(entry: {
  action: string
  targetType?: string
  targetId?: string
  organizationId?: string | null
  details?: string
}) {
  try {
    const user = await getSessionUser()
    await prisma.auditLog.create({
      data: {
        actorId: user?.id ?? null,
        actorName: user?.name ?? null,
        action: entry.action,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        organizationId: entry.organizationId ?? null,
        details: entry.details?.slice(0, 500) ?? null
      }
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}
