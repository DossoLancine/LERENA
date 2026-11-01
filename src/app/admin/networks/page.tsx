import { getAdminNetworks } from '@/server/actions/admin'
import { NetworksView } from '../_components/networks-view'

export const dynamic = 'force-dynamic'

export default async function AdminNetworksPage() {
  const networks = await getAdminNetworks()
  if (!networks) return null
  return <NetworksView networks={networks} />
}
