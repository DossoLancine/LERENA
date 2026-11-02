'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { hasFeature } from '@/lib/billing'
import { notifyOrg } from '@/lib/realtime'

// Marque de l'établissement : logo (tous les forfaits) et couleur (forfaits « Couleurs et logo personnalisés »).
// Affichés sur la TV, la borne, le ticket, la fiche de l'établissement et l'affiche.

const LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/
const MAX_LOGO = 150_000
const COLOR = /^#[0-9a-f]{6}$/i

export async function getBranding() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const [org, canColor] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true, logo: true, brandColor: true } }),
    hasFeature(ctx.orgId, 'BRANDING')
  ])
  return org ? { ...org, canColor } : null
}

export async function saveBranding(data: { logo?: string | null; brandColor?: string | null }) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false as const, error: 'Réservé au responsable' }
  const update: { logo?: string | null; brandColor?: string | null } = {}

  if (data.logo !== undefined) {
    if (data.logo && (!LOGO.test(data.logo) || data.logo.length > MAX_LOGO)) return { success: false as const, error: 'Image invalide ou trop lourde (PNG, JPEG ou WebP)' }
    update.logo = data.logo || null
  }
  if (data.brandColor !== undefined) {
    if (data.brandColor && !COLOR.test(data.brandColor)) return { success: false as const, error: 'Couleur invalide' }
    if (data.brandColor && !(await hasFeature(ctx.orgId, 'BRANDING'))) return { success: false as const, error: 'La couleur personnalisée est incluse dans le forfait Entreprise : voir Abonnement.' }
    update.brandColor = data.brandColor?.toLowerCase() || null
  }

  await prisma.organization.update({ where: { id: ctx.orgId }, data: update })
  await audit({ action: 'BRANDING_UPDATED', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId, details: [update.logo !== undefined && (update.logo ? 'logo' : 'logo retiré'), update.brandColor !== undefined && `couleur ${update.brandColor ?? 'par défaut'}`].filter(Boolean).join(' · ') })
  await notifyOrg(ctx.orgId) // les écrans et bornes se mettent à jour
  revalidatePath(`/org/${ctx.orgId}`)
  revalidatePath(`/tv/${ctx.orgId}`)
  return { success: true as const }
}
