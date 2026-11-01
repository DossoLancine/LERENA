import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getInvoiceDocument } from '@/server/actions/billing'
import { InvoiceAdminActions } from './invoice-admin-actions'

export const dynamic = 'force-dynamic'

export default async function AdminInvoicePage({ params }: { params: { id: string } }) {
  const doc = await getInvoiceDocument(params.id)
  if (!doc || !doc.isAdmin) notFound()
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={`/admin/clients/${doc.invoice.organization.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink print:hidden"><ArrowLeft size={15} /> {doc.invoice.organization.name}</Link>
      <InvoiceAdminActions doc={doc} />
    </div>
  )
}
