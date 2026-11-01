'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Minus, Plus, ShoppingCart, Sparkles, Star } from 'lucide-react'
import { changeMyPlan, declarePayment, getMyBilling, orderProducts } from '@/server/actions/billing'
import { Badge, Button, Card, CardHeader, Dialog, SelectInput, TextInput, useToast } from '@/components/ui'
import { InvoiceBadge, PageHeader, StateBadge, UsageMeter } from '@/components/billing/badges'
import { fcfa } from '@/lib/billing-labels'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getMyBilling>>>
type Cart = Record<string, { qty: number; rental: boolean }>
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '—')
const limit = (v: number | null, unit: string) => (v == null ? `${unit} illimités` : `${v.toLocaleString('fr-FR')} ${unit}`)

/** Abonnement de l'établissement : forfait, consommation, factures, changement de forfait et boutique. */
export default function BillingPage() {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY')
  const [cart, setCart] = useState<Cart>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [declareFor, setDeclareFor] = useState<Data['invoices'][number] | null>(null)

  const load = useCallback(() => getMyBilling().then(d => { setData(d); if (d) setCycle(d.cycle as 'MONTHLY' | 'YEARLY') }), [])
  useEffect(() => { load() }, [load])

  const cartLines = useMemo(() => data ? Object.entries(cart).filter(([, v]) => v.qty > 0).map(([id, v]) => {
    const p = data.products.find(x => x.id === id)!
    return { ...v, product: p, amount: (v.rental && p.rentalMonthly != null ? p.rentalMonthly : p.price) * v.qty }
  }) : [], [cart, data])
  const cartTotal = cartLines.reduce((s, l) => s + l.amount, 0)

  if (!data) return <div className="space-y-4"><div className="h-40 rounded-card shimmer" /><div className="h-72 rounded-card shimmer" /></div>

  const choose = async (planId: string, name: string) => {
    setBusy(planId)
    const res = await changeMyPlan(planId, cycle)
    setBusy(null)
    if (!res.success) return toast(res.error, 'error')
    toast(res.quote ? `Demande de devis ${name} envoyée : l’équipe Lerena vous recontacte` : `Forfait ${name} activé`)
    load()
  }

  const order = async () => {
    setBusy('order')
    const res = await orderProducts(cartLines.map(l => ({ productId: l.product.id, qty: l.qty, rental: l.rental })))
    setBusy(null)
    if (!res.success) return toast(res.error, 'error')
    toast(`Commande enregistrée : facture ${res.number}`)
    setCart({})
    load()
  }

  const setQty = (id: string, delta: number, rental = false) => setCart(c => {
    const cur = c[id] ?? { qty: 0, rental }
    return { ...c, [id]: { ...cur, qty: Math.max(0, Math.min(99, cur.qty + delta)) } }
  })

  const used = data.usage
  const sites = data.sites

  return (
    <div className="space-y-5">
      <PageHeader title="Abonnement" subtitle="Votre forfait, votre consommation et vos factures" />

      {/* Forfait actuel */}
      <Card className="overflow-hidden">
        <div className="grid gap-5 bg-gradient-to-br from-brand-50 via-white to-white p-5 md:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Forfait actuel</p>
              <StateBadge state={data.state} daysLeft={data.daysLeft} />
            </div>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-ink">{data.plan.name}</h2>
            {data.plan.tagline && <p className="text-sm text-ink-muted">{data.plan.tagline}</p>}
            <p className="mt-3 text-sm text-ink">
              {data.unitPrice == null ? 'Tarif sur devis' : <><strong>{fcfa(data.unitPrice)}</strong> HT par site et par mois × {sites} site{sites > 1 ? 's' : ''}{data.discountPct ? ` · remise ${data.discountPct} %` : ''}{data.cycle === 'YEARLY' ? ' · paiement annuel' : ''}</>}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {data.state === 'TRIAL' && `Essai gratuit jusqu’au ${date(data.until)}.`}
              {data.state === 'ACTIVE' && data.until && `Payé jusqu’au ${date(data.until)}.`}
              {data.state === 'GRACE' && <span className="font-semibold text-warning-ink">Paiement attendu : le service en ligne sera suspendu le {date(data.until)}.</span>}
              {data.state === 'SUSPENDED' && <span className="font-semibold text-danger">Service en ligne suspendu : réglez la facture en attente pour le rétablir.</span>}
              {data.nextInvoice && data.state !== 'SUSPENDED' && ` Prochaine facture : ${fcfa(data.nextInvoice.total)} HT.`}
            </p>
            {data.featuredUntil && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-ink"><Sparkles size={13} /> À la une jusqu’au {date(data.featuredUntil)}</p>}
          </div>
          <div className="space-y-3.5 rounded-2xl bg-white/70 p-4 ring-1 ring-surface-line">
            <UsageMeter label="Tickets ce mois-ci" used={used.ticketsMonth} max={data.plan.maxTicketsMonth == null ? null : data.plan.maxTicketsMonth * sites} />
            <UsageMeter label="Guichets (site le plus équipé)" used={used.maxCountersUsed} max={data.plan.maxCounters} />
            <UsageMeter label="Services (site le plus fourni)" used={used.maxServicesUsed} max={data.plan.maxServices} />
            <UsageMeter label="SMS inclus ce mois-ci" used={Math.min(used.sms.used, used.sms.included)} max={used.sms.included || null} />
            <p className="flex justify-between text-sm"><span className="text-ink-muted">SMS achetés restants</span><span className="font-semibold tabular-nums">{used.sms.credits.toLocaleString('fr-FR')}</span></p>
          </div>
        </div>
      </Card>

      {/* Factures */}
      <Card>
        <CardHeader title="Factures" subtitle="Payez par Mobile Money ou virement, puis signalez votre paiement" />
        {data.invoices.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Aucune facture pour l’instant.{data.state === 'TRIAL' ? ' La première arrivera 7 jours avant la fin de votre essai.' : ''}</p> : (
          <ul className="divide-y divide-surface-line">
            {data.invoices.map(i => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <Link href={`/dashboard/billing/invoices/${i.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-ink group-hover:text-brand">{i.number}</span>
                    <span className="block text-xs text-ink-subtle">{i.kind === 'SUBSCRIPTION' ? 'Abonnement' : 'Commande'} · émise le {date(i.issuedAt)} · échéance {date(i.dueAt)}</span>
                  </span>
                </Link>
                <InvoiceBadge status={i.status} overdue={i.overdue} />
                <span className="w-28 text-right font-semibold tabular-nums">{fcfa(i.total)}</span>
                {i.status === 'SENT' ? <Button size="sm" variant="secondary" onClick={() => setDeclareFor(i)}>J’ai payé</Button> : <ChevronRight size={16} className="text-ink-subtle" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Forfaits */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Changer de forfait</h2>
            <p className="text-sm text-ink-muted">Prix HT par site et par mois. Le nouveau tarif s’applique à votre prochaine facture.</p>
          </div>
          <div className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-semibold" role="group" aria-label="Rythme de paiement">
            {(['MONTHLY', 'YEARLY'] as const).map(c => (
              <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)} className={cn('rounded-full px-4 py-1.5 transition-all', cycle === c ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>
                {c === 'MONTHLY' ? 'Mensuel' : 'Annuel'}{c === 'YEARLY' && <span className="ml-1 text-success-ink">−{Math.max(0, ...data.plans.map(p => p.yearlyDiscountPct))} %</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="stagger grid gap-4 md:grid-cols-3">
          {data.plans.map(p => {
            const current = p.id === data.plan.id
            const price = p.priceMonthly == null ? null : Math.round(p.priceMonthly * (cycle === 'YEARLY' ? 1 - p.yearlyDiscountPct / 100 : 1))
            return (
              <article key={p.id} className={cn('lift relative flex flex-col rounded-card border bg-white p-5 shadow-card', p.highlight ? 'border-brand ring-2 ring-brand/15' : 'border-surface-line')}>
                {p.highlight && <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow"><Star size={12} /> Le plus choisi</span>}
                <h3 className="text-lg font-bold text-ink">{p.name}</h3>
                {p.tagline && <p className="text-sm text-ink-muted">{p.tagline}</p>}
                <p className="mt-3">{price == null ? <span className="text-2xl font-bold text-ink">Sur devis</span> : <><span className="text-3xl font-black tabular-nums text-ink">{price.toLocaleString('fr-FR')}</span> <span className="text-sm text-ink-muted">FCFA / site / mois</span></>}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink">
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxCounters, 'guichets')} par site</li>
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxTicketsMonth, 'tickets')} par mois</li>
                  <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{p.smsIncluded ? `${p.smsIncluded} SMS inclus par mois` : 'SMS en packs'}</li>
                  {p.features.filter(f => f !== 'TV' && f !== 'KIOSK').map(f => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{data.featureLabels[f as keyof typeof data.featureLabels] ?? f}</li>)}
                </ul>
                <div className="mt-auto pt-5">
                  {current
                    ? <Badge tone="success" className="w-full justify-center py-2">Votre forfait</Badge>
                    : <Button fullWidth variant={p.highlight ? 'primary' : 'secondary'} loading={busy === p.id} onClick={() => choose(p.id, p.name)}>{p.priceMonthly == null ? 'Demander un devis' : `Passer à ${p.name}`}</Button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Boutique */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Boutique</h2>
          <p className="text-sm text-ink-muted">SMS, mise en avant dans la recherche, matériel et installation. Activés dès le paiement de la facture.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="stagger grid gap-3 sm:grid-cols-2">
            {data.products.map(p => {
              const line = cart[p.id]
              return (
                <article key={p.id} className="lift flex flex-col rounded-card border border-surface-line bg-white p-4 shadow-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{data.productKinds[p.kind as keyof typeof data.productKinds] ?? p.kind}</p>
                  <h3 className="font-semibold text-ink">{p.name}</h3>
                  {p.description && <p className="mt-0.5 text-xs text-ink-muted">{p.description}</p>}
                  <p className="mt-2 font-bold tabular-nums text-ink">{fcfa(p.price)}{p.rentalMonthly != null && <span className="block text-xs font-normal text-ink-muted">ou location {fcfa(p.rentalMonthly)} / mois</span>}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    {p.rentalMonthly != null ? (
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted"><input type="checkbox" className="accent-brand" checked={!!line?.rental} onChange={e => setCart(c => ({ ...c, [p.id]: { qty: c[p.id]?.qty ?? 0, rental: e.target.checked } }))} /> Location</label>
                    ) : <span />}
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`Retirer un ${p.name}`} disabled={!line?.qty} onClick={() => setQty(p.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-ink disabled:opacity-30"><Minus size={14} /></button>
                      <span key={line?.qty} className="animate-value w-7 text-center font-semibold tabular-nums">{line?.qty ?? 0}</span>
                      <button type="button" aria-label={`Ajouter un ${p.name}`} onClick={() => setQty(p.id, 1, line?.rental)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white"><Plus size={14} /></button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
          <aside className="h-fit rounded-card border border-surface-line bg-white p-4 shadow-card lg:sticky lg:top-6">
            <p className="flex items-center gap-2 font-semibold text-ink"><ShoppingCart size={17} /> Panier</p>
            {cartLines.length === 0 ? <p className="mt-2 text-sm text-ink-subtle">Ajoutez des articles avec +.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {cartLines.map(l => <li key={l.product.id} className="flex animate-rise-in justify-between gap-2"><span className="text-ink">{l.qty} × {l.product.name}{l.rental ? ' (location 1 mois)' : ''}</span><span className="shrink-0 tabular-nums">{fcfa(l.amount)}</span></li>)}
              </ul>
            )}
            <p className="mt-3 flex justify-between border-t border-surface-line pt-3 font-bold"><span>Total HT</span><span className="tabular-nums">{fcfa(cartTotal)}</span></p>
            <Button className="mt-3" fullWidth disabled={!cartLines.length} loading={busy === 'order'} onClick={order}>Commander</Button>
            <p className="mt-2 text-xs text-ink-subtle">Une facture est créée ; elle s’ajoute à la liste ci-dessus.</p>
          </aside>
        </div>
      </section>

      <Dialog open={!!declareFor} onClose={() => setDeclareFor(null)} title={`Signaler le paiement de ${declareFor?.number ?? ''}`}>
        {declareFor && (
          <form className="space-y-4" onSubmit={async e => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            setBusy('declare')
            const res = await declarePayment(declareFor.id, String(f.get('method')), String(f.get('reference')))
            setBusy(null)
            if (!res.success) return toast(res.error, 'error')
            toast('Merci ! Le paiement sera confirmé par l’équipe Lerena.')
            setDeclareFor(null)
            load()
          }}>
            {data.paymentInstructions && <p className="whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm text-ink-muted">{data.paymentInstructions}</p>}
            <p className="text-sm text-ink">Montant : <strong>{fcfa(declareFor.total - declareFor.paid)}</strong> · référence à indiquer : <span className="font-mono font-semibold">{declareFor.number}</span></p>
            <SelectInput name="method" label="Payé par" defaultValue="ORANGE_MONEY">
              {Object.entries(data.paymentMethods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectInput>
            <TextInput name="reference" label="Référence de la transaction" required placeholder="Ex. ID de transaction reçu par SMS" />
            <Button type="submit" fullWidth loading={busy === 'declare'}>Envoyer</Button>
          </form>
        )}
      </Dialog>
    </div>
  )
}
