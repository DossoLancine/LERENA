import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

/** Cadre commun des écrans de compte (mot de passe, sécurité) : simple, centré, rassurant. */
export function AccountCard({ title, subtitle, back = '/', children }: { title: string; subtitle?: string; back?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-surface-sunken px-4 py-8">
      <div className="w-full max-w-md">
        <Link href={back} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft size={16} aria-hidden="true" /> Retour
        </Link>
        <div className="animate-rise-in rounded-card border border-surface-line bg-white p-6 shadow-card">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><ShieldCheck size={24} aria-hidden="true" /></span>
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  )
}
