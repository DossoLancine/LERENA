import { prisma } from '@/lib/prisma'

// Créneaux de rendez-vous calculés à partir des horaires réels du site et des règles du service :
// durée du créneau, capacité (plusieurs personnes en même temps), délai minimum, horizon, jours de fermeture.
// Heures en UTC : la Côte d'Ivoire est à UTC+0 toute l'année.

const MIN_SLOT_MIN = 10

// Horaires par défaut quand le site n'en a pas saisi : lun-ven 8h-17h, sam 8h-12h, dim fermé
const DEFAULT_HOURS: Record<number, [string, string] | null> = {
  0: null, 1: ['08:00', '17:00'], 2: ['08:00', '17:00'], 3: ['08:00', '17:00'],
  4: ['08:00', '17:00'], 5: ['08:00', '17:00'], 6: ['08:00', '12:00'],
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)

async function loadService(orgId: string, serviceId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, isActive: true, branch: { organizationId: orgId, isActive: true } },
    select: {
      id: true, avgDurationMin: true, branchId: true, apptCapacity: true, apptLeadMin: true, apptHorizonDays: true,
      branch: { select: { businessHours: true, organization: { select: { bookingMode: true } } } }
    }
  })
}
type LoadedService = NonNullable<Awaited<ReturnType<typeof loadService>>>

function hoursFor(service: LoadedService, dayOfWeek: number): [string, string] | null {
  const custom = service.branch.businessHours
  if (custom.length === 0) return DEFAULT_HOURS[dayOfWeek]
  const h = custom.find(b => b.dayOfWeek === dayOfWeek)
  return h && !h.isClosed ? [h.openTime, h.closeTime] : null
}

/** Jours de fermeture de l'établissement ou du site, entre deux dates. */
async function closedDays(orgId: string, branchId: string, from: Date, to: Date) {
  const rows = await prisma.closureDay.findMany({
    where: { organizationId: orgId, OR: [{ branchId: null }, { branchId }], date: { gte: from, lt: to } },
    select: { date: true }
  })
  return new Set(rows.map(r => isoDay(r.date)))
}

const bookable = (service: LoadedService) => service.branch.organization.bookingMode !== 'QUEUE_ONLY'

/** Jours ouverts à la réservation (à partir d'aujourd'hui, jusqu'à l'horizon du service). */
export async function bookableDays(orgId: string, serviceId: string) {
  const service = await loadService(orgId, serviceId)
  if (!service || !bookable(service)) return []
  const horizon = Math.min(90, Math.max(1, service.apptHorizonDays))
  const start = new Date(`${isoDay(new Date())}T00:00:00Z`)
  const closed = await closedDays(orgId, service.branchId, start, new Date(start.getTime() + (horizon + 1) * 86400_000))
  const days: string[] = []
  for (let i = 0; i <= horizon; i++) {
    const d = new Date(start.getTime() + i * 86400_000)
    const key = isoDay(d)
    if (closed.has(key) || !hoursFor(service, d.getUTCDay())) continue
    // Aujourd'hui seulement s'il reste au moins un créneau libre
    if (i === 0 && !(await slotsForDay(orgId, serviceId, key)).some(s => s.available)) continue
    days.push(key)
  }
  return days
}

/** Créneaux d'une journée, chacun marqué libre ou complet, avec les places restantes. */
export async function slotsForDay(orgId: string, serviceId: string, day: string, opts: { horizonDays?: number } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
  const service = await loadService(orgId, serviceId)
  if (!service || !bookable(service)) return []

  const date = new Date(`${day}T00:00:00Z`)
  const horizonEnd = Date.now() + ((opts.horizonDays ?? Math.min(90, service.apptHorizonDays)) + 1) * 86400_000
  if (date.getTime() > horizonEnd) return []
  if ((await closedDays(orgId, service.branchId, date, new Date(date.getTime() + 86400_000))).size > 0) return []
  const hours = hoursFor(service, date.getUTCDay())
  if (!hours) return []

  const step = Math.max(MIN_SLOT_MIN, service.avgDurationMin)
  const capacity = Math.max(1, service.apptCapacity)
  const earliest = Date.now() + Math.max(0, service.apptLeadMin) * 60_000
  const taken = await prisma.appointment.groupBy({
    by: ['scheduledDate'],
    where: { serviceId: service.id, status: 'CONFIRMED', scheduledDate: { gte: date, lt: new Date(date.getTime() + 86400_000) } },
    _count: { _all: true }
  })
  const takenAt = new Map(taken.map(t => [t.scheduledDate.toISOString().slice(11, 16), t._count._all]))

  const slots: { time: string; available: boolean; remaining: number }[] = []
  for (let m = toMin(hours[0]); m + step <= toMin(hours[1]); m += step) {
    const time = toHHMM(m)
    const start = new Date(`${day}T${time}:00Z`)
    const remaining = Math.max(0, capacity - (takenAt.get(time) ?? 0))
    slots.push({ time, available: start.getTime() >= earliest && remaining > 0, remaining })
  }
  return slots
}

/** Vérifie qu'un créneau demandé existe et a encore une place. */
export async function isSlotAvailable(orgId: string, serviceId: string, when: Date, opts: { horizonDays?: number } = {}) {
  const day = isoDay(when)
  const time = when.toISOString().slice(11, 16)
  const slots = await slotsForDay(orgId, serviceId, day, opts)
  return slots.some(s => s.time === time && s.available)
}
