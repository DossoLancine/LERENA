import type { ReactNode } from 'react'
import { SettingsProvider } from './_components/settings-provider'
import { SettingsShell } from './_components/settings-shell'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <SettingsShell>{children}</SettingsShell>
    </SettingsProvider>
  )
}
