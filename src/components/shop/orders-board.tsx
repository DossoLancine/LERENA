'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Ban, Check, ChevronDown, CircleDollarSign, PackageCheck, Receipt, RotateCcw, ShoppingBag } from 'lucide-react'
import { getOrderHistory, getOrders, getTicketOrders, setOrderStatus, type OrderBucket, type StaffOrder } from '@/server/actions/shop'
import { Badge, Button, Dialog, TextArea, useToast } from '@/components/ui'
import { usePolling } from '@/hooks/use-polling'
import { cn } from '@/lib/cn'
import { deliveredLabel, ORDER_STATUS, priceLabel, SHOP_PAY_METHODS, type OrderStatus, type ShopPayMethod } from '@/lib/shop'

const TABS: { id: OrderBucket; label: string; empty: string }[] = [
  { id: 'todo', label: 'À confirmer', empty: 'Aucune nouvelle commande.' },
  { id: 'pay', label: 'À encaisser', empty: 'Rien à encaisser.' },
  { id: 'deliver', label: 'À remettre', empty: 'Rien à remettre.' },
  { id: 'done', label: 'Terminées', empty: 'Aucune commande terminée ces 7 derniers jours.' }
]
const REASONS = { CANCELLED: ['Le visiteur ne veut plus', 'Produit épuisé', 'Erreur de commande', 'Visiteur parti'], REFUNDED: ['Produit défectueux', 'Service non réalisé', 'Erreur d’encaissement'] }
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }

/** Actions d'une commande (confirmer, encaisser, remettre, annuler, rembourser), avec les fenêtres de paiement et de motif. */
function useOrderActions(onDone: () => void) {
  const toast = useToast()
  const [pay, setPay] = useState<StaffOrder | null>(null)
  const [close, setClose] = useState<{ order: StaffOrder; to: 'CANCELLED' | 'REFUNDED' } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (o: StaffOrder, to: OrderStatus, opts: { method?: string; reason?: string } = {}) => {
    setBusy(o.id)
    const res = await setOrderStatus(o.id, to, opts)
    setBusy(null)
    if (!res.success) { toast(res.error, 'error'); onDone(); return false }
    toast(`Commande ${o.number} : ${to === 'DELIVERED' ? deliveredLabel(o.items.map(i => i.type)).toLowerCase() : ORDER_STATUS[to].label.toLowerCase()}`, 'success')
    onDone()
    return true
  }
  const buttons = (o: StaffOrder, small = false) => {
    const size = small ? 'sm' as const : 'sm' as const
    const b: JSX.Element[] = []
    if (o.status === 'REQUESTED') b.push(<Button key="c" size={size} variant="secondary" icon={<Check size={14} />} loading={busy === o.id} onClick={() => run(o, 'CONFIRMED')}>Confirmer</Button>)
    if (o.status === 'REQUESTED' || o.status === 'CONFIRMED') {
      b.push(<Button key="p" size={size} icon={<CircleDollarSign size={14} />} onClick={() => setPay(o)}>Payée</Button>)
      b.push(<Button key="x" size={size} variant="ghost" icon={<Ban size={14} />} onClick={() => setClose({ order: o, to: 'CANCELLED' })}>Annuler</Button>)
    }
    if (o.status === 'PAID') b.push(<Button key="d" size={size} icon={<PackageCheck size={14} />} loading={busy === o.id} onClick={() => run(o, 'DELIVERED')}>{deliveredLabel(o.items.map(i => i.type))}</Button>)
    if (o.status === 'PAID' || o.status === 'DELIVERED') {
      b.push(<Link key="r" href={`/shop/receipt/${o.id}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-ink-muted hover:bg-gray-100"><Receipt size={14} /> Reçu</Link>)
      b.push(<Button key="rf" size={size} variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setClose({ order: o, to: 'REFUNDED' })}>Rembourser</Button>)
    }
    return b
  }
  const dialogs = (
    <>
      {pay && <PayDialog order={pay} onClose={() => setPay(null)} onPay={async m => { if (await run(pay, 'PAID', { method: m })) setPay(null) }} busy={busy === pay.id} />}
      {close && <ReasonDialog order={close.order} to={close.to} onClose={() => setClose(null)} onConfirm={async r => { if (await run(close.order, close.to, { reason: r })) setClose(null) }} busy={busy === close.order.id} />}
    </>
  )
  return { buttons, dialogs }
}

function PayDialog({ order, onClose, onPay, busy }: { order: StaffOrder; onClose: () => void; onPay: (m: ShopPayMethod) => void; busy: boolean }) {
  const [method, setMethod] = useState<ShopPayMethod>('CASH')
  return (
    <Dialog open onClose={onClose} title={`Encaisser ${priceLabel(order.total)}`}>
      <p className="text-sm text-ink-muted">Commande {order.number} · {order.items.map(i => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', ')}</p>
      <fieldset className="mt-4">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Mode de paiement</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(SHOP_PAY_METHODS) as ShopPayMethod[]).map(m => (
            <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className={cn('rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold', method === m ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink')}>{SHOP_PAY_METHODS[m]}</button>
          ))}
        </div>
      </fieldset>
      {order.items.some(i => i.type === 'DIGITAL') && <p className="mt-3 rounded-xl bg-info-soft p-3 text-xs text-info-ink">Le lien ou le code du produit numérique part au visiteur dès l’encaissement.</p>}
      <Button className="mt-5" fullWidth loading={busy} onClick={() => onPay(method)}>Encaissé : {SHOP_PAY_METHODS[method]}</Button>
    </Dialog>
  )
}

function ReasonDialog({ order, to, onClose, onConfirm, busy }: { order: StaffOrder; to: 'CANCELLED' | 'REFUNDED'; onClose: () => void; onConfirm: (r: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('')
  return (
    <Dialog open onClose={onClose} title={to === 'CANCELLED' ? `Annuler la commande ${order.number}` : `Rembourser ${priceLabel(order.total)}`}>
      <p className="text-sm text-ink-muted">{to === 'CANCELLED' ? 'Le stock réservé revient en vente. Le visiteur voit l’annulation sur son ticket.' : 'Rendez l’argent au visiteur, puis indiquez le motif : il est inscrit au journal.'}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {REASONS[to].map(r => <button key={r} onClick={() => setReason(r)} className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1', reason === r ? 'bg-ink text-white ring-ink' : 'text-ink-muted ring-gray-200')}>{r}</button>)}
      </div>
      <div className="mt-3"><TextArea label="Motif" rows={2} value={reason} onChange={e => setReason(e.target.value)} maxLength={300} /></div>
      <Button className="mt-4" fullWidth variant={to === 'CANCELLED' ? 'danger' : 'primary'} loading={busy} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>{to === 'CANCELLED' ? 'Annuler la commande' : 'Confirmer le remboursement'}</Button>
    </Dialog>
  )
}

function OrderCard({ o, buttons, visitorsPath }: { o: StaffOrder; buttons: JSX.Element[]; visitorsPath: string }) {
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getOrderHistory>> | null>(null)
  const st = ORDER_STATUS[o.status as OrderStatus]
  return (
    <li className="animate-rise-in rounded-card border border-surface-line bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">Commande {o.number} <span className="font-normal text-ink-subtle">· {ago(o.createdAt)}</span></p>
          <p className="text-xs text-ink-muted">
            {o.ticket ? <>Ticket <b className="text-ink">{o.ticket.displayNum}</b> · </> : o.appointment ? <>Rendez-vous du {new Date(o.appointment.scheduledDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · </> : null}
            {o.customerId ? <Link href={`${visitorsPath}/${o.customerId}`} className="hover:underline">{o.who ?? 'Visiteur'}</Link> : o.who ?? 'Visiteur'} · {o.site}
          </p>
        </div>
        <Badge tone={st?.tone === 'info' ? 'info' : st?.tone === 'success' ? 'success' : st?.tone === 'warning' ? 'warning' : 'neutral'}>{o.status === 'DELIVERED' ? deliveredLabel(o.items.map(i => i.type)) : st?.label}</Badge>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {o.items.map(i => <li key={i.id} className="flex justify-between gap-3"><span className="text-ink">{i.qty > 1 ? `${i.qty} × ` : ''}{i.name}</span><span className="tabular-nums text-ink-muted">{priceLabel(i.amount)}</span></li>)}
      </ul>
      <p className="mt-2 flex justify-between border-t border-dashed border-surface-line pt-2 text-sm font-bold text-ink"><span>Total</span><span className="tabular-nums">{priceLabel(o.total)}</span></p>
      {o.paymentMethod && <p className="mt-1 text-xs text-ink-muted">Réglé : {SHOP_PAY_METHODS[o.paymentMethod as ShopPayMethod] ?? o.paymentMethod}{o.paidBy ? ` · encaissé par ${o.paidBy}` : ''}</p>}
      {o.closedReason && <p className="mt-1 text-xs text-ink-muted">Motif : {o.closedReason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {buttons}
        <button onClick={async () => setHistory(history ? null : await getOrderHistory(o.id))} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink-subtle hover:text-ink" aria-expanded={!!history}>Historique <ChevronDown size={12} className={cn('transition-transform', history && 'rotate-180')} /></button>
      </div>
      {history && (
        <ol className="mt-2 space-y-1 border-t border-surface-line pt-2 text-xs text-ink-muted">
          {history.map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} · <b className="text-ink">{ORDER_STATUS[h.status as OrderStatus]?.label ?? h.status}</b> · {h.by}{h.note ? ` · ${h.note}` : ''}</li>)}
        </ol>
      )}
    </li>
  )
}

/** Écran « Commandes » : à confirmer, à encaisser, à remettre, terminées. */
export function OrdersBoard({ visitorsPath = "/dashboard/visitors" }: { visitorsPath?: string }) {
  const [tab, setTab] = useState<OrderBucket>('todo')
  const [data, setData] = useState<Awaited<ReturnType<typeof getOrders>> | undefined>(undefined)
  const load = useCallback(async () => setData(await getOrders(tab).catch(() => null)), [tab])
  useEffect(() => { setData(undefined); load() }, [load])
  usePolling(load, 15000)
  const { buttons, dialogs } = useOrderActions(load)

  if (data === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès aux commandes.</p>
  const counts = data?.counts
  return (
    <div className="space-y-4">
      <nav className="inline-flex flex-wrap gap-1 rounded-xl bg-surface-sunken p-1 text-sm font-semibold" aria-label="Commandes">
        {TABS.map(t => {
          const n = t.id === 'done' ? 0 : counts?.[t.id] ?? 0
          return <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={tab === t.id} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', tab === t.id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>{t.label}{n > 0 && <span className="rounded-full bg-brand px-1.5 text-xs text-white tabular-nums">{n}</span>}</button>
        })}
      </nav>
      {data === undefined ? <div className="h-40 animate-pulse rounded-card bg-gray-100" />
        : data.orders.length === 0 ? (
          <div className="rounded-card border border-dashed border-surface-line bg-white p-10 text-center">
            <ShoppingBag className="mx-auto text-ink-subtle" size={28} />
            <p className="mt-2 text-sm text-ink-muted">{TABS.find(t => t.id === tab)!.empty}</p>
          </div>
        ) : <ul className="grid gap-3 lg:grid-cols-2">{data.orders.map(o => <OrderCard key={o.id} o={o} buttons={buttons(o)} visitorsPath={visitorsPath} />)}</ul>}
      {dialogs}
    </div>
  )
}

/** Au guichet : la commande du visiteur appelé, à encaisser et à remettre sans quitter l'écran. */
export function TicketOrders({ ticketId, dark }: { ticketId: string; dark?: boolean }) {
  const [orders, setOrders] = useState<StaffOrder[]>([])
  const load = useCallback(async () => setOrders(await getTicketOrders(ticketId).catch(() => [])), [ticketId])
  useEffect(() => { setOrders([]); load() }, [load])
  usePolling(load, 20000)
  const { buttons, dialogs } = useOrderActions(load)
  const open = orders.filter(o => o.status !== 'DELIVERED')
  if (!open.length) return dialogs
  return (
    <div className="mt-3 space-y-2">
      {open.map(o => {
        const n = o.items.reduce((s, i) => s + i.qty, 0)
        const todo = o.status === 'PAID' ? 'à remettre' : 'à encaisser'
        return (
          <div key={o.id} className={cn('rounded-xl p-3', dark ? 'bg-emerald-900/30 text-emerald-100' : 'bg-success-soft text-success-ink')}>
            <p className="flex items-center gap-1.5 text-sm font-bold"><ShoppingBag size={14} /> {n} article{n > 1 ? 's' : ''} · {priceLabel(o.total)} · {todo}</p>
            <p className="mt-0.5 text-xs">{o.items.map(i => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`).join(', ')}</p>
            <div className="mt-2 flex flex-wrap gap-2">{buttons(o, true).filter(b => b.key !== 'c' && b.key !== 'rf')}</div>
          </div>
        )
      })}
      {dialogs}
    </div>
  )
}
