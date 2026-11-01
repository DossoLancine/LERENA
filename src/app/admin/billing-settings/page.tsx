import { getBillingSettings } from '@/server/actions/billing-admin'
import { BillingSettingsView } from './billing-settings-view'

export const dynamic = 'force-dynamic'

export default async function AdminBillingSettingsPage() {
  const data = await getBillingSettings()
  if (!data) return null
  return <BillingSettingsView data={data} />
}
