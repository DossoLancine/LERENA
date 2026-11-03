'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getManagerContext, getReceptionContext, getSessionUser } from '@/lib/session'
import { APPOINTMENT_STATUSES } from '@/lib/constants'
import { bookableDays, isSlotAvailable, slotsForDay } from '@/lib/slots'
import { AppointmentError, bookAppointment, checkIn, runAppointmentJobs } from '@/lib/appointments'
import { hashSecret, isPlausibleSecret } from '@/lib/secrets'
import { normalizePhone } from '@/lib/phone'
import { refreshCustomersOfAppointments } from '@/lib/customers'
import { smsEnabled } from '@/lib/sms'
import { verifyOtp } from '@/lib/otp'
import { branchFilter } from '@/lib/sites'
import { audit } from '@/lib/audit'
import { notifyOrg } from '@/lib/realtime'
import { HOUR, RATE_LIMITED, rateLimitAll, requestIp } from '@/lib/rate-limit'

const fail = (error: unknown) => ({ success: false as const, error: error instanceof AppointmentError ? error.message : 'Une erreur est survenue' })

// ---- Réservation ----

/** Jours réservables pour un service. */
export async function getBookingDays(orgId: string, serviceId: string) {
  return bookableDays(orgId, serviceId)
}

/** Créneaux d'une journée pour un service, libres ou complets. */
export async function getAvailableSlots(orgId: string, serviceId: string, day: string) {
  return slotsForDay(orgId, serviceId, day)
}

/** Réservation par un client connecté. */
export async function createAppointment(orgId: string, serviceId: string, scheduledDate: Date) {
  const user = await getSessionUser()
  if (!user) return { success: false as const, error: 'Connectez-vous pour réserver' }
  try {
    const me = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } })
    const res = await bookAppointment({ orgId, serviceId, scheduledDate, source: 'APP', userId: user.id, email: me?.email })
    revalidatePath('/tickets')
    return { success: true as const, appointment: res }
  } catch (error) {
    return fail(error)
  }
}

/** Réservation sans compte : prénom, téléphone (code SMS si le service SMS est branché). */
export async function createGuestAppointment(input: { orgId: string; serviceId: string; scheduledDate: Date; name: string; phone: string; code?: string }) {
  const name = input.name?.trim().slice(0, 60)
  const phone = normalizePhone(input.phone)
  if (!name || name.length < 2) return { success: false as const, error: 'Indiquez votre prénom' }
  if (!phone) return { success: false as const, error: 'Numéro de téléphone invalide' }
  const addr = requestIp()
  if (!(await rateLimitAll([{ key: `grdv:p:${phone}`, max: 5, windowMs: HOUR }, { key: addr && `grdv:ip:${addr}`, max: 20, windowMs: HOUR }]))) {
    return { success: false as const, error: RATE_LIMITED }
  }
  if (smsEnabled() && (!input.code || !(await verifyOtp(phone, 'GUEST_TICKET', input.code)))) {
    return { success: false as const, error: 'CODE_INVALID' }
  }
  try {
    const res = await bookAppointment({ orgId: input.orgId, serviceId: input.serviceId, scheduledDate: input.scheduledDate, source: 'GUEST', guestName: name, guestPhone: phone })
    return { success: true as const, appointment: res }
  } catch (error) {
    return fail(error)
  }
}

/** Réservation prise par l'accueil (au téléphone) : les règles de quota ne s'appliquent pas. */
export async function createAppointmentByReception(input: { serviceId: string; scheduledDate: Date; name: string; phone: string }) {
  const ctx = (await getReceptionContext()) ?? (await getManagerContext())
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const phone = normalizePhone(input.phone)
  if (!phone) return { success: false as const, error: 'Numéro de téléphone invalide' }
  try {
    const res = await bookAppointment({ orgId: ctx.orgId, serviceId: input.serviceId, scheduledDate: input.scheduledDate, source: 'RECEPTION', guestName: input.name?.trim().slice(0, 60) || 'Visiteur', guestPhone: phone })
    return { success: true as const, appointment: res }
  } catch (error) {
    return fail(error)
  }
}

// ---- Gestion par le visiteur (lien reçu par SMS / e-mail) ----

async function byToken(token: string) {
  if (!isPlausibleSecret(token)) return null
  return prisma.appointment.findUnique({
    where: { manageTokenHash: hashSecret(token) },
    include: {
      service: { select: { id: true, name: true } },
      branch: { select: { name: true, address: true, city: true } },
      organization: { select: { id: true, name: true, apptCancelHours: true } }
    }
  })
}

const canModify = (a: { status: string; scheduledDate: Date; organization: { apptCancelHours: number } }) =>
  a.status === 'CONFIRMED' && a.scheduledDate.getTime() - Date.now() > a.organization.apptCancelHours * 3600_000

export async function getAppointmentByToken(token: string) {
  const a = await byToken(token)
  if (!a) return null
  return {
    orgId: a.organization.id, orgName: a.organization.name, serviceId: a.service?.id ?? null, serviceName: a.service?.name ?? '',
    siteName: a.branch.name, address: [a.branch.address, a.branch.city].filter(Boolean).join(', '),
    scheduledDate: a.scheduledDate.toISOString(), status: a.status, code: a.code,
    canModify: canModify(a), cancelHours: a.organization.apptCancelHours, checkedIn: !!a.checkedInAt
  }
}

export async function cancelAppointmentByToken(token: string) {
  const a = await byToken(token)
  if (!a) return { success: false, error: 'Rendez-vous introuvable' }
  if (!canModify(a)) return { success: false, error: `L’annulation en ligne n’est plus possible (moins de ${a.organization.apptCancelHours} h avant). Contactez l’établissement.` }
  await prisma.appointment.update({ where: { id: a.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } })
  await notifyOrg(a.organizationId)
  return { success: true }
}

export async function rescheduleAppointmentByToken(token: string, scheduledDate: Date) {
  const a = await byToken(token)
  if (!a || !a.serviceId) return { success: false, error: 'Rendez-vous introuvable' }
  if (!canModify(a)) return { success: false, error: `Le report en ligne n’est plus possible (moins de ${a.organization.apptCancelHours} h avant).` }
  const date = new Date(scheduledDate)
  if (!(await isSlotAvailable(a.organizationId, a.serviceId, date))) return { success: false, error: 'Ce créneau n’est plus disponible' }
  await prisma.appointment.update({ where: { id: a.id }, data: { scheduledDate: date, reminderDayAt: null, reminderHourAt: null } })
  await notifyOrg(a.organizationId)
  return { success: true }
}

// ---- Arrivée sur place ----

/** L'accueil signale l'arrivée (par la liste du jour ou le code à 6 chiffres). */
export async function checkInAppointment(input: { id?: string; code?: string }) {
  const ctx = (await getReceptionContext()) ?? (await getManagerContext())
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  const appt = input.id
    ? await prisma.appointment.findFirst({ where: { id: input.id, organizationId: ctx.orgId }, select: { id: true } })
    : input.code ? await prisma.appointment.findFirst({ where: { code: input.code.replace(/\D/g, ''), organizationId: ctx.orgId }, select: { id: true } }) : null
  if (!appt) return { success: false as const, error: 'Rendez-vous introuvable' }
  try {
    const res = await checkIn(appt.id, ctx.orgId)
    await audit({ action: 'APPOINTMENT_CHECKED_IN', targetType: 'Appointment', targetId: appt.id, organizationId: ctx.orgId })
    return { success: true as const, ...res }
  } catch (error) {
    return fail(error)
  }
}

/** Rendez-vous du jour (site actif) pour l'accueil et le responsable. */
export async function getTodayAppointments() {
  const ctx = (await getReceptionContext()) ?? (await getManagerContext())
  if (!ctx) return []
  await runAppointmentJobs().catch(() => null)
  const start = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  const rows = await prisma.appointment.findMany({
    where: { organizationId: ctx.orgId, branch: await branchFilter(ctx.orgId), scheduledDate: { gte: start, lt: new Date(start.getTime() + 86400_000) }, status: { in: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] } },
    orderBy: { scheduledDate: 'asc' },
    include: { service: { select: { name: true } }, user: { select: { name: true, phone: true } } }
  })
  const now = Date.now()
  return rows.map(a => ({
    id: a.id, time: a.scheduledDate.toISOString().slice(11, 16), name: a.guestName || a.user?.name || 'Visiteur',
    phone: a.guestPhone || a.user?.phone || null, service: a.service?.name ?? '', code: a.code,
    state: a.checkedInAt ? 'ARRIVED' as const : a.status === 'NO_SHOW' ? 'NO_SHOW' as const : a.scheduledDate.getTime() < now - 5 * 60_000 ? 'LATE' as const : 'EXPECTED' as const
  }))
}

// ---- Tableau de bord ----

// orgId est conservé pour compatibilité ; seuls les rendez-vous du manager connecté sont lus
export async function getAppointments(_orgId?: string) {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return { success: false, error: 'Unauthorized' }

    const appointments = await prisma.appointment.findMany({
      where: { organizationId: ctx.orgId, branch: await branchFilter(ctx.orgId) },
      include: {
        user: { select: { name: true, phone: true } },
        service: { select: { name: true } }
      },
      orderBy: { scheduledDate: 'asc' }
    })
    return { success: true, appointments }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to fetch appointments' }
  }
}

export async function updateAppointmentStatus(id: string, status: string) {
  try {
    const ctx = await getManagerContext()
    if (!ctx) return { success: false, error: 'Unauthorized' }
    if (!(APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
      return { success: false, error: 'Statut invalide' }
    }
    const res = await prisma.appointment.updateMany({
      where: { id, organizationId: ctx.orgId },
      data: { status, ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) }
    })
    if (res.count === 0) return { success: false, error: 'Rendez-vous introuvable' }
    await refreshCustomersOfAppointments([id])
    revalidatePath(`/dashboard`)
    return { success: true }
  } catch (error) {
    console.error(error)
    return { success: false, error: 'Failed to update status' }
  }
}

/** Indicateurs des 30 derniers jours : remplissage, absences, annulations. */
export async function getAppointmentStats() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const since = new Date(Date.now() - 30 * 86400_000)
  const rows = await prisma.appointment.groupBy({
    by: ['status'],
    where: { organizationId: ctx.orgId, branch: await branchFilter(ctx.orgId), scheduledDate: { gte: since, lt: new Date() } },
    _count: { _all: true }
  })
  const n = (s: string) => rows.find(r => r.status === s)?._count._all ?? 0
  const total = rows.reduce((t, r) => t + r._count._all, 0)
  const arrived = await prisma.appointment.count({ where: { organizationId: ctx.orgId, branch: await branchFilter(ctx.orgId), scheduledDate: { gte: since, lt: new Date() }, checkedInAt: { not: null } } })
  return { total, arrived, noShow: n('NO_SHOW'), cancelled: n('CANCELLED'), noShowRate: total ? Math.round((n('NO_SHOW') / total) * 100) : 0 }
}

// ---- Règles et jours de fermeture ----

export async function getAppointmentSettings() {
  const ctx = await getManagerContext()
  if (!ctx) return null
  const [org, services, closures] = await Promise.all([
    prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { bookingMode: true, apptMaxActive: true, apptCancelHours: true, apptNoShowGraceMin: true, apptNoShowBlock: true } }),
    prisma.service.findMany({ where: { branch: await branchFilter(ctx.orgId), isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, avgDurationMin: true, apptCapacity: true, apptLeadMin: true, apptHorizonDays: true } }),
    prisma.closureDay.findMany({ where: { organizationId: ctx.orgId, date: { gte: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) } }, orderBy: { date: 'asc' }, include: { organization: false } })
  ])
  const sites = await prisma.branch.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, name: true } })
  return {
    org, services, sites,
    closures: closures.map(c => ({ id: c.id, date: c.date.toISOString().slice(0, 10), label: c.label, siteName: c.branchId ? sites.find(s => s.id === c.branchId)?.name ?? null : null }))
  }
}

const int = (v: unknown, min: number, max: number, def: number) => Math.min(max, Math.max(min, Math.round(Number(v)) || def))

export async function updateAppointmentRules(data: { bookingMode: string; apptMaxActive: number; apptCancelHours: number; apptNoShowGraceMin: number; apptNoShowBlock: number }) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  const mode = ['QUEUE_ONLY', 'APPOINTMENT_ONLY', 'HYBRID'].includes(data.bookingMode) ? data.bookingMode : 'HYBRID'
  await prisma.organization.update({
    where: { id: ctx.orgId },
    data: {
      bookingMode: mode,
      apptMaxActive: int(data.apptMaxActive, 1, 10, 2),
      apptCancelHours: int(data.apptCancelHours, 0, 72, 2),
      apptNoShowGraceMin: int(data.apptNoShowGraceMin, 5, 120, 15),
      apptNoShowBlock: int(data.apptNoShowBlock, 0, 10, 0)
    }
  })
  revalidatePath(`/org/${ctx.orgId}`)
  return { success: true }
}

export async function updateServiceBooking(serviceId: string, data: { apptCapacity: number; apptLeadMin: number; apptHorizonDays: number }) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  const res = await prisma.service.updateMany({
    where: { id: serviceId, branch: { organizationId: ctx.orgId } },
    data: { apptCapacity: int(data.apptCapacity, 1, 50, 1), apptLeadMin: int(data.apptLeadMin, 0, 2880, 60), apptHorizonDays: int(data.apptHorizonDays, 1, 90, 14) }
  })
  return { success: res.count > 0 }
}

export async function addClosureDay(data: { date: string; label?: string; siteId?: string | null }) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false, error: 'Non autorisé' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { success: false, error: 'Date invalide' }
  if (data.siteId && !(await prisma.branch.findFirst({ where: { id: data.siteId, organizationId: ctx.orgId } }))) return { success: false, error: 'Site introuvable' }
  await prisma.closureDay.create({ data: { organizationId: ctx.orgId, branchId: data.siteId || null, date: new Date(`${data.date}T00:00:00Z`), label: data.label?.trim().slice(0, 60) || null } })
  return { success: true }
}

export async function removeClosureDay(id: string) {
  const ctx = await getManagerContext()
  if (!ctx) return { success: false }
  const res = await prisma.closureDay.deleteMany({ where: { id, organizationId: ctx.orgId } })
  return { success: res.count > 0 }
}

/** Réservations faites par les visiteurs depuis une date (pastille « nouveaux » de l'Agenda). */
export async function getNewAppointmentsCount(sinceIso: string) {
  const ctx = await getManagerContext()
  if (!ctx) return 0
  const since = new Date(sinceIso)
  if (Number.isNaN(since.getTime())) return 0
  return prisma.appointment.count({ where: { organizationId: ctx.orgId, createdAt: { gt: since }, status: 'CONFIRMED', source: { not: 'RECEPTION' } } })
}
