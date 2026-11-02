import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getPlatformConfig } from '@/lib/platform'
import { LEGAL_DOCS, LEGAL_UPDATED_AT, legalDoc, type LegalContext } from '../content'
import { cn } from '@/lib/cn'

export const revalidate = 3600

export function generateStaticParams() {
  return LEGAL_DOCS.map(d => ({ doc: d.slug }))
}

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const doc = legalDoc(params.doc)
  return { title: doc ? `${doc.title} — Lerena` : 'Lerena' }
}

const missing = (label: string) => `[${label} à compléter]`

/** Documents légaux publics, remplis avec les coordonnées saisies dans la console. */
export default async function LegalPage({ params }: { params: { doc: string } }) {
  const doc = legalDoc(params.doc)
  if (!doc) notFound()
  const config = await getPlatformConfig()
  const ctx: LegalContext = {
    company: config.companyName || missing('raison sociale'),
    address: config.companyAddress || missing('adresse'),
    rccm: config.companyRccm || missing('RCCM'),
    taxId: config.companyTaxId || missing('NCC'),
    email: config.companyEmail || missing('e-mail'),
    phone: config.companyPhone || missing('téléphone'),
    dpo: config.dpoEmail || config.companyEmail || missing('contact données personnelles'),
    artci: config.artciReference || 'en cours',
    retentionMonths: config.retentionMonths
  }

  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-8 print:bg-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink print:hidden"><ArrowLeft size={15} /> Lerena</Link>
        <nav aria-label="Documents légaux" className="hide-scrollbar mb-6 flex gap-1.5 overflow-x-auto print:hidden">
          {LEGAL_DOCS.map(d => (
            <Link key={d.slug} href={`/legal/${d.slug}`} aria-current={d.slug === doc.slug ? 'page' : undefined}
              className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', d.slug === doc.slug ? 'bg-ink text-white' : 'bg-white text-ink-muted ring-1 ring-surface-line hover:text-ink')}>{d.short}</Link>
          ))}
        </nav>
        <article className="animate-rise-in rounded-card border border-surface-line bg-white p-6 shadow-card sm:p-10 print:border-0 print:shadow-none">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-ink-muted">{doc.intro}</p>
          <p className="mt-1 text-xs text-ink-subtle">Mise à jour : {LEGAL_UPDATED_AT}</p>
          <div className="mt-8 space-y-7">
            {doc.sections(ctx).map(s => (
              <section key={s.title}>
                <h2 className="text-base font-semibold text-ink">{s.title}</h2>
                {s.paragraphs.map((p, i) => <p key={i} className="mt-2 text-sm leading-relaxed text-ink-muted">{p}</p>)}
                {s.list && <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-muted">{s.list.map((l, i) => <li key={i}>{l}</li>)}</ul>}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}
