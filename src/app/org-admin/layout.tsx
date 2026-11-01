import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getNetworkContext } from '@/lib/session'
import { AdminShell } from '@/components/admin/admin-shell'
import { TwoFactorNotice } from '@/components/account/two-factor-notice'

// Espace réseau : administrateur (ORG_ADMIN) ou lecteur (VIEWER) d'un groupe d'établissements
export default async function OrgAdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getNetworkContext()
  if (!ctx) redirect('/pro/login?callbackUrl=/org-admin')
  const network = await prisma.network.findUnique({ where: { id: ctx.networkId }, select: { name: true } })

  return (
    <AdminShell
      eyebrow="Espace réseau"
      title={network?.name ?? 'Mon réseau'}
      badge={ctx.canEdit ? undefined : 'Lecture seule'}
      groups={[{ items: [
        { href: '/org-admin', label: 'Sites', icon: 'Building2', exact: true },
        { href: '/org-admin/report', label: 'Rapport mensuel', icon: 'FileText' }
      ] }]}
    >
      <TwoFactorNotice userId={ctx.userId} />
      {children}
    </AdminShell>
  )
}
