'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { notifyOrg } from '@/lib/realtime'

// Position GPS, protection anti-abus et horaires d'ouverture de l'établissement du responsable

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

async function mainBranch(orgId: string) {
  return prisma.branch.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
}

export async function getSiteLocation() {
  const ctx = await getManagerContext()
  if (!ctx) return null

  const [org, branch] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.orgId },
      select: { lat: true, lng: true, address: true, city: true, requireGps: true, maxRadiusKm: true }
    }),
    mainBranch(ctx.orgId)
  ])
  if (!org || !branch) return null

  const hours = await prisma.businessHour.findMany({ where: { branchId: branch.id }, orderBy: { dayOfWeek: 'asc' } })
  return { ...org, hours: hours.map(h => ({ dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed })) }
}

export async function updateSiteLocation(data: { lat: number; lng: number; requireGps: boolean; maxRadiusKm: number }) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Non autorisé' }

  const valid = Number.isFinite(data.lat) && Number.isFinite(data.lng) && Math.abs(data.lat) <= 90 && Math.abs(data.lng) <= 180
  if (!valid) return { success: false, error: 'Position invalide' }
  const radius = Math.min(50, Math.max(0.1, Number(data.maxRadiusKm) || 10))

  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: { lat: data.lat, lng: data.lng, requireGps: !!data.requireGps, maxRadiusKm: radius }
  })
  await notifyOrg(ctx.orgId)
  revalidatePath('/explore')
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}

/** Remplace les horaires de la semaine (7 lignes, dimanche = 0). Les créneaux de rendez-vous en dépendent. */
export async function updateBusinessHours(hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[]) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const branch = await mainBranch(ctx.orgId)
  if (!branch) return { success: false, error: 'Aucune agence configurée' }

  const clean = hours.filter(h => Number.isInteger(h.dayOfWeek) && h.dayOfWeek >= 0 && h.dayOfWeek <= 6)
  for (const h of clean) {
    if (!h.isClosed && (!TIME_RE.test(h.openTime) || !TIME_RE.test(h.closeTime) || h.openTime >= h.closeTime)) {
      return { success: false, error: 'Vérifiez les horaires : l’ouverture doit précéder la fermeture.' }
    }
  }

  await prisma.$transaction([
    prisma.businessHour.deleteMany({ where: { branchId: branch.id } }),
    prisma.businessHour.createMany({
      data: clean.map(h => ({ branchId: branch.id, dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed }))
    })
  ])
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}
