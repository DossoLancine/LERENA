import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { orderNo, priceLabel, SHOP_PAY_METHODS } from '@/lib/shop'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'Reçu', robots: { index: false } }
export const dynamic = 'force-dynamic'

// Reçu numéroté d'une commande payée, à imprimer ou à garder sur le téléphone. Le lien fait office d'accès.
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const o = await prisma.shopOrder.findUnique({
    where: { id: params.id },
    select: {
      number: true, status: true, total: true, paidAt: true, paymentMethod: true, closedAt: true, closedReason: true,
      organization: { select: { name: true } }, branch: { select: { name: true, address: true, city: true } },
      items: { select: { name: true, qty: true, unitPrice: true, amount: true } }
    }
  })
  if (!o || !o.paidAt || !['PAID', 'DELIVERED', 'REFUNDED'].includes(o.status)) notFound()
  const date = (d: Date) => d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-8 print:bg-white print:p-0">
      <article className="mx-auto max-w-sm rounded-card bg-white p-6 shadow-card print:max-w-none print:shadow-none">
        <header className="border-b border-dashed border-surface-line pb-4 text-center">
          <h1 className="font-display text-xl font-bold text-ink">{o.organization.name}</h1>
          <p className="text-xs text-ink-muted">{[o.branch.name, o.branch.address, o.branch.city].filter(Boolean).join(' · ')}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">Reçu n° {orderNo(o.number)}</p>
          <p className="text-xs text-ink-subtle">{date(o.paidAt)} (heure d’Abidjan)</p>
        </header>
        <table className="mt-4 w-full text-sm">
          <thead className="sr-only"><tr><th>Article</th><th>Montant</th></tr></thead>
          <tbody>
            {o.items.map((i, k) => (
              <tr key={k} className="align-top">
                <td className="py-1.5 pr-3 text-ink">{i.name}{i.qty > 1 && <span className="block text-xs text-ink-muted">{i.qty} × {priceLabel(i.unitPrice)}</span>}</td>
                <td className="py-1.5 text-right tabular-nums text-ink">{priceLabel(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex justify-between border-t border-dashed border-surface-line pt-3 text-base font-bold text-ink"><span>Total</span><span className="tabular-nums">{priceLabel(o.total)}</span></p>
        <p className="mt-1 text-sm text-ink-muted">Réglé : {o.paymentMethod ? SHOP_PAY_METHODS[o.paymentMethod as keyof typeof SHOP_PAY_METHODS] ?? o.paymentMethod : '—'}</p>
        {o.status === 'REFUNDED' && <p className="mt-3 rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">Remboursé{o.closedAt ? ` le ${date(o.closedAt)}` : ''}{o.closedReason ? ` : ${o.closedReason}` : ''}.</p>}
        <p className="mt-5 text-center text-[11px] text-ink-subtle">Reçu émis par {o.organization.name} via Lerena.</p>
        <PrintButton />
      </article>
    </main>
  )
}
