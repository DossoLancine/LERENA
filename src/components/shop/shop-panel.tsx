'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Minus, Plus, Receipt, ShoppingBag, X } from 'lucide-react'
import { cancelAppointmentOrder, cancelTicketOrder, getAppointmentShop, getTicketShop, placeAppointmentOrder, placeTicketOrder, trackShop } from '@/server/actions/shop-visitor'
import { useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { discountPct, ORDER_STATUS, PRODUCT_TYPES, priceLabel, visitorCanCancel, type OrderStatus, type ProductType } from '@/lib/shop'

type Shop = NonNullable<Awaited<ReturnType<typeof getTicketShop>>>
type Source = { ticketId: string } | { token: string }

const TITLES = { WAITING: 'Pendant votre attente', AFTER: 'Avant de partir', BOOKING: 'Préparez votre visite' } as const
const TONE: Record<string, string> = {
  warning: 'bg-warning-soft text-warning-ink', info: 'bg-info-soft text-info-ink', success: 'bg-success-soft text-success-ink', neutral: 'bg-gray-100 text-ink-muted'
}
const STEPS: OrderStatus[] = ['REQUESTED', 'CONFIRMED', 'PAID', 'DELIVERED']

/** Boutique de l'établissement sur le ticket ou le rendez-vous : ajouter, réserver, suivre sa commande. */
export function ShopPanel({ source, refreshKey }: { source: Source; refreshKey?: string }) {
  const toast = useToast()
  const [shop, setShop] = useState<Shop | null>(null)
  const [cart, setCart] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const seen = useRef(false)
  const key = 'ticketId' in source ? source.ticketId : source.token

  const load = useCallback(async () => {
    const s = 'ticketId' in source ? await getTicketShop(source.ticketId) : await getAppointmentShop(source.token)
    setShop(s)
    // Vu : une seule fois par page
    if (s && !seen.current && s.products.length) { seen.current = true; trackShop('view', s.products.map(p => p.id)).catch(() => null) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, refreshKey])
  // Suivi de la commande : l'équipe la confirme, l'encaisse, la remet
  const open = shop?.orders.some(o => ['REQUESTED', 'CONFIRMED', 'PAID'].includes(o.status))
  useEffect(() => {
    if (!open) return
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [open, load])

  if (!shop || (!shop.products.length && !shop.orders.length)) return null

  const lines = Object.entries(cart).filter(([, q]) => q > 0)
  const count = lines.reduce((s, [, q]) => s + q, 0)
  const total = lines.reduce((s, [id, q]) => s + (shop.products.find(p => p.id === id)?.price ?? 0) * q, 0)
  const add = (id: string, d: number) => {
    setCart(c => {
      const q = Math.max(0, Math.min(10, (c[id] ?? 0) + d))
      if (d > 0 && !c[id]) trackShop('add', [id]).catch(() => null)
      return { ...c, [id]: q }
    })
  }
  const reserve = async () => {
    setBusy(true)
    const payload = lines.map(([productId, qty]) => ({ productId, qty }))
    const res = 'ticketId' in source ? await placeTicketOrder(source.ticketId, payload) : await placeAppointmentOrder(source.token, payload)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setCart({})
    toast('Commande envoyée : l’établissement la confirme', 'success')
    load()
  }
  const cancel = async (orderId: string) => {
    if (!window.confirm('Annuler cette commande ?')) return
    const res = 'ticketId' in source ? await cancelTicketOrder(source.ticketId, orderId) : await cancelAppointmentOrder(source.token, orderId)
    if (!res.success) return toast(res.error, 'error')
    toast('Commande annulée', 'success')
    load()
  }

  return (
    <section className="overflow-hidden rounded-[22px] bg-white shadow-card ring-1 ring-black/[0.03]" aria-labelledby="shop-title">
      {shop.orders.length > 0 && (
        <ul className="divide-y divide-surface-line">
          {shop.orders.map(o => {
            const st = ORDER_STATUS[o.status as OrderStatus]
            const closed = o.status === 'CANCELLED' || o.status === 'REFUNDED'
            const at = STEPS.indexOf(o.status as OrderStatus)
            return (
              <li key={o.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">Commande {o.number}</p>
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', TONE[st?.tone ?? 'neutral'])}>{o.status === 'DELIVERED' ? o.deliveredLabel : st?.label}</span>
                </div>
                {!closed && (
                  <ol className="mt-2.5 flex gap-1" aria-label="Avancement de la commande">
                    {STEPS.map((s, i) => <li key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-500', i <= at ? 'bg-brand' : 'bg-gray-200')}><span className="sr-only">{ORDER_STATUS[s].label}{i <= at ? ' : fait' : ''}</span></li>)}
                  </ol>
                )}
                {o.status !== 'DELIVERED' && <p className="mt-2 text-xs text-ink-muted">{st?.visitor}</p>}
                <ul className="mt-2 space-y-1 text-sm">
                  {o.items.map((i, k) => (
                    <li key={k}>
                      <span className="flex justify-between gap-3"><span className="text-ink">{i.qty > 1 ? `${i.qty} × ` : ''}{i.name}</span><span className="tabular-nums text-ink-muted">{priceLabel(i.amount)}</span></span>
                      {i.content && <DigitalContent value={i.content} />}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-surface-line pt-2">
                  <span className="text-sm font-bold text-ink">Total {priceLabel(o.total)}</span>
                  <span className="flex gap-2">
                    {(o.status === 'PAID' || o.status === 'DELIVERED') && <Link href={`/shop/receipt/${o.id}`} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-brand ring-1 ring-brand/30"><Receipt size={12} /> Reçu</Link>}
                    {visitorCanCancel(o.status) && <button onClick={() => cancel(o.id)} className="rounded-full px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-gray-200 hover:text-danger">Annuler</button>}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {shop.products.length > 0 && shop.moment && (
        <div className={cn(shop.orders.length > 0 && 'border-t border-surface-line')}>
          <div className="px-4 pb-1 pt-4">
            <p id="shop-title" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700"><ShoppingBag size={14} /> {TITLES[shop.moment]}</p>
            <p className="mt-0.5 text-xs text-ink-muted">Réservez maintenant, réglez au guichet ou à la caisse de {shop.orgName}.</p>
          </div>
          <ul className="divide-y divide-surface-line">
            {shop.products.map(p => {
              const q = cart[p.id] ?? 0
              const off = discountPct(p.price, p.compareAtPrice)
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.image
                    ? <img src={p.image} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} /> // eslint-disable-line @next/next/no-img-element
                    : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><ShoppingBag size={20} /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-ink">{p.name}</span>
                    {p.description && <span className="line-clamp-2 block text-xs text-ink-muted">{p.description}</span>}
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
                      <span className="font-bold tabular-nums text-ink">{priceLabel(p.price)}</span>
                      {off && <><s className="text-xs tabular-nums text-ink-subtle">{priceLabel(p.compareAtPrice!)}</s><span className="text-[11px] font-bold text-success-ink">−{off} %</span></>}
                      <span className="text-[11px] text-ink-subtle">{PRODUCT_TYPES[p.type as ProductType]?.label}</span>
                      {p.left != null && !p.soldOut && <span className="text-[11px] font-semibold text-warning-ink">plus que {p.left}</span>}
                    </span>
                  </span>
                  {p.soldOut ? <span className="shrink-0 text-xs font-semibold text-ink-subtle">Épuisé</span>
                    : q === 0 ? <button onClick={() => add(p.id, 1)} className="pressable shrink-0 rounded-full bg-brand-50 px-3.5 py-2 text-sm font-bold text-brand" aria-label={`Ajouter ${p.name}`}>Ajouter</button>
                    : (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 p-1">
                        <button onClick={() => add(p.id, -1)} className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand" aria-label={`Retirer un ${p.name}`}><Minus size={14} /></button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums text-brand" aria-live="polite">{q}</span>
                        <button onClick={() => add(p.id, 1)} disabled={q >= 10 || (p.left != null && q >= p.left)} className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand disabled:opacity-40" aria-label={`Ajouter un ${p.name}`}><Plus size={14} /></button>
                      </span>
                    )}
                </li>
              )
            })}
          </ul>
          {count > 0 && (
            <div className="flex items-center gap-3 border-t border-surface-line bg-brand-50/60 px-4 py-3">
              <span className="min-w-0 flex-1 text-sm"><span className="block font-bold text-ink">{count} article{count > 1 ? 's' : ''} · {priceLabel(total)}</span><span className="block text-[11px] text-ink-muted">À régler sur place</span></span>
              <button onClick={() => setCart({})} className="pressable rounded-full p-2 text-ink-muted" aria-label="Vider le panier"><X size={16} /></button>
              <button onClick={reserve} disabled={busy} className="pressable rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60">{busy ? 'Envoi…' : 'Réserver'}</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function DigitalContent({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const link = /^https?:\/\//.test(value)
  return (
    <span className="mt-1 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs text-success-ink">
      {link ? <a href={value} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold underline">Ouvrir le document</a> : <span className="min-w-0 flex-1 break-all font-mono font-semibold">{value}</span>}
      <button onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => null)} className="shrink-0 rounded-full p-1" aria-label="Copier">{copied ? <Check size={13} /> : <Copy size={13} />}</button>
    </span>
  )
}
