import { getAdminOrganizations } from '@/server/actions/admin'
import { OrganizationsView } from './_components/organizations-view'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const data = await getAdminOrganizations()
  if (!data) return null
  return <OrganizationsView data={data} />
}
