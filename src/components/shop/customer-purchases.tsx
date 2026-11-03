'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { getCustomerPurchases } from '@/server/actions/shop'
import { ORDER_STATUS, priceLabel, SOLD_STATUSES, type OrderStatus } from '@/lib/shop'

/** Fiche visiteur : ses achats à la boutique (rien d'affiché s'il n'a jamais commandé). */
export function CustomerPurchases({ customerId }: { customerId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getCustomerPurchases>>>([])
  useEffect(() => { getCustomerPurchases(customerId).then(setRows).catch(() => null) }, [customerId])
  if (!rows.length) return null
  const spent = rows.filter(r => (SOLD_STATUSES as string[]).includes(r.status)).reduce((s, r) => s + r.total, 0)
  return (
    <section className="rounded-card border border-surface-line bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-surface-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-ink"><ShoppingBag size={16} className="text-brand" /> Achats</h2>
        <span className="text-xs text-ink-muted">{spent.toLocaleString('fr-FR')} FCFA payés</span>
      </header>
      <ul className="divide-y divide-surface-line">
        {rows.map(r => (
          <li key={r.id} className="px-5 py-3 text-sm">
            <p className="flex justify-between gap-3"><span className="font-semibold text-ink">{r.items}</span><span className="shrink-0 tabular-nums text-ink">{priceLabel(r.total)}</span></p>
            <p className="text-xs text-ink-muted">{new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} · n° {r.number} · {ORDER_STATUS[r.status as OrderStatus]?.label ?? r.status} · {r.site}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
