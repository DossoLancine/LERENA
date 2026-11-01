import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSuperAdmin } from '@/lib/session'
import { AdminShell } from '@/components/admin/admin-shell'
import { TwoFactorNotice } from '@/components/account/two-factor-notice'

// Administration de la plateforme : réservée à l'équipe Lerena
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getSuperAdmin()
  if (!admin) redirect('/pro/login?callbackUrl=/admin')
  return (
    <AdminShell
      eyebrow="Administration de la plateforme"
      title="Lerena"
      groups={[
        { label: 'Clients', items: [
          { href: '/admin', label: 'Établissements', icon: 'Building2', exact: true },
          { href: '/admin/networks', label: 'Réseaux', icon: 'Network' }
        ] },
        { label: 'Plateforme', items: [
          { href: '/admin/sectors', label: 'Secteurs', icon: 'Tags' },
          { href: '/admin/messages', label: 'Messages', icon: 'MessageSquare' },
          { href: '/admin/health', label: 'Santé', icon: 'Gauge' },
          { href: '/admin/audit', label: 'Journal', icon: 'ClipboardList' },
          { href: '/admin/settings', label: 'Réglages', icon: 'Settings' }
        ] }
      ]}
    >
      <TwoFactorNotice userId={admin.id} />
      {children}
    </AdminShell>
  )
}
