import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { AdminShell } from '@/components/admin/admin-shell'
import { TwoFactorNotice } from '@/components/account/two-factor-notice'

// Console de la startup Lerena : réservée à l'équipe (SUPER_ADMIN)
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getSuperAdmin()
  if (!admin) redirect('/pro/login?callbackUrl=/admin')
  const overdue = await prisma.invoice.count({ where: { status: 'SENT', dueAt: { lt: new Date() } } })
  return (
    <AdminShell
      eyebrow="Console Lerena"
      title="Lerena"
      groups={[
        { label: 'Pilotage', items: [
          { href: '/admin', label: 'Vue d’ensemble', icon: 'LayoutDashboard', exact: true }
        ] },
        { label: 'Clients', items: [
          { href: '/admin/clients', label: 'Établissements', icon: 'Building2' },
          { href: '/admin/networks', label: 'Réseaux', icon: 'Network' },
          { href: '/admin/users', label: 'Utilisateurs', icon: 'Users' }
        ] },
        { label: 'Revenus', items: [
          { href: '/admin/invoices', label: 'Factures', icon: 'Receipt', count: overdue },
          { href: '/admin/plans', label: 'Forfaits', icon: 'CreditCard' },
          { href: '/admin/catalog', label: 'Catalogue', icon: 'Package' },
          { href: '/admin/billing-settings', label: 'Facturation', icon: 'Wallet' }
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
