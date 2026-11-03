import Link from 'next/link'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { OrdersBoard } from '@/components/shop/orders-board'

// Commandes de la boutique pour l'accueil et la caisse : à confirmer, à encaisser, à remettre.
export default function ReceptionOrdersPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-surface-line bg-white px-5 py-3 shadow-card">
        <div>
          <Link href="/reception" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink"><ArrowLeft size={13} /> Accueil</Link>
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><ShoppingBag size={18} className="text-brand" /> Commandes de la boutique</h1>
        </div>
        <p className="text-xs text-ink-muted">Mise à jour automatique toutes les 15 secondes.</p>
      </header>
      <OrdersBoard visitorsPath="/reception/visitors" />
    </main>
  )
}
