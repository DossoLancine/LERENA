import { prisma } from '@/lib/prisma'

// Créneaux de rendez-vous calculés à partir des horaires réels de l'agence et de la durée du service.
// Heures en UTC : la Côte d'Ivoire est à UTC+0 toute l'année.

const DAYS_AHEAD = 14
const MIN_SLOT_MIN = 10

// Horaires par défaut quand l'agence n'en a pas saisi : lun-ven 8h-17h, sam 8h-12h, dim fermé
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
    where: { id: serviceId, isActive: true, branch: { organizationId: orgId } },
    select: {
      id: true, avgDurationMin: true, branchId: true,
      branch: { select: { businessHours: true, organization: { select: { bookingMode: true } } } }
    }
  })
}

function hoursFor(service: NonNullable<Awaited<ReturnType<typeof loadService>>>, dayOfWeek: number): [string, string] | null {
  const custom = service.branch.businessHours
  if (custom.length === 0) return DEFAULT_HOURS[dayOfWeek]
  const h = custom.find(b => b.dayOfWeek === dayOfWeek)
  return h && !h.isClosed ? [h.openTime, h.closeTime] : null
}

/** Jours ouverts à la réservation sur les deux prochaines semaines (à partir de demain). */
export async function bookableDays(orgId: string, serviceId: string) {
  const service = await loadService(orgId, serviceId)
  if (!service || service.branch.organization.bookingMode === 'QUEUE_ONLY') return []
  const days: string[] = []
  for (let i = 1; i <= DAYS_AHEAD; i++) {
    const d = new Date(Date.now() + i * 86400_000)
    if (hoursFor(service, d.getUTCDay())) days.push(isoDay(d))
  }
  return days
}

/** Créneaux d'une journée, chacun marqué libre ou pris. */
export async function slotsForDay(orgId: string, serviceId: string, day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
  const service = await loadService(orgId, serviceId)
  if (!service || service.branch.organization.bookingMode === 'QUEUE_ONLY') return []

  const date = new Date(`${day}T00:00:00Z`)
  const hours = hoursFor(service, date.getUTCDay())
  if (!hours) return []

  const step = Math.max(MIN_SLOT_MIN, service.avgDurationMin)
  const taken = await prisma.appointment.findMany({
    where: { serviceId: service.id, status: 'CONFIRMED', scheduledDate: { gte: date, lt: new Date(date.getTime() + 86400_000) } },
    select: { scheduledDate: true }
  })
  const takenTimes = new Set(taken.map(a => a.scheduledDate.toISOString().slice(11, 16)))

  const slots: { time: string; available: boolean }[] = []
  for (let m = toMin(hours[0]); m + step <= toMin(hours[1]); m += step) {
    const time = toHHMM(m)
    const start = new Date(`${day}T${time}:00Z`)
    slots.push({ time, available: start.getTime() > Date.now() + 30 * 60_000 && !takenTimes.has(time) })
  }
  return slots
}

/** Vérifie qu'un créneau demandé existe et est encore libre. */
export async function isSlotAvailable(orgId: string, serviceId: string, when: Date) {
  const day = isoDay(when)
  const time = when.toISOString().slice(11, 16)
  const slots = await slotsForDay(orgId, serviceId, day)
  return slots.some(s => s.time === time && s.available)
}
