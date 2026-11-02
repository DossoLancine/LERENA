import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getOrganizations } from '@/server/actions/orgs'
import { getActiveTicketSummary } from '@/server/actions/tickets'
import { getActiveSectors } from '@/lib/platform'
import { HomeScreen } from '@/components/home/home-screen'
import { topSectors } from '@/components/home/top-sectors'

export default async function HomePage() {
  const user = await getSessionUser()
  if (!user) redirect('/auth/login?callbackUrl=/home')

  const [activeTicket, orgs, sectors] = await Promise.all([getActiveTicketSummary(), getOrganizations(), getActiveSectors()])
  return <HomeScreen firstName={user.name?.split(' ')[0] ?? null} activeTicket={activeTicket} initialOrgs={orgs} sectors={topSectors(orgs, sectors)} />
}
