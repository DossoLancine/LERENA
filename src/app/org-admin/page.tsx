import { getNetworkOverview } from '@/server/actions/network'
import { SitesView } from './_components/sites-view'

export const dynamic = 'force-dynamic'

export default async function OrgAdminPage() {
  const overview = await getNetworkOverview()
  if (!overview) return null
  return <SitesView initial={overview} />
}
