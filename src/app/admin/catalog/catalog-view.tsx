'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Monitor, Pencil, Plus, Sparkles, Wrench, Package } from 'lucide-react'
import { saveProduct, type getProducts } from '@/server/actions/billing-admin'
import { Badge, Button, Card, Dialog, SelectInput, TextArea, TextInput, useToast } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'
import { PRODUCT_KINDS, fcfa } from '@/lib/billing-labels'

type Product = NonNullable<Awaited<ReturnType<typeof getProducts>>>[number]
const ICON = { SMS_PACK: MessageSquare, FEATURED: Sparkles, HARDWARE: Monitor, SETUP: Wrench, OTHER: Package } as const

/** Catalogue : packs SMS, mise en avant, matériel (vente ou location), installation et formation. */
export function CatalogView({ products }: { products: Product[] }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const [kind, setKind] = useState('SMS_PACK')
  const [busy, setBusy] = useState(false)
  const current = editing === 'new' ? null : editing

  const open = (p: Product | 'new') => { setEditing(p); setKind(p === 'new' ? 'SMS_PACK' : p.kind) }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    const res = await saveProduct({
      id: current?.id, kind, name: v('name'), description: v('description'), price: v('price'), rentalMonthly: v('rentalMonthly'),
      smsQuantity: v('smsQuantity'), featuredDays: v('featuredDays'), isActive: f.get('isActive') === 'on', sortOrder: v('sortOrder')
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Catalogue mis à jour')
    setEditing(null)
    router.refresh()
  }

  const groups = (Object.keys(PRODUCT_KINDS) as (keyof typeof PRODUCT_KINDS)[]).map(k => ({ kind: k, items: products.filter(p => p.kind === k) })).filter(g => g.items.length)

  return (
    <div className="space-y-5">
      <PageHeader title="Catalogue" subtitle="Ce que les établissements peuvent commander depuis « Abonnement ». Les SMS et la mise en avant s’activent au paiement de la facture."
        actions={<Button icon={<Plus size={16} />} onClick={() => open('new')}>Nouvel article</Button>} />

      {groups.map(g => {
        const Icon = ICON[g.kind]
        return (
          <Card key={g.kind}>
            <div className="flex items-center gap-2 border-b border-surface-line px-5 py-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon size={16} /></span>
              <h2 className="font-semibold text-ink">{PRODUCT_KINDS[g.kind]}</h2>
            </div>
            <ul className="stagger divide-y divide-surface-line">
              {g.items.map(p => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-ink">{p.name}{!p.isActive && <Badge tone="neutral">Masqué</Badge>}</p>
                    <p className="truncate text-xs text-ink-subtle">
                      {[p.description, p.smsQuantity && `${p.smsQuantity.toLocaleString('fr-FR')} SMS · ${Math.round(p.price / p.smsQuantity)} FCFA le SMS`, p.featuredDays && `${p.featuredDays} jours`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-ink">{fcfa(p.price)}</p>
                    {p.rentalMonthly != null && <p className="text-xs text-ink-muted">ou {fcfa(p.rentalMonthly)} / mois</p>}
                  </div>
                  <button type="button" onClick={() => open(p)} aria-label={`Modifier ${p.name}`} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100 hover:text-ink"><Pencil size={16} /></button>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={current ? `Modifier ${current.name}` : 'Nouvel article'}>
        <form key={current?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <SelectInput label="Type" value={kind} onChange={e => setKind(e.target.value)}>
            {Object.entries(PRODUCT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </SelectInput>
          <TextInput name="name" label="Nom" required maxLength={80} defaultValue={current?.name} />
          <TextArea name="description" label="Description" rows={2} maxLength={300} defaultValue={current?.description ?? ''} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput name="price" label="Prix (FCFA HT)" type="number" min={0} required defaultValue={current?.price ?? ''} />
            {kind === 'HARDWARE' && <TextInput name="rentalMonthly" label="Location / mois (FCFA HT)" type="number" min={0} defaultValue={current?.rentalMonthly ?? ''} hint="Vide = vente seulement" />}
            {kind === 'SMS_PACK' && <TextInput name="smsQuantity" label="Nombre de SMS" type="number" min={1} required defaultValue={current?.smsQuantity ?? ''} />}
            {kind === 'FEATURED' && <TextInput name="featuredDays" label="Durée (jours)" type="number" min={1} required defaultValue={current?.featuredDays ?? ''} />}
            <TextInput name="sortOrder" label="Ordre" type="number" defaultValue={current?.sortOrder ?? products.length + 1} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} className="accent-brand" /> Proposé aux établissements</label>
          <Button type="submit" fullWidth loading={busy}>Enregistrer</Button>
        </form>
      </Dialog>
    </div>
  )
}
