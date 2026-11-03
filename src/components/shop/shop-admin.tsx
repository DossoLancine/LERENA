'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Eye, ImagePlus, Package, Plus, ShoppingBag, ShoppingCart, Trash2 } from 'lucide-react'
import { deleteProduct, getCatalog, getShopStats, saveProduct, type ProductInput } from '@/server/actions/shop'
import { Badge, Button, Dialog, TextArea, TextInput, useToast } from '@/components/ui'
import { OrdersBoard } from '@/components/shop/orders-board'
import { cn } from '@/lib/cn'
import { discountPct, PRODUCT_TYPES, priceLabel, SHOP_MOMENTS, SHOP_PAY_METHODS, type ProductType, type ShopMoment } from '@/lib/shop'

type Catalog = NonNullable<Awaited<ReturnType<typeof getCatalog>>>
type Product = Catalog['products'][number]
type Tab = 'orders' | 'catalog' | 'sales'

/** Boutique du responsable : commandes, catalogue, ventes. */
export function ShopAdmin({ canManage, canSell, canStats }: { canManage: boolean; canSell: boolean; canStats: boolean }) {
  const [tab, setTab] = useState<Tab>(canSell ? 'orders' : canManage ? 'catalog' : 'sales')
  const tabs = ([['orders', 'Commandes', ShoppingCart, canSell], ['catalog', 'Catalogue', Package, canManage], ['sales', 'Ventes', BarChart3, canStats || canManage]] as const).filter(t => t[3])
  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"><ShoppingBag size={14} /> Boutique</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Vendre pendant la visite</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Le visiteur réserve depuis son ticket ou son rendez-vous ; votre équipe confirme, encaisse et remet. Rien n’est vendu sans votre validation.</p>
        <nav className="mt-4 inline-flex rounded-xl bg-white/80 p-1 text-sm font-semibold" aria-label="Boutique">
          {tabs.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', tab === id ? 'bg-ink text-white' : 'text-ink-muted')}><Icon size={14} /> {label}</button>
          ))}
        </nav>
      </header>
      {tab === 'orders' && <OrdersBoard />}
      {tab === 'catalog' && <CatalogTab />}
      {tab === 'sales' && <SalesTab />}
    </div>
  )
}

// ---- Catalogue ----

function CatalogTab() {
  const toast = useToast()
  const [data, setData] = useState<Catalog | null | undefined>(undefined)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const load = useCallback(async () => setData(await getCatalog().catch(() => null)), [])
  useEffect(() => { load() }, [load])
  if (data === undefined) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />
  if (data === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne permet pas de gérer le catalogue.</p>
  const full = data.limit != null && data.activeCount >= data.limit

  const toggle = async (p: Product) => {
    const res = await saveProduct({ ...toInput(p), isActive: !p.isActive })
    if (!res.success) return toast(res.error, 'error')
    toast(p.isActive ? 'Produit retiré de la vente' : 'Produit remis en vente', 'success')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {data.activeCount} produit{data.activeCount > 1 ? 's' : ''} en vente{data.limit != null ? ` sur ${data.limit} inclus dans votre forfait` : ''}.
          {full && <> <Link href="/dashboard/billing" className="font-semibold text-brand underline">Passer au forfait Pro</Link> pour en proposer plus.</>}
        </p>
        <Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>Nouveau produit</Button>
      </div>
      {data.products.length === 0 ? (
        <div className="rounded-card border border-dashed border-surface-line bg-white p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><ShoppingBag size={26} /></span>
          <p className="mt-3 font-semibold text-ink">Votre boutique est vide</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Ajoutez ce que vos visiteurs achètent déjà sur place (carnet, attestation, photocopie, livraison…) pour qu’ils le réservent pendant qu’ils attendent.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.products.map(p => {
            const off = discountPct(p.price, p.compareAtPrice)
            const low = p.stock != null && p.lowStockAt != null && p.stock <= p.lowStockAt
            return (
              <li key={p.id} className={cn('flex gap-3 rounded-card border border-surface-line bg-white p-4 shadow-card', !p.isActive && 'opacity-60')}>
                {p.image ? <img src={p.image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" /> /* eslint-disable-line @next/next/no-img-element */
                  : <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Package size={24} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5"><span className="font-semibold text-ink">{p.name}</span><Badge>{PRODUCT_TYPES[p.type as ProductType]?.label}</Badge>{!p.isActive && <Badge tone="neutral">Hors vente</Badge>}</p>
                  <p className="mt-0.5 text-sm"><b className="tabular-nums text-ink">{priceLabel(p.price)}</b>{off && <> <s className="text-xs text-ink-subtle">{priceLabel(p.compareAtPrice!)}</s> <span className="text-xs font-bold text-success-ink">−{off} %</span></>}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{p.moments.map(m => SHOP_MOMENTS[m as ShopMoment]?.label).filter(Boolean).join(' · ')}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    {p.stock != null ? <span className={cn(low && 'font-semibold text-warning-ink')}>Stock {p.stock}{low ? ' (bas)' : ''} · </span> : null}
                    <Eye size={11} className="inline" /> {p.views} vus · {p.adds} ajoutés
                  </p>
                  {p.editable ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(p)}>Modifier</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? 'Retirer de la vente' : 'Remettre en vente'}</Button>
                    </div>
                  ) : <p className="mt-2 text-[11px] text-ink-subtle">Géré par la direction</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editing && <ProductDialog catalog={data} product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

const toInput = (p: Product): ProductInput => ({
  id: p.id, type: p.type, name: p.name, description: p.description, price: p.price, compareAtPrice: p.compareAtPrice, stock: p.stock, lowStockAt: p.lowStockAt,
  branchIds: p.branchIds, serviceIds: p.serviceIds, moments: p.moments, digitalContent: p.digitalContent, isActive: p.isActive
})

/** Photo réduite à 600 px (WebP) dans le navigateur avant l'envoi. */
async function shrink(file: File) {
  const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file) })
  const scale = Math.min(1, 600 / Math.max(img.width, img.height))
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * scale), height: Math.round(img.height * scale) })
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', 0.8)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.8)
}

function ProductDialog({ catalog, product, onClose, onSaved }: { catalog: Catalog; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const file = useRef<HTMLInputElement>(null)
  const [f, setF] = useState<ProductInput>(product ? toInput(product) : { type: 'PHYSICAL', name: '', description: '', price: 0, compareAtPrice: null, stock: null, lowStockAt: null, branchIds: [], serviceIds: [], moments: ['WAITING'], digitalContent: '', isActive: true })
  const [image, setImage] = useState<string | null | undefined>(undefined) // undefined = inchangée
  const [link, setLink] = useState(product?.imageIsLink ? product.image ?? '' : '')
  const [busy, setBusy] = useState(false)
  const preview = image !== undefined ? image : product?.image ?? null
  const num = (v: string) => (v === '' ? null : Number(v))
  const toggleIn = (k: 'branchIds' | 'serviceIds' | 'moments', id: string) => setF(x => ({ ...x, [k]: x[k].includes(id) ? x[k].filter(i => i !== id) : [...x[k], id] }))
  const services = catalog.services.filter(s => !f.branchIds.length || f.branchIds.includes(s.branchId))

  const save = async () => {
    setBusy(true)
    const res = await saveProduct({ ...f, image: image !== undefined ? image : link && link !== product?.image ? link : undefined })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast(product ? 'Produit enregistré' : 'Produit ajouté à la boutique', 'success'); onSaved()
  }
  const remove = async () => {
    if (!product || !window.confirm(`Supprimer « ${product.name} » ?`)) return
    const res = await deleteProduct(product.id)
    if (!res.success) return toast(res.error, 'error')
    toast(res.archived ? 'Déjà commandé : retiré de la vente (les reçus restent)' : 'Produit supprimé', 'success'); onSaved()
  }

  return (
    <Dialog open onClose={onClose} title={product ? 'Modifier le produit' : 'Nouveau produit'} size="lg">
      <div className="space-y-5">
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Type</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(PRODUCT_TYPES) as ProductType[]).map(t => (
              <button key={t} onClick={() => setF({ ...f, type: t })} aria-pressed={f.type === t} className={cn('rounded-xl border-2 p-3 text-left', f.type === t ? 'border-brand bg-brand-50' : 'border-surface-line')}>
                <span className="block text-sm font-semibold text-ink">{PRODUCT_TYPES[t].label}</span>
                <span className="block text-[11px] leading-snug text-ink-muted">{PRODUCT_TYPES[t].hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <div className="space-y-3">
            <TextInput label="Nom" value={f.name} maxLength={80} onChange={e => setF({ ...f, name: e.target.value })} />
            <TextArea label="Description courte" rows={2} maxLength={300} value={f.description ?? ''} onChange={e => setF({ ...f, description: e.target.value })} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Photo</p>
            <button onClick={() => file.current?.click()} className="mt-1.5 flex h-[120px] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-surface-line bg-surface-sunken text-ink-subtle hover:border-brand" aria-label="Choisir une photo">
              {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */ : <ImagePlus size={24} />}
            </button>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async e => { const x = e.target.files?.[0]; if (x) { setImage(await shrink(x)); setLink('') } e.target.value = '' }} />
            {preview && <button onClick={() => { setImage(null); setLink('') }} className="mt-1 text-xs font-semibold text-ink-muted hover:text-danger">Enlever la photo</button>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <TextInput label="Prix (FCFA)" type="number" min={0} value={f.price} onChange={e => setF({ ...f, price: Number(e.target.value) })} hint="0 = offert" />
          <TextInput label="Prix barré" type="number" min={0} value={f.compareAtPrice ?? ''} onChange={e => setF({ ...f, compareAtPrice: num(e.target.value) })} hint="promotion" />
          <TextInput label="Stock" type="number" min={0} value={f.stock ?? ''} onChange={e => setF({ ...f, stock: num(e.target.value) })} hint="vide = non suivi" />
          <TextInput label="Alerte stock bas" type="number" min={0} value={f.lowStockAt ?? ''} onChange={e => setF({ ...f, lowStockAt: num(e.target.value) })} disabled={f.stock == null} />
        </div>

        {f.type === 'DIGITAL' && (
          <TextArea label="Lien ou code envoyé après le paiement" rows={2} maxLength={500} value={f.digitalContent ?? ''} onChange={e => setF({ ...f, digitalContent: e.target.value })} hint="Visible par le visiteur seulement une fois la commande payée : sur son ticket, par WhatsApp ou SMS, et par e-mail s’il a un compte." />
        )}

        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Proposer</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(SHOP_MOMENTS) as ShopMoment[]).map(m => (
              <label key={m} className={cn('flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3', f.moments.includes(m) ? 'border-brand bg-brand-50' : 'border-surface-line')}>
                <input type="checkbox" className="mt-0.5 accent-brand" checked={f.moments.includes(m)} onChange={() => toggleIn('moments', m)} />
                <span><span className="block text-sm font-semibold text-ink">{SHOP_MOMENTS[m].label}</span><span className="block text-[11px] text-ink-muted">{SHOP_MOMENTS[m].hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        {catalog.sites.length > 1 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sites {catalog.scoped ? '' : '(aucun coché = tous)'}</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {catalog.sites.map(s => <Chip key={s.id} on={f.branchIds.includes(s.id)} onClick={() => toggleIn('branchIds', s.id)}>{s.name}</Chip>)}
            </div>
          </fieldset>
        )}
        {services.length > 0 && (
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Services concernés (aucun coché = tous)</legend>
            <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {services.map(s => <Chip key={s.id} on={f.serviceIds.includes(s.id)} onClick={() => toggleIn('serviceIds', s.id)}>{s.name}</Chip>)}
            </div>
          </fieldset>
        )}

        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" className="accent-brand" checked={f.isActive} onChange={e => setF({ ...f, isActive: e.target.checked })} /> En vente</label>
        <div className="flex gap-2">
          {product && <Button variant="ghost" icon={<Trash2 size={15} />} onClick={remove} className="text-danger">Supprimer</Button>}
          <Button className="flex-1" loading={busy} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </Dialog>
  )
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} aria-pressed={on} className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'text-ink-muted ring-gray-200')}>{children}</button>
)

// ---- Ventes ----

function SalesTab() {
  const [days, setDays] = useState(30)
  const [s, setS] = useState<Awaited<ReturnType<typeof getShopStats>> | undefined>(undefined)
  useEffect(() => { setS(undefined); getShopStats(days).then(setS).catch(() => setS(null)) }, [days])
  if (s === undefined) return <div className="h-64 animate-pulse rounded-card bg-gray-100" />
  if (!s) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès aux ventes.</p>
  const max = Math.max(1, ...s.byDay.map(d => d.amount))
  const funnel = [['Vus', s.funnel.views], ['Ajoutés au panier', s.funnel.adds], ['Réservés', s.funnel.ordered], ['Payés', s.funnel.paid]] as const
  const top = Math.max(1, funnel[0][1])
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl bg-surface-sunken p-1 text-xs font-semibold">
        {[7, 30, 90].map(d => <button key={d} onClick={() => setDays(d)} aria-pressed={days === d} className={cn('rounded-lg px-3 py-1.5', days === d ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>{d} jours</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Chiffre d’affaires', priceLabel(s.revenue).replace('Offert', '0 FCFA'), `${s.sold} vente${s.sold > 1 ? 's' : ''} payée${s.sold > 1 ? 's' : ''}`],
          ['Panier moyen', s.avgBasket != null ? priceLabel(s.avgBasket) : '—', `${s.orders} commande${s.orders > 1 ? 's' : ''} passée${s.orders > 1 ? 's' : ''}`],
          ['Annulées', String(s.cancelled), 'avant l’encaissement'],
          ['Remboursé', priceLabel(s.refunded).replace('Offert', '0 FCFA'), 'sur la période']
        ].map(([l, v, h]) => (
          <div key={l} className="rounded-card border border-surface-line bg-white p-4 shadow-card"><p className="text-xs text-ink-muted">{l}</p><p className="mt-1 font-display text-2xl font-bold tabular-nums text-ink">{v}</p><p className="text-[11px] text-ink-subtle">{h}</p></div>
        ))}
      </div>

      <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <h2 className="font-semibold text-ink">Chiffre d’affaires par jour</h2>
        <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label={`Chiffre d’affaires par jour sur ${s.period} jours`}>
          {s.byDay.map(d => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end">
              <div className={cn('w-full rounded-t-[4px] transition-colors', d.amount ? 'bg-brand group-hover:bg-brand-700' : 'bg-gray-100')} style={{ height: d.amount ? `${Math.max(3, (d.amount / max) * 100)}%` : '2px' }} />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-[11px] text-white group-hover:block">{new Date(`${d.day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {d.amount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          ))}
        </div>
        <p className="mt-2 flex justify-between text-[11px] text-ink-subtle"><span>{new Date(`${s.byDay[0].day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span><span>aujourd’hui</span></p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="font-semibold text-ink">Parcours des visiteurs</h2>
          <p className="text-xs text-ink-muted">Vus et ajoutés : depuis la mise en vente ; réservés et payés : sur la période (articles).</p>
          <ol className="mt-3 space-y-2.5">
            {funnel.map(([l, v]) => (
              <li key={l}>
                <p className="flex justify-between text-xs"><span className="text-ink-muted">{l}</span><span className="font-semibold tabular-nums text-ink">{v.toLocaleString('fr-FR')}</span></p>
                <div className="mt-1 h-2 rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand" style={{ width: `${(v / top) * 100}%` }} /></div>
              </li>
            ))}
          </ol>
        </section>
        <Ranking title="Produits les plus vendus" rows={s.byProduct.map(r => ({ label: r.key, value: r.amount, hint: `${r.qty} vendu${r.qty > 1 ? 's' : ''}` }))} />
        {s.bySite.length > 1 && <Ranking title="Par site" rows={s.bySite.map(r => ({ label: r.key, value: r.amount, hint: `${r.orders} vente${r.orders > 1 ? 's' : ''}` }))} />}
        <Ranking title="Par vendeur" rows={s.bySeller.map(r => ({ label: r.key, value: r.amount, hint: `${r.orders} encaissement${r.orders > 1 ? 's' : ''}` }))} />
        <Ranking title="Par mode de paiement" rows={s.byMethod.map(r => ({ label: SHOP_PAY_METHODS[r.key as keyof typeof SHOP_PAY_METHODS] ?? 'Autre', value: r.amount, hint: `${r.orders}` }))} />
      </div>
    </div>
  )
}

function Ranking({ title, rows }: { title: string; rows: { label: string; value: number; hint: string }[] }) {
  return (
    <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
      <h2 className="font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-ink-subtle">Aucune vente sur la période.</p> : (
        <ul className="mt-3 divide-y divide-surface-line text-sm">
          {rows.map(r => <li key={r.label} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0 truncate text-ink">{r.label} <span className="text-xs text-ink-subtle">· {r.hint}</span></span><span className="shrink-0 font-semibold tabular-nums text-ink">{r.value.toLocaleString('fr-FR')} FCFA</span></li>)}
        </ul>
      )}
    </section>
  )
}
