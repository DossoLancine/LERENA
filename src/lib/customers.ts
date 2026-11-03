import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/phone'
import { tagRepeatedNoShows } from '@/lib/followups'

// Fichier visiteurs (CRM) : chaque ticket et rendez-vous est rattaché à la fiche du visiteur dans
// l'établissement, reconnue par son compte Lerena ou son numéro. Module serveur uniquement.
// Un échec ici ne bloque jamais l'émission d'un ticket ou la réservation : la reprise le rattrapera.

// Noms posés par défaut par les canaux sans saisie : jamais repris comme nom de visiteur
const PLACEHOLDER_NAMES = new Set(['accueil', 'borne', 'client', 'rendez-vous', 'visiteur', 'invité'])

const cleanName = (name: string | null | undefined) => {
  const n = name?.trim().slice(0, 60)
  return n && !PLACEHOLDER_NAMES.has(n.toLowerCase()) ? n : null
}

export interface CustomerIdentity {
  orgId: string
  userId?: string | null
  phone?: string | null
  name?: string | null
}

/** Fiche du visiteur dans l'établissement : retrouvée par compte puis par numéro, sinon créée. Null sans compte ni numéro. */
export async function findOrCreateCustomer({ orgId, userId, phone: rawPhone, name: rawName }: CustomerIdentity) {
  let phone = normalizePhone(rawPhone)
  let name = cleanName(rawName)
  if (userId && (!phone || !name)) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, name: true } })
    phone ??= normalizePhone(user?.phone)
    name ??= cleanName(user?.name)
  }
  if (!userId && !phone) return null

  const found = await prisma.customer.findMany({
    where: { organizationId: orgId, OR: [...(userId ? [{ userId }] : []), ...(phone ? [{ phone }] : [])] },
    select: { id: true, userId: true, phone: true, name: true }
  })
  const existing = found.find(c => userId && c.userId === userId) ?? found[0]
  if (existing) {
    // Compléter la fiche sans écraser ce que l'établissement a saisi
    const data: Prisma.CustomerUpdateInput = {}
    if (!existing.name && name) data.name = name
    if (userId && !existing.userId && !found.some(c => c.userId === userId)) data.user = { connect: { id: userId } }
    if (phone && !existing.phone && !found.some(c => c.phone === phone)) data.phone = phone
    if (Object.keys(data).length) await prisma.customer.update({ where: { id: existing.id }, data }).catch(() => null)
    return existing.id
  }

  try {
    const created = await prisma.customer.create({ data: { organizationId: orgId, userId: userId ?? null, phone, name }, select: { id: true } })
    return created.id
  } catch (error) {
    // Deux passages simultanés : l'autre a créé la fiche
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const again = await prisma.customer.findFirst({ where: { organizationId: orgId, OR: [...(userId ? [{ userId }] : []), ...(phone ? [{ phone }] : [])] }, select: { id: true } })
      return again?.id ?? null
    }
    throw error
  }
}

/** Recalcule passages, absences, notes et dates des fiches à partir des tickets et rendez-vous (une seule requête). */
export async function refreshCustomerStats(customerIds: string[]) {
  const ids = Array.from(new Set(customerIds.filter(Boolean)))
  if (ids.length === 0) return
  await prisma.$executeRaw`
    UPDATE "Customer" c SET
      "visits" = COALESCE(t.visits, 0),
      "noShows" = COALESCE(t.absent, 0) + COALESCE(a.noshow, 0),
      "ratingAvg" = t.avg,
      "lastRating" = t.last_rating,
      "lastVisitAt" = t.last_visit,
      "firstSeenAt" = LEAST(c."createdAt", t.first_visit, a.first_appt),
      "lastSeenAt" = GREATEST(t.last_visit, a.last_appt, CASE WHEN t.last_visit IS NULL AND a.last_appt IS NULL THEN c."createdAt" END)
    FROM "Customer" c2
    LEFT JOIN (
      SELECT "customerId",
        count(*) FILTER (WHERE status NOT IN ('CANCELLED', 'ABSENT'))::int AS visits,
        count(*) FILTER (WHERE status = 'ABSENT')::int AS absent,
        avg("npsScore")::float8 AS avg,
        (array_agg("npsScore" ORDER BY "completedAt" DESC NULLS LAST) FILTER (WHERE "npsScore" IS NOT NULL))[1] AS last_rating,
        max("createdAt") FILTER (WHERE status <> 'CANCELLED') AS last_visit,
        min("createdAt") AS first_visit
      FROM "Ticket" WHERE "customerId" = ANY(${ids}) GROUP BY 1
    ) t ON t."customerId" = c2.id
    LEFT JOIN (
      SELECT "customerId",
        count(*) FILTER (WHERE status = 'NO_SHOW')::int AS noshow,
        min("createdAt") AS first_appt,
        max("scheduledDate") FILTER (WHERE status <> 'CANCELLED') AS last_appt
      FROM "Appointment" WHERE "customerId" = ANY(${ids}) GROUP BY 1
    ) a ON a."customerId" = c2.id
    WHERE c.id = c2.id AND c.id = ANY(${ids})`
}

/** Rattache un ticket à la fiche de son visiteur et met la fiche à jour. */
export async function attachTicketToCustomer(ticketId: string, identity: CustomerIdentity) {
  try {
    const customerId = await findOrCreateCustomer(identity)
    if (!customerId) return null
    await prisma.ticket.update({ where: { id: ticketId }, data: { customerId } })
    await refreshCustomerStats([customerId])
    return customerId
  } catch (error) {
    console.error('CRM ticket link error:', error)
    return null
  }
}

/** Rattache un rendez-vous à la fiche de son visiteur et met la fiche à jour. */
export async function attachAppointmentToCustomer(appointmentId: string, identity: CustomerIdentity) {
  try {
    const customerId = await findOrCreateCustomer(identity)
    if (!customerId) return null
    await prisma.appointment.update({ where: { id: appointmentId }, data: { customerId } })
    await refreshCustomerStats([customerId])
    return customerId
  } catch (error) {
    console.error('CRM appointment link error:', error)
    return null
  }
}

/** Met à jour les fiches liées à des tickets (statut changé, note donnée). */
export async function refreshCustomersOfTickets(ticketIds: string[]) {
  try {
    const rows = await prisma.ticket.findMany({ where: { id: { in: ticketIds }, customerId: { not: null } }, select: { customerId: true } })
    await refreshCustomerStats(rows.map(r => r.customerId!))
    await tagRepeatedNoShows(rows.map(r => r.customerId!))
  } catch (error) {
    console.error('CRM refresh error:', error)
  }
}

/** Met à jour les fiches liées à des rendez-vous (absence, annulation). */
export async function refreshCustomersOfAppointments(appointmentIds: string[]) {
  try {
    const rows = await prisma.appointment.findMany({ where: { id: { in: appointmentIds }, customerId: { not: null } }, select: { customerId: true } })
    await refreshCustomerStats(rows.map(r => r.customerId!))
    await tagRepeatedNoShows(rows.map(r => r.customerId!))
  } catch (error) {
    console.error('CRM refresh error:', error)
  }
}

const BACKFILL_BATCH = 1500

/**
 * Reprise de l'historique : rattache aux fiches les tickets et rendez-vous encore nominatifs qui n'en ont pas
 * (passages antérieurs au CRM, ou rattachement manqué). Lancée à l'ouverture de la page Visiteurs, par lots.
 */
export async function backfillCustomers(orgId: string) {
  const identified = { OR: [{ userId: { not: null } }, { guestPhone: { not: null } }] }
  const [tickets, appointments] = await Promise.all([
    prisma.ticket.findMany({
      where: { customerId: null, queue: { branch: { organizationId: orgId } }, ...identified },
      orderBy: { createdAt: 'asc' }, take: BACKFILL_BATCH,
      select: { id: true, userId: true, guestName: true, guestPhone: true, user: { select: { name: true, phone: true } } }
    }),
    prisma.appointment.findMany({
      where: { customerId: null, organizationId: orgId, ...identified },
      orderBy: { createdAt: 'asc' }, take: BACKFILL_BATCH,
      select: { id: true, userId: true, guestName: true, guestPhone: true, user: { select: { name: true, phone: true } } }
    })
  ])
  if (tickets.length === 0 && appointments.length === 0) return { linked: 0, more: false }

  // Regroupement par visiteur : compte d'abord, sinon numéro
  type Row = (typeof tickets)[number]
  const groups = new Map<string, { identity: CustomerIdentity; tickets: string[]; appointments: string[] }>()
  const add = (row: Row, kind: 'tickets' | 'appointments') => {
    const phone = normalizePhone(row.guestPhone ?? row.user?.phone)
    const key = row.userId ? `u:${row.userId}` : phone ? `p:${phone}` : null
    if (!key) return
    const g = groups.get(key) ?? { identity: { orgId, userId: row.userId, phone, name: null }, tickets: [], appointments: [] }
    g.identity.name = cleanName(row.guestName) ?? cleanName(row.user?.name) ?? g.identity.name
    g[kind].push(row.id)
    groups.set(key, g)
  }
  tickets.forEach(t => add(t, 'tickets'))
  appointments.forEach(a => add(a, 'appointments'))

  const touched: string[] = []
  for (const g of Array.from(groups.values())) {
    const customerId = await findOrCreateCustomer(g.identity).catch(() => null)
    if (!customerId) continue
    touched.push(customerId)
    await Promise.all([
      g.tickets.length ? prisma.ticket.updateMany({ where: { id: { in: g.tickets } }, data: { customerId } }) : null,
      g.appointments.length ? prisma.appointment.updateMany({ where: { id: { in: g.appointments } }, data: { customerId } }) : null
    ])
  }
  await refreshCustomerStats(touched)
  return { linked: tickets.length + appointments.length, more: tickets.length === BACKFILL_BATCH || appointments.length === BACKFILL_BATCH }
}

/** Suppression d'un compte visiteur : ses fiches disparaissent dans tous les établissements. */
export async function deleteCustomersOfUser(userId: string, phone: string | null) {
  const p = normalizePhone(phone)
  return prisma.customer.deleteMany({ where: { OR: [{ userId }, ...(p ? [{ phone: p }] : [])] } })
}
