import { redirect } from 'next/navigation'

// /dashboard/settings ouvre la première section
export default function SettingsIndexPage() {
  redirect('/dashboard/settings/site')
}
