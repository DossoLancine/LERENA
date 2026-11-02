import { getLeads } from '@/server/actions/leads'
import { LeadsView } from './leads-view'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  const leads = await getLeads()
  if (!leads) return null
  return <LeadsView leads={leads} />
}
