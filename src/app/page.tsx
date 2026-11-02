import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/session'
import { getOrganizations } from '@/server/actions/orgs'
import { getActiveSectors } from '@/lib/platform'
import { homeForRole } from '@/lib/constants'
import { LegalLinks } from '@/components/legal/legal-links'
import { HomeScreen } from '@/components/home/home-screen'
import { topSectors } from '@/components/home/top-sectors'

// Accueil public : la même expérience que l'application, utilisable tout de suite sans compte
export default async function LandingPage() {
  const user = await getSessionUser()
  if (user) redirect(homeForRole(user.role))

  const [orgs, sectors] = await Promise.all([getOrganizations(), getActiveSectors()])
  return (
    <>
      <HomeScreen firstName={null} activeTicket={null} initialOrgs={orgs} sectors={topSectors(orgs, sectors)} />
      <LegalLinks className="-mt-20 pb-10" />
    </>
  )
}
