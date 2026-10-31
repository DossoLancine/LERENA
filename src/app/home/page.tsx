import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getOrganizations } from '@/server/actions/orgs'
import { getUserTickets } from '@/server/actions/tickets'
import { ACTIVE_TICKET_STATUSES } from '@/lib/constants'
import HomeView from './_components/home-view'

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login?callbackUrl=/home')

  const [tickets, orgs] = await Promise.all([getUserTickets(), getOrganizations()])
  const activeTicket = tickets.find(t => (ACTIVE_TICKET_STATUSES as string[]).includes(t.status)) ?? null

  return <HomeView userName={user.name} activeTicket={activeTicket} initialOrgs={orgs} />
}
