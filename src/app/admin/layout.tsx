import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSuperAdmin } from '@/lib/session'
import { AdminShell } from '@/components/admin/admin-shell'
import { TwoFactorNotice } from '@/components/account/two-factor-notice'

// Administration de la plateforme : réservée à l'équipe ATTENDS
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getSuperAdmin()
  if (!admin) redirect('/pro/login?callbackUrl=/admin')
  return (
    <AdminShell
      eyebrow="Administration de la plateforme"
      title="ATTENDS"
      tabs={[
        { href: '/admin', label: 'Établissements', exact: true },
        { href: '/admin/networks', label: 'Réseaux' },
        { href: '/admin/sectors', label: 'Secteurs' },
        { href: '/admin/settings', label: 'Réglages' },
        { href: '/admin/health', label: 'Santé' },
        { href: '/admin/messages', label: 'Messages' },
        { href: '/admin/audit', label: 'Journal' }
      ]}
    >
      <TwoFactorNotice userId={admin.id} />
      {children}
    </AdminShell>
  )
}
