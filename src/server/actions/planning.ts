'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { branchFilter, siteForWrite, scopedBranch } from '@/lib/sites'

// Planning hebdomadaire des agents : qui tient quel guichet, et quand

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Semaine commençant le lundi donné (AAAA-MM-JJ) : équipe, guichets et créneaux. */
export async function getWeekPlanning(monday: string) {
  const ctx = await getManagerContext()
  if (!ctx || !DAY_RE.test(monday)) return null

  const start = new Date(`${monday}T00:00:00Z`)
  const end = new Date(start.getTime() + 7 * 86400_000)

  const [members, counters, shifts] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: ctx.orgId, role: { in: ['AGENT', 'RECEPTION', 'MANAGER'] } },
      select: { role: true, user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.counter.findMany({
      where: { branch: await branchFilter(ctx.orgId) },
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    }),
    prisma.shift.findMany({
      where: { branch: await branchFilter(ctx.orgId), date: { gte: start, lt: end } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      select: { id: true, date: true, startTime: true, endTime: true, userId: true, counterId: true }
    })
  ])

  return {
    staff: members.map(m => ({ id: m.user.id, name: m.user.name ?? '—', role: m.role })),
    counters,
    shifts: shifts.map(s => ({ ...s, date: s.date.toISOString().slice(0, 10) }))
  }
}

export async function addShift(input: { userId: string; counterId?: string | null; date: string; startTime: string; endTime: string }) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false, error: 'Non autorisé' }
  if (!DAY_RE.test(input.date) || !TIME_RE.test(input.startTime) || !TIME_RE.test(input.endTime) || input.startTime >= input.endTime) {
    return { success: false, error: 'Horaires invalides : le début doit précéder la fin.' }
  }

  // L'agent et le guichet doivent appartenir à l'établissement
  const [member, counter, branch] = await Promise.all([
    prisma.organizationMember.findFirst({ where: { organizationId: ctx.orgId, userId: input.userId } }),
    input.counterId ? prisma.counter.findFirst({ where: { id: input.counterId, branch: await scopedBranch(ctx.orgId) } }) : Promise.resolve(null),
    // Site du créneau : celui du guichet choisi, sinon le site actif
    siteForWrite(ctx.orgId).then(id => (id ? { id } : null))
  ])
  if (!member) return { success: false, error: 'Agent introuvable dans votre équipe' }
  if (input.counterId && !counter) return { success: false, error: 'Guichet introuvable' }
  if (!branch) return { success: false, error: 'Aucune agence configurée' }

  // Un agent ne peut pas avoir deux créneaux qui se chevauchent le même jour
  const date = new Date(`${input.date}T00:00:00Z`)
  const overlap = await prisma.shift.findFirst({
    where: { userId: input.userId, date, startTime: { lt: input.endTime }, endTime: { gt: input.startTime } }
  })
  if (overlap) return { success: false, error: 'Cet agent a déjà un créneau sur ces heures.' }

  await prisma.shift.create({
    data: { branchId: counter?.branchId ?? branch.id, userId: input.userId, counterId: counter?.id ?? null, date, startTime: input.startTime, endTime: input.endTime }
  })
  revalidatePath('/dashboard/planning')
  return { success: true }
}

export async function deleteShift(id: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx) return { success: false }
  const res = await prisma.shift.deleteMany({ where: { id, branch: await scopedBranch(ctx.orgId) } })
  revalidatePath('/dashboard/planning')
  return { success: res.count > 0 }
}

/** Recopie les créneaux de la semaine précédente sur la semaine affichée (les jours vides seulement). */
export async function copyPreviousWeek(monday: string) {
  const ctx = await getManagerContext('settings.manage')
  if (!ctx || !DAY_RE.test(monday)) return { success: false, count: 0 }

  const start = new Date(`${monday}T00:00:00Z`)
  const prevStart = new Date(start.getTime() - 7 * 86400_000)
  const [previous, existing] = await Promise.all([
    prisma.shift.findMany({ where: { branch: await branchFilter(ctx.orgId), date: { gte: prevStart, lt: start } } }),
    prisma.shift.count({ where: { branch: await branchFilter(ctx.orgId), date: { gte: start, lt: new Date(start.getTime() + 7 * 86400_000) } } })
  ])
  if (existing > 0) return { success: false, count: 0, error: 'La semaine contient déjà des créneaux.' }

  await prisma.shift.createMany({
    data: previous.map(s => ({
      branchId: s.branchId, userId: s.userId, counterId: s.counterId,
      date: new Date(s.date.getTime() + 7 * 86400_000), startTime: s.startTime, endTime: s.endTime
    }))
  })
  revalidatePath('/dashboard/planning')
  return { success: true, count: previous.length }
}
