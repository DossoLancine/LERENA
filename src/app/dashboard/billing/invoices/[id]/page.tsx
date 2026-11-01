import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getInvoiceDocument } from '@/server/actions/billing'
import { InvoiceDocument } from '@/components/billing/invoice-document'

export const dynamic = 'force-dynamic'

export default async function DashboardInvoicePage({ params }: { params: { id: string } }) {
  const doc = await getInvoiceDocument(params.id)
  if (!doc) notFound()
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/dashboard/billing" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink print:hidden"><ArrowLeft size={15} /> Abonnement</Link>
      <InvoiceDocument doc={doc} />
    </div>
  )
}
