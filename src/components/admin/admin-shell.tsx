'use client'

import type { ReactNode } from 'react'
import { SidebarShell, type SidebarGroup } from '@/components/layout/sidebar-shell'

export type { SidebarGroup }

/** Barre latérale commune aux espaces réseau (/org-admin) et plateforme (/admin). */
export function AdminShell({ eyebrow, title, badge, groups, children }: {
  eyebrow: string
  title: string
  badge?: string
  groups: SidebarGroup[]
  children: ReactNode
}) {
  return <SidebarShell eyebrow={eyebrow} title={title} badge={badge} groups={groups}>{children}</SidebarShell>
}
