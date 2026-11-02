'use server'

import { randomInt } from 'crypto'
import { hashSecret, isPlausibleSecret, newSecret } from '@/lib/secrets'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { siteForWrite, siteScope } from '@/lib/sites'
import { priorityOptions } from '@/lib/priorities'
import { AppointmentError, checkIn } from '@/lib/appointments'
import { issueTicket, TicketError } from '@/lib/ticketing'
import { audit } from "@/lib/audit"

// Écrans TV et bornes : appairage par code, sans compte utilisateur sur l'appareil.
// L'appareil garde un jeton secret ; le responsable saisit le code affiché pour le rattacher.

export type DeviceType = 'TV' | 'KIOSK'
// Appareil ouvert sur le lien unique /appareil : son rôle (écran ou borne) est choisi au moment de l'appairage
export type PairingType = DeviceType | 'ANY'

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

/**
 * Appareil correspondant à un jeton. La base ne garde que l'empreinte du jeton ;
 * un ancien jeton encore stocké en clair (48 caractères hexadécimaux) est converti au premier contact.
 */
async function findDeviceByToken(token: string) {
  if (!isPlausibleSecret(token)) return null
  const device = await prisma.device.findUnique({ where: { token: hashSecret(token) } })
  if (device || !/^[0-9a-f]{48}$/.test(token)) return device
  const legacy = await prisma.device.findUnique({ where: { token } })
  if (!legacy) return null
  return prisma.device.update({ where: { id: legacy.id }, data: { token: hashSecret(token) } })
}

/** Un nouvel écran ou une nouvelle borne demande un code d'appairage. */
export async function startPairing(type: PairingType) {
  if (type !== 'TV' && type !== 'KIOSK' && type !== 'ANY') return null
  // Ménage : les appareils jamais appairés dont le code a expiré depuis une journée
  await prisma.device.deleteMany({ where: { pairedAt: null, pairingExpiresAt: { lt: new Date(Date.now() - 86400_000) } } })

  const token = newSecret()
  const device = await prisma.device.create({
    data: {
      type,
      token: hashSecret(token),
      pairingCode: await freshCode(),
      pairingExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000)
    },
    select: { pairingCode: true, pairingExpiresAt: true }
  })
  // Le jeton en clair ne quitte le serveur qu'une fois, vers l'appareil
  return { ...device, token }
}

/** État d'un appareil (appairé ou non) ; sert aussi de signe de vie. Renouvelle le code s'il a expiré. */
export async function getDeviceStatus(token: string) {
  const device = await findDeviceByToken(token)
  if (!device) return null

  if (!device.organizationId) {
    if (!device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
      const renewed = await prisma.device.update({
        where: { id: device.id },
        data: { pairingCode: await freshCode(), pairingExpiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000) },
        select: { pairingCode: true }
      })
      return { paired: false as const, type: device.type as PairingType, code: renewed.pairingCode }
    }
    return { paired: false as const, type: device.type as PairingType, code: device.pairingCode }
  }

  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })
  return { paired: true as const, type: device.type as PairingType, orgId: device.organizationId, siteId: device.branchId, name: device.name }
}

/** Le responsable rattache l'appareil à son établissement en saisissant le code affiché. */
export async function pairDevice(code: string, name: string, role?: DeviceType) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Non autorisé' }
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return { success: false, error: 'Le code fait 6 chiffres' }

  if (role && role !== 'TV' && role !== 'KIOSK') return { success: false, error: 'Rôle invalide' }
  const device = await prisma.device.findUnique({ where: { pairingCode: clean } })
  if (!device || device.organizationId || !device.pairingExpiresAt || device.pairingExpiresAt < new Date()) {
    return { success: false, error: 'Code inconnu ou expiré. Rechargez la page sur l’appareil pour afficher un nouveau code, puis saisissez-le ici.' }
  }

  // Rôle choisi par le responsable ; à défaut, celui de l'adresse ouverte sur l'appareil
  const type: DeviceType | null = role ?? (device.type === 'TV' || device.type === 'KIOSK' ? device.type : null)
  if (!type) return { success: false, error: 'Choisissez si cet appareil est un écran ou une borne' }
  const count = await prisma.device.count({ where: { organizationId: ctx.orgId, type } })

  await prisma.device.update({
    where: { id: device.id },
    data: {
      type,
      organizationId: ctx.orgId,
      branchId: await siteForWrite(ctx.orgId),
      name: name.trim().slice(0, 40) || `${type === 'TV' ? 'Écran' : 'Borne'} ${count + 1}`,
      pairedAt: new Date(),
      pairingCode: null,
      pairingExpiresAt: null
    }
  })
  await audit({ action: 'DEVICE_PAIRED', targetType: 'Device', targetId: device.id, organizationId: ctx.orgId, details: type })
  revalidatePath('/dashboard/settings/devices')
  return { success: true, type }
}

export async function listDevices() {
  const ctx = await getManagerContext()
  if (!ctx) return []
  const scope = await siteScope(ctx.orgId)
  const devices = await prisma.device.findMany({
    where: { organizationId: ctx.orgId, ...(scope ? { OR: [{ branchId: scope }, { branchId: null }] } : {}) },
    orderBy: { pairedAt: 'asc' },
    select: { id: true, type: true, name: true, pairedAt: true, lastSeenAt: true, branch: { select: { name: true } } }
  })
  const now = Date.now()
  return devices.map(d => ({
    ...d,
    type: d.type as DeviceType,
    siteName: d.branch?.name ?? null,
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
  const device = await findDeviceByToken(token)
  return device && device.type === 'KIOSK' && device.organizationId ? device : null
}

/** Services proposés par la borne, avec l'affluence actuelle. */
export async function getKioskBoard(token: string) {
  const device = await kioskDevice(token)
  if (!device) return null
  await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } })

  const orgId = device.organizationId!
  const [org, services, waiting, priorities] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, isActive: true, logo: true, brandColor: true, sector: { select: { icon: true } } } }),
    prisma.service.findMany({
      // Services du site de la borne (de tout l'établissement si la borne n'est pas rattachée à un site)
      where: { isActive: true, branch: device.branchId ? { id: device.branchId } : { organizationId: orgId } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, avgDurationMin: true, icon: true }
    }),
    prisma.ticket.groupBy({
      by: ['serviceId'],
      where: { status: 'WAITING', queue: { branch: device.branchId ? { id: device.branchId } : { organizationId: orgId } } },
      _count: { _all: true }
    }),
    // Motifs proposés à la borne (vide si l'établissement ne l'autorise pas)
    priorityOptions(orgId, 'kiosk')
  ])
  if (!org) return null
  return {
    orgId,
    priorities,
    orgName: org.name,
    logo: org.logo,
    brandColor: org.brandColor,
    isOpen: org.isActive,
    services: services.map(s => {
      const count = waiting.find(w => w.serviceId === s.id)?._count._all ?? 0
      return { ...s, icon: s.icon ?? org.sector?.icon ?? null, waiting: count, waitMin: count * s.avgDurationMin }
    })
  }
}

/** Ticket pris à la borne ; la priorité n'est retenue que si l'établissement l'autorise à la borne. */
export async function issueKioskTicket(token: string, serviceId: string, priorityId: string | null = null) {
  const device = await kioskDevice(token)
  if (!device) return { success: false as const, error: 'Borne non reconnue' }

  try {
    const ticket = await issueTicket({
      orgId: device.organizationId!,
      serviceId,
      priorityId,
      channel: 'kiosk',
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

// ---- Lien d'installation : plusieurs appareils sans code à recopier ----
// À usage unique, valable 30 minutes, renouvelé après chaque appareil installé.
// Le secret du lien n'est montré qu'une fois au responsable ; la base n'en garde que l'empreinte.

const SETUP_LINK_TTL_MIN = 30

/** Nouveau lien d'installation pour l'établissement ; les liens précédents non utilisés sont annulés. */
export async function createSetupLink() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const now = new Date()
  await prisma.deviceSetupLink.updateMany({
    where: { organizationId: ctx.orgId, usedAt: null, expiresAt: { gt: now } },
    data: { expiresAt: now }
  })
  const secret = newSecret()
  const link = await prisma.deviceSetupLink.create({
    data: {
      organizationId: ctx.orgId,
      // Les appareils installés avec ce lien appartiennent au site actif
      branchId: await siteForWrite(ctx.orgId),
      tokenHash: hashSecret(secret),
      expiresAt: new Date(now.getTime() + SETUP_LINK_TTL_MIN * 60_000),
      createdById: ctx.userId
    },
    select: { id: true, expiresAt: true }
  })
  return { id: link.id, path: `/i/${secret}`, expiresAt: link.expiresAt.toISOString() }
}

/** Le lien affiché a-t-il servi, ou expiré ? (le tableau de bord en génère alors un nouveau) */
export async function getSetupLinkState(id: string) {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const link = await prisma.deviceSetupLink.findFirst({
    where: { id, organizationId: ctx.orgId },
    select: { usedAt: true, expiresAt: true, deviceId: true }
  })
  if (!link) return null
  const device = link.deviceId ? await prisma.device.findUnique({ where: { id: link.deviceId }, select: { name: true, type: true } }) : null
  return { used: !!link.usedAt, expired: !link.usedAt && link.expiresAt < new Date(), device }
}

export async function revokeSetupLink(id: string) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  await prisma.deviceSetupLink.updateMany({ where: { id, organizationId: ctx.orgId, usedAt: null }, data: { expiresAt: new Date() } })
  return { success: true }
}

async function activeLink(secret: string) {
  if (!isPlausibleSecret(secret)) return null
  return prisma.deviceSetupLink.findFirst({
    where: { tokenHash: hashSecret(secret), usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, organizationId: true, branchId: true, organization: { select: { name: true } } }
  })
}

/** Ouverture du lien sur l'appareil : nom de l'établissement si le lien est encore valable. */
export async function checkSetupLink(secret: string) {
  const link = await activeLink(secret)
  return link ? { valid: true as const, orgName: link.organization.name } : { valid: false as const }
}

/** L'appareil choisit son rôle : il est rattaché à l'établissement et le lien ne peut plus resservir. */
export async function redeemSetupLink(secret: string, role: DeviceType) {
  if (role !== 'TV' && role !== 'KIOSK') return { success: false as const, error: 'Rôle invalide' }
  const link = await activeLink(secret)
  if (!link) return { success: false as const, error: 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien au responsable.' }

  // Réservation atomique : si deux appareils ouvrent le même lien, un seul l'obtient
  const claimed = await prisma.deviceSetupLink.updateMany({
    where: { id: link.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() }
  })
  if (claimed.count !== 1) return { success: false as const, error: 'Ce lien vient d’être utilisé par un autre appareil. Demandez un nouveau lien.' }

  const token = newSecret()
  const count = await prisma.device.count({ where: { organizationId: link.organizationId, type: role } })
  const device = await prisma.device.create({
    data: {
      type: role,
      token: hashSecret(token),
      organizationId: link.organizationId,
      branchId: link.branchId,
      name: `${role === 'TV' ? 'Écran' : 'Borne'} ${count + 1}`,
      pairedAt: new Date(),
      lastSeenAt: new Date()
    },
    select: { id: true }
  })
  await prisma.deviceSetupLink.update({ where: { id: link.id }, data: { deviceId: device.id } })
  await audit({ action: 'DEVICE_PAIRED', targetType: 'Device', targetId: device.id, organizationId: link.organizationId, details: `${role} (lien d’installation)` })
  revalidatePath('/dashboard/settings/devices')
  return { success: true as const, token, orgId: link.organizationId, siteId: link.branchId, type: role }
}

/** Arrivée d'un rendez-vous à la borne : le code à 6 chiffres donne un ticket placé à l'heure du RDV. */
export async function kioskCheckIn(token: string, code: string) {
  const device = await kioskDevice(token)
  if (!device) return { success: false as const, error: 'Borne non reconnue' }
  const clean = code.replace(/\D/g, '')
  if (clean.length !== 6) return { success: false as const, error: 'Le code fait 6 chiffres' }
  const appt = await prisma.appointment.findFirst({ where: { code: clean, organizationId: device.organizationId! }, select: { id: true } })
  if (!appt) return { success: false as const, error: 'Code inconnu : vérifiez le SMS de confirmation, ou adressez-vous à l’accueil.' }
  try {
    const res = await checkIn(appt.id, device.organizationId!)
    const ticket = await prisma.ticket.findUnique({ where: { id: res.ticketId }, select: { id: true, displayNum: true, createdAt: true, queueId: true, priorityScore: true, queuedAt: true, service: { select: { name: true, avgDurationMin: true } } } })
    if (!ticket) return { success: false as const, error: 'Ticket introuvable' }
    const ahead = await prisma.ticket.count({
      where: { queueId: ticket.queueId, status: 'WAITING', OR: [{ priorityScore: { gt: ticket.priorityScore } }, { priorityScore: ticket.priorityScore, queuedAt: { lt: ticket.queuedAt } }] }
    })
    return {
      success: true as const,
      ticket: { id: ticket.id, displayNum: ticket.displayNum, serviceName: ticket.service.name, ahead, waitMin: ahead * ticket.service.avgDurationMin, issuedAt: ticket.createdAt.toISOString() }
    }
  } catch (error) {
    if (error instanceof AppointmentError) return { success: false as const, error: error.message }
    console.error('kioskCheckIn error:', error)
    return { success: false as const, error: 'Une erreur est survenue' }
  }
}
