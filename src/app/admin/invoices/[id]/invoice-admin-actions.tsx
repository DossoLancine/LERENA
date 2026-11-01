'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Coins, Send } from 'lucide-react'
import { addPayment, resendInvoice, voidInvoice } from '@/server/actions/billing-admin'
import type { getInvoiceDocument } from '@/server/actions/billing'
import { Button, Dialog, SelectInput, TextInput, useToast } from '@/components/ui'
import { InvoiceDocument } from '@/components/billing/invoice-document'
import { PAYMENT_METHODS } from '@/lib/billing-labels'

type Doc = NonNullable<Awaited<ReturnType<typeof getInvoiceDocument>>>

/** Facture côté Lerena : encaisser, renvoyer par e-mail, annuler. */
export function InvoiceAdminActions({ doc }: { doc: Doc }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const inv = doc.invoice
  const remaining = inv.total - inv.payments.reduce((s, p) => s + p.amount, 0)

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    setBusy(key)
    const res = await fn()
    setBusy(null)
    if (!res.success) return toast(res.error ?? 'Opération impossible', 'error')
    toast(ok)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <InvoiceDocument doc={doc} actions={inv.status === 'SENT' && <>
        <Button size="sm" icon={<Coins size={15} />} onClick={() => setOpen(true)}>Encaisser</Button>
        <Button size="sm" variant="secondary" icon={<Send size={15} />} loading={busy === 'send'} onClick={() => run('send', () => resendInvoice(inv.id), 'Facture renvoyée par e-mail')}>Renvoyer</Button>
        <Button size="sm" variant="ghost" icon={<Ban size={15} />} className="text-danger" loading={busy === 'void'} onClick={() => confirm('Annuler cette facture ?') && run('void', () => voidInvoice(inv.id), 'Facture annulée')}>Annuler</Button>
      </>} />
      <Dialog open={open} onClose={() => setOpen(false)} title={`Encaisser ${inv.number}`}>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); run('pay', () => addPayment(inv.id, { amount: String(f.get('amount')), method: String(f.get('method')), reference: String(f.get('reference') ?? '') }), 'Paiement enregistré') }}>
          <TextInput name="amount" label="Montant reçu (FCFA)" type="number" min={1} required defaultValue={remaining} />
          <SelectInput name="method" label="Moyen de paiement" defaultValue="ORANGE_MONEY">
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </SelectInput>
          <TextInput name="reference" label="Référence de la transaction" />
          <Button type="submit" fullWidth loading={busy === 'pay'}>Enregistrer le paiement</Button>
        </form>
      </Dialog>
    </>
  )
}
