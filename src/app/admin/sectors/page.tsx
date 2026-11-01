import { getAdminSectors } from '@/server/actions/admin'
import { SectorsView } from '../_components/sectors-view'

export const dynamic = 'force-dynamic'

export default async function AdminSectorsPage() {
  const data = await getAdminSectors()
  if (!data) return null
  return <SectorsView data={data} />
}
