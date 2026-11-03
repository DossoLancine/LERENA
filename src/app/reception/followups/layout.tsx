import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Suivis « À faire » vus depuis l'accueil : même écran que le tableau de bord, avec retour au comptoir
export default function ReceptionFollowUpsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="sticky top-0 z-20 border-b border-surface-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/reception" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-semibold text-ink-muted hover:bg-gray-100 hover:text-ink">
            <ArrowLeft size={16} /> Accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  )
}
