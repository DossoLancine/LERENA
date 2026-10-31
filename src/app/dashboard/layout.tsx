import type { ReactNode } from 'react'
import { DashboardProvider } from './_components/dashboard-context'
import { DashboardShell } from './_components/dashboard-shell'

// Chaque onglet du tableau de bord est une vraie page (lien direct, retour arrière, rechargement)
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
