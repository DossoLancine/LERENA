import { cache } from 'react'
import { prisma } from '@/lib/prisma'

// Réglages de la plateforme et secteurs d'activité, lus en base (gérés dans /admin)

export interface SectorService {
  name: string
  durationMin: number
  prefix: string
  icon?: string
}

export const getPlatformConfig = cache(async () => {
  // Ligne unique créée au premier besoin, avec les valeurs par défaut du schéma
  return prisma.platformConfig.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} })
})

export const getActiveSectors = cache(async () => {
  return prisma.sector.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true, name: true, description: true, icon: true, color: true }
  })
})

export function parseSectorServices(json: unknown): SectorService[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map(s => ({
      name: String(s.name ?? '').slice(0, 60),
      durationMin: Math.min(240, Math.max(1, Number(s.durationMin) || 15)),
      prefix: String(s.prefix ?? 'A').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'A',
      icon: typeof s.icon === 'string' ? s.icon : undefined
    }))
    .filter(s => s.name)
}
