import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getOrganizations } from '@/server/actions/orgs'
import { getUserTickets } from '@/server/actions/tickets'
import { ACTIVE_TICKET_STATUSES } from '@/lib/constants'
import { getActiveSectors } from '@/lib/platform'
import HomeView from './_components/home-view'

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login?callbackUrl=/home')

  const [tickets, orgs, sectors] = await Promise.all([getUserTickets(), getOrganizations(), getActiveSectors()])
  // Raccourcis : les secteurs qui comptent le plus d'établissements
  const countBySector = new Map<string, number>()
  for (const o of orgs) if (o.sectorSlug) countBySector.set(o.sectorSlug, (countBySector.get(o.sectorSlug) ?? 0) + 1)
  const topSectors = sectors.filter(s => countBySector.has(s.slug)).sort((a, b) => (countBySector.get(b.slug) ?? 0) - (countBySector.get(a.slug) ?? 0))
  const activeTicket = tickets.find(t => (ACTIVE_TICKET_STATUSES as string[]).includes(t.status)) ?? null

  return <HomeView userName={user.name} activeTicket={activeTicket} initialOrgs={orgs} sectors={topSectors} />
}
