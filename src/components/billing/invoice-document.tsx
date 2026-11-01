'use client'

import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'
import { InvoiceBadge } from '@/components/billing/badges'
import { fcfa } from '@/lib/billing-labels'
import type { getInvoiceDocument } from '@/server/actions/billing'

type Doc = NonNullable<Awaited<ReturnType<typeof getInvoiceDocument>>>
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—')

/** Facture lisible à l'écran et imprimable (ou « Enregistrer en PDF » depuis l'impression du navigateur). */
export function InvoiceDocument({ doc, actions }: { doc: Doc; actions?: ReactNode }) {
  const { invoice: inv, seller } = doc
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
  const overdue = inv.status === 'SENT' && new Date(inv.dueAt) < new Date()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2"><InvoiceBadge status={inv.status} overdue={overdue} /></div>
        <div className="flex flex-wrap gap-2">
          {actions}
          <Button variant="secondary" size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>Imprimer / PDF</Button>
        </div>
      </div>

      <article className="animate-rise-in rounded-card border border-surface-line bg-white p-6 shadow-card print:border-0 print:p-0 print:shadow-none sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-surface-line pb-6">
          <div>
            <p className="text-2xl font-black tracking-tight text-brand">{seller.name}</p>
            <div className="mt-2 space-y-0.5 text-xs text-ink-muted">
              {seller.address && <p>{seller.address}</p>}
              {[seller.phone, seller.email].filter(Boolean).length > 0 && <p>{[seller.phone, seller.email].filter(Boolean).join(' · ')}</p>}
              {(seller.rccm || seller.taxId) && <p>{[seller.rccm && `RCCM ${seller.rccm}`, seller.taxId && `NCC ${seller.taxId}`].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">Facture</p>
            <p className="font-mono text-lg font-bold text-ink">{inv.number}</p>
            <p className="mt-1 text-xs text-ink-muted">Émise le {date(inv.issuedAt)}</p>
            <p className="text-xs text-ink-muted">Échéance : {date(inv.dueAt)}</p>
          </div>
        </header>

        <section className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">Client</p>
            <p className="mt-1 font-semibold text-ink">{inv.organization.name}</p>
            <div className="text-sm text-ink-muted">
              {[inv.organization.address, inv.organization.city].filter(Boolean).join(', ') && <p>{[inv.organization.address, inv.organization.city].filter(Boolean).join(', ')}</p>}
              {[inv.organization.phone, inv.organization.email].filter(Boolean).length > 0 && <p>{[inv.organization.phone, inv.organization.email].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
          {inv.periodStart && (
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle">Période</p>
              <p className="mt-1 text-sm text-ink">du {date(inv.periodStart)} au {date(inv.periodEnd)}</p>
            </div>
          )}
        </section>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="py-2 font-semibold">Désignation</th>
                <th scope="col" className="py-2 text-right font-semibold">Qté</th>
                <th scope="col" className="py-2 text-right font-semibold">Prix unitaire HT</th>
                <th scope="col" className="py-2 text-right font-semibold">Montant HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {inv.lines.map((l, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-3 text-ink">{l.label}</td>
                  <td className="py-2.5 text-right tabular-nums">{l.qty}</td>
                  <td className="py-2.5 text-right tabular-nums">{fcfa(l.unitPrice)}</td>
                  <td className="py-2.5 text-right font-medium tabular-nums">{fcfa(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-4 max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">Total HT</span><span className="tabular-nums">{fcfa(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-ink-muted">TVA ({inv.taxRate} %)</span><span className="tabular-nums">{fcfa(inv.tax)}</span></div>
          <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-bold"><span>Total TTC</span><span className="tabular-nums">{fcfa(inv.total)}</span></div>
          {paid > 0 && <div className="flex justify-between text-success-ink"><span>Déjà réglé</span><span className="tabular-nums">− {fcfa(paid)}</span></div>}
          {paid > 0 && inv.status !== 'PAID' && <div className="flex justify-between font-semibold"><span>Reste à payer</span><span className="tabular-nums">{fcfa(inv.total - paid)}</span></div>}
        </div>

        {inv.payments.length > 0 && (
          <section className="mt-6 rounded-xl bg-success-soft/60 p-4 text-sm">
            <p className="font-semibold text-success-ink">Paiements reçus</p>
            <ul className="mt-1 space-y-0.5 text-ink-muted">
              {inv.payments.map(p => <li key={p.id}>{date(p.receivedAt)} · {p.method}{p.reference ? ` · réf. ${p.reference}` : ''} · <span className="font-medium text-ink">{fcfa(p.amount)}</span></li>)}
            </ul>
          </section>
        )}

        {inv.status !== 'PAID' && inv.status !== 'VOID' && seller.paymentInstructions && (
          <section className="mt-6 rounded-xl border border-dashed border-brand/40 bg-brand-50/40 p-4 text-sm">
            <p className="font-semibold text-ink">Comment payer</p>
            <p className="mt-1 whitespace-pre-line text-ink-muted">{seller.paymentInstructions}</p>
            <p className="mt-2 text-xs text-ink-subtle">Indiquez le numéro <span className="font-mono font-semibold">{inv.number}</span> en référence du paiement.</p>
          </section>
        )}
        {inv.notes && <p className="mt-6 whitespace-pre-line text-xs text-ink-muted">{inv.notes}</p>}
        <footer className="mt-10 border-t border-surface-line pt-4 text-center text-[11px] text-ink-subtle">{seller.name} — merci de votre confiance.</footer>
      </article>
    </div>
  )
}
