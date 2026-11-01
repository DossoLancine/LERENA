import Link from 'next/link'
import { getInvoices } from '@/server/actions/billing-admin'
import { Card, EmptyState } from '@/components/ui'
import { InvoiceBadge, PageHeader } from '@/components/billing/badges'
import { fcfa } from '@/lib/billing-labels'
import { cn } from '@/lib/cn'
import { Receipt } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FILTERS = [['', 'Toutes'], ['SENT', 'À payer'], ['OVERDUE', 'En retard'], ['PAID', 'Payées'], ['VOID', 'Annulées']] as const
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

export default async function AdminInvoicesPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const status = searchParams.status ?? ''
  const invoices = await getInvoices({ status: status || undefined, q: searchParams.q })
  if (!invoices) return null
  const total = invoices.reduce((s, i) => s + (i.status === 'VOID' ? 0 : i.total - i.paid), 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Factures" subtitle={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}${status !== 'PAID' && total ? ` · ${fcfa(total)} restant à encaisser` : ''}`} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-line px-5 py-3">
          {FILTERS.map(([k, label]) => (
            <Link key={k} href={k ? `/admin/invoices?status=${k}` : '/admin/invoices'} aria-current={status === k ? 'page' : undefined}
              className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-all', status === k ? 'bg-ink text-white' : 'bg-gray-100 text-ink-muted hover:bg-gray-200')}>{label}</Link>
          ))}
          <form className="ml-auto" action="/admin/invoices">
            {status && <input type="hidden" name="status" value={status} />}
            <label className="sr-only" htmlFor="inv-q">Rechercher</label>
            <input id="inv-q" name="q" type="search" defaultValue={searchParams.q} placeholder="Numéro ou client" className="w-48 rounded-control border border-gray-200 px-3 py-1.5 text-sm" />
          </form>
        </div>
        {invoices.length === 0 ? <EmptyState icon={<Receipt size={40} />} title="Aucune facture" description="Les factures d’abonnement se créent depuis la fiche client, ou seules 7 jours avant chaque échéance." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Numéro</th><th scope="col" className="px-3 py-2.5 font-semibold">Client</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Émise</th><th scope="col" className="px-3 py-2.5 font-semibold">Échéance</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">État</th><th scope="col" className="px-5 py-2.5 text-right font-semibold">Montant TTC</th>
              </tr></thead>
              <tbody className="divide-y divide-surface-line">
                {invoices.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5"><Link href={`/admin/invoices/${i.id}`} className="font-mono font-semibold text-ink hover:text-brand">{i.number}</Link><span className="block text-xs text-ink-subtle">{i.kind === 'SUBSCRIPTION' ? 'Abonnement' : 'Commande'}</span></td>
                    <td className="px-3 py-2.5"><Link href={`/admin/clients/${i.org.id}`} className="text-ink hover:text-brand">{i.org.name}</Link></td>
                    <td className="px-3 py-2.5 text-ink-muted">{date(i.issuedAt)}</td>
                    <td className={cn('px-3 py-2.5', i.overdue ? 'font-semibold text-danger' : 'text-ink-muted')}>{date(i.dueAt)}</td>
                    <td className="px-3 py-2.5"><InvoiceBadge status={i.status} overdue={i.overdue} /></td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fcfa(i.total)}{i.paid > 0 && i.status !== 'PAID' && <span className="block text-xs font-normal text-success-ink">{fcfa(i.paid)} reçus</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
