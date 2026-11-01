import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Le lien de gestion contient un secret : jamais transmis à un autre site, jamais indexé
export const metadata: Metadata = {
  title: 'Mon rendez-vous — ATTENDS',
  referrer: 'no-referrer',
  robots: { index: false, follow: false }
}

export default function RdvLayout({ children }: { children: ReactNode }) {
  return children
}
