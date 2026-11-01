import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Les liens d'installation contiennent un secret : jamais transmis à un autre site, jamais indexés
export const metadata: Metadata = {
  title: 'Installer un appareil — Lerena',
  referrer: 'no-referrer',
  robots: { index: false, follow: false }
}

export default function SetupLinkLayout({ children }: { children: ReactNode }) {
  return children
}
