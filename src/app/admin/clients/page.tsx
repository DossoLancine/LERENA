import { getAdminOrganizations } from '@/server/actions/admin'
import { getClients } from '@/server/actions/billing-admin'
import { OrganizationsView } from '../_components/organizations-view'

export const dynamic = 'force-dynamic'

export default async function AdminClientsPage() {
  const [data, billing] = await Promise.all([getAdminOrganizations(), getClients()])
  if (!data || !billing) return null
  return <OrganizationsView data={data} billing={billing} />
}
