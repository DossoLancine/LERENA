'use server'

import { randomBytes, randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { issueTicket, TicketError } from '@/lib/ticketing'
import { PRIORITY_SCORES, type Priority } from '@/lib/constants'
import { audit } from "@/lib/audit"

// Écrans TV et bornes : appairage par code, sans compte utilisateur sur l'appareil.
// L'appareil garde un jeton secret ; le responsable saisit le code affiché pour le rattacher.

export type DeviceType = 'TV' | 'KIOSK'

const CODE_TTL_MIN = 15
const ONLINE_WINDOW_MS = 2 * 60_000

async function freshCode() {
  // Code à 6 chiffres, unique parmi les codes en cours
  for (let i = 0; i < 10; i++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const taken = await prisma.device.findUnique({ where: { pairingCode: code }, select: { id: true } })
    if (!taken) return code
  }
  throw new Error('Impossible de générer un code')
}

/** Un nouvel écran ou une nouvelle borne demande un code d'appairage. */
export async function startPairing(type: DeviceType) {
  if (type !== 'TV' && type !== 'KIOSK') return null
  // Ménage : les appareils jamais appairés dont le code a expiré depuis une journée
  await prisma.device.deleteMany({ where: { pairedAt: null, pairingExpiresAt: { lt: new Date(Date.now() - 86400_000) } } })

  const device = await prisma.device.create({
    data: {
      type,
      token: randomBytes(24).toString('hex'),
      pairingCode: await freshCode(),
      pairingExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000)
    },
    select: { token: true, pairingCode: true, pairingExpiresAt: true }
  })
  return device
}

/** État d'un appareil (appairé ou non) ; sert aussi de signe de vie. Renouvelle le code s'il a expiré. */
export async function getDeviceStatus(token: string) {
  if (!token || token.length > 100) return null
  const device = await prisma.device.findUnique({ where: { token } })
  if (!device) return null

  if (!device.organizationId) {
    if (!device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
      const renewed = await prisma.device.update({
        where: { id: device.id },
        data: { pairingCode: await freshCode(), pairingExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
        select: { pairingCode: true }
      })
      return { paired: false as const, type: device.type as DeviceType, code: renewed.pairingCode }
    }
    return { paired: false as const, type: device.type as DeviceType, code: device.pairingCode }
  }

  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
  return { paired: true as const, type: device.type as DeviceType, orgId: device.organizationId, name: device.name }
}

/** Le responsable rattache l'appareil à son établissement en saisissant le code affiché. */
export async function pairDevice(code: string, name: string) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return { success: false, error: 'Le code fait 6 chiffres' }

  const device = await prisma.device.findUnique({ where: { pairingCode: clean } })
  if (!device || device.organizationId || !device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
    return { success: false, error: 'Code inconnu ou expiré. Rechargez la page sur l’appareil pour afficher un nouveau code, puis saisissez-le ici.' }
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      organizationId: ctx.orgId,
      name: name.trim().slice(0, 40) || (device.type === 'TV' ? 'Écran TV' : 'Borne'),
      pairedAt: new Date(),
      pairingCode: null,
      pairingExpiresAt: null
    }
  })
  await audit({ action: 'DEVICE_PAIRED', targetType: 'Device', targetId: device.id, organizationId: ctx.orgId, details: device.type })
  revalidatePath('/dashboard/settings/devices')
  return { success: true, type: device.type as DeviceType }
}

export async function listDevices() {
  const ctx = await getManagerContext()
  if (!ctx) return []
  const devices = await prisma.device.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { pairedAt: 'asc' },
    select: { id: true, type: true, name: true, pairedAt: true, lastSeenAt: true }
  })
  const now = Date.now()
  return devices.map(d => ({
    ...d,
    type: d.type as DeviceType,
    online: !!d.lastSeenAt && now - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null
  }))
}

export async function renameDevice(id: string, name: string) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  const res = await prisma.device.updateMany({ where: { id, organizationId: ctx.orgId }, data: { name: name.trim().slice(0, 40) } })
  return { success: res.count > 0 }
}

/** Retire l'appareil : son jeton ne donne plus accès à rien, il revient à l'écran d'appairage. */
export async function removeDevice(id: string) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  const res = await prisma.device.deleteMany({ where: { id, organizationId: ctx.orgId } })
  revalidatePath('/dashboard/settings/devices')
  return { success: res.count > 0 }
}

// ---- Borne d'accueil ----

async function kioskDevice(token: string) {
  if (!token || token.length > 100) return null
  const device = await prisma.device.findUnique({ where: { token }, select: { id: true, type: true, organizationId: true } })
  return device && device.type === 'KIOSK' && device.organizationId ? device : null
}

/** Services proposés par la borne, avec l'affluence actuelle. */
export async function getKioskBoard(token: string) {
  const device = await kioskDevice(token)
  if (!device) return null
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })

  const orgId = device.organizationId!
  const [org, services, waiting] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, isActive: true, sector: { select: { icon: true } } } }),
    prisma.service.findMany({
      where: { isActive: true, branch: { organizationId: orgId } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, avgDurationMin: true, icon: true }
    }),
    prisma.ticket.groupBy({
      by: ['serviceId'],
      where: { status: 'WAITING', queue: { branch: { organizationId: orgId } } },
      _count: { _all: true }
    })
  ])
  if (!org) return null
  return {
    orgId,
    orgName: org.name,
    isOpen: org.isActive,
    services: services.map(s => {
      const count = waiting.find(w => w.serviceId === s.id)?._count._all ?? 0
      return { ...s, icon: s.icon ?? org.sector?.icon ?? null, waiting: count, waitMin: count * s.avgDurationMin }
    })
  }
}

/** Ticket pris en libre-service à la borne. */
export async function issueKioskTicket(token: string, serviceId: string, priority: Priority = 'STANDARD') {
  const device = await kioskDevice(token)
  if (!device) return { success: false as const, error: 'Borne non reconnue' }
  if (!PRIORITY_SCORES[priority]) return { success: false as const, error: 'Priorité invalide' }

  try {
    const ticket = await issueTicket({
      orgId: device.organizationId!,
      serviceId,
      priority,
      owner: { userId: null, name: 'Borne', phone: null }
    })
    const [service, ahead] = await Promise.all([
      prisma.service.findUnique({ where: { id: ticket.serviceId }, select: { name: true, avgDurationMin: true } }),
      prisma.ticket.count({
        where: {
          queueId: ticket.queueId, status: 'WAITING',
          OR: [
            { priorityScore: { gt: ticket.priorityScore } },
            { priorityScore: ticket.priorityScore, queuedAt: { lt: ticket.queuedAt } }
          ]
        }
      })
    ])
    return {
      success: true as const,
      ticket: { id: ticket.id, displayNum: ticket.displayNum, serviceName: service?.name ?? '', ahead, waitMin: ahead * (service?.avgDurationMin ?? 15), issuedAt: ticket.createdAt.toISOString() }
    }
  } catch (error) {
    if (error instanceof TicketError) return { success: false as const, error: error.message }
    console.error('issueKioskTicket error:', error)
    return { success: false as const, error: 'Une erreur est survenue' }
  }
}
