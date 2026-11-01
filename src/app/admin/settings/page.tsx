import { getAdminSettings } from '@/server/actions/admin'
import { SettingsView } from '../_components/settings-view'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const config = await getAdminSettings()
  if (!config) return null
  return (
    <SettingsView initial={{
      appName: config.appName,
      defaultCountryCode: config.defaultCountryCode,
      defaultCity: config.defaultCity ?? '',
      defaultLat: config.defaultLat?.toString() ?? '',
      defaultLng: config.defaultLng?.toString() ?? '',
      demoMode: config.demoMode
    }} />
  )
}
