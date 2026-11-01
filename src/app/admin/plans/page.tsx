import { getPlans } from '@/server/actions/billing-admin'
import { PlansView } from './plans-view'

export const dynamic = 'force-dynamic'

export default async function AdminPlansPage() {
  const data = await getPlans()
  if (!data) return null
  return <PlansView data={data} />
}
