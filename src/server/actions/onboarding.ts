'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'

// Assistant de démarrage : chaque étape se coche toute seule d'après ce qui est réellement configuré.

export async function getOnboarding() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const orgId = ctx.orgId
  const [org, hours, services, counters, team, devices, served] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { address: true, phone: true, lat: true, lng: true, logo: true } }),
    prisma.businessHour.count({ where: { branch: { organizationId: orgId } } }),
    prisma.service.count({ where: { branch: { organizationId: orgId }, isActive: true } }),
    prisma.counter.count({ where: { branch: { organizationId: orgId }, NOT: { serviceIds: { isEmpty: true } } } }),
    prisma.organizationMember.count({ where: { organizationId: orgId, role: { in: ['AGENT', 'RECEPTION'] } } }),
    prisma.device.count({ where: { organizationId: orgId } }),
    prisma.ticket.count({ where: { queue: { branch: { organizationId: orgId } }, status: 'COMPLETED' } })
  ])
  if (!org) return null
  const steps = [
    { id: 'profile', title: 'Coordonnées', text: 'Adresse et téléphone visibles par vos visiteurs', href: '/dashboard/settings/site', done: !!org.address && !!org.phone },
    { id: 'location', title: 'Position et horaires', text: 'Sur la carte, avec vos heures d’ouverture', href: '/dashboard/settings/location', done: org.lat != null && org.lng != null && hours > 0 },
    { id: 'services', title: 'Services', text: 'Ce que vos visiteurs viennent faire', href: '/dashboard/services', done: services > 0 },
    { id: 'counters', title: 'Guichets', text: 'Chaque guichet et les services qu’il traite', href: '/dashboard/counters', done: counters > 0 },
    { id: 'team', title: 'Équipe', text: 'Vos agents de guichet et d’accueil', href: '/dashboard/settings/team', done: team > 0 },
    { id: 'devices', title: 'Écran et borne', text: 'Installer la TV de la salle d’attente ou une borne', href: '/dashboard/settings/devices', done: devices > 0 },
    { id: 'logo', title: 'Votre logo', text: 'Sur la TV, la borne et les tickets', href: '/dashboard/settings/site', done: !!org.logo },
    { id: 'first', title: 'Premier visiteur servi', text: 'Ouvrez l’écran Guichet et appelez le premier ticket', href: '/agent', done: served > 0 }
  ]
  return { orgId, steps, done: steps.filter(s => s.done).length }
}
