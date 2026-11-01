'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil, Plus, Star } from 'lucide-react'
import { savePlan, type getPlans } from '@/server/actions/billing-admin'
import { Badge, Button, Dialog, TextInput, useToast } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'
import { fcfa } from '@/lib/billing-labels'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getPlans>>>
type Plan = Data['plans'][number]
const limit = (v: number | null, unit: string) => (v == null ? `${unit} illimités` : `${v.toLocaleString('fr-FR')} ${unit}`)

/** Forfaits par site : prix, limites et fonctionnalités, modifiables sans toucher au code. */
export function PlansView({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const current = editing === 'new' ? null : editing

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    const res = await savePlan({
      id: current?.id, code: v('code'), name: v('name'), tagline: v('tagline'), priceMonthly: v('priceMonthly'), yearlyDiscountPct: v('yearlyDiscountPct'),
      maxCounters: v('maxCounters'), maxServices: v('maxServices'), maxTicketsMonth: v('maxTicketsMonth'), smsIncluded: v('smsIncluded'),
      features: f.getAll('features').map(String), isPublic: f.get('isPublic') === 'on', isActive: f.get('isActive') === 'on', highlight: f.get('highlight') === 'on', sortOrder: v('sortOrder')
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Forfait enregistré')
    setEditing(null)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Forfaits" subtitle="Abonnement par site et par mois (HT). Les changements s’appliquent aux prochaines factures ; un prix négocié reste prioritaire."
        actions={<Button icon={<Plus size={16} />} onClick={() => setEditing('new')}>Nouveau forfait</Button>} />

      <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.plans.map(p => (
          <article key={p.id} className={cn('lift relative flex flex-col rounded-card border bg-white p-5 shadow-card', p.highlight ? 'border-brand ring-2 ring-brand/15' : 'border-surface-line', !p.isActive && 'opacity-60')}>
            {p.highlight && <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow"><Star size={12} /> Mis en avant</span>}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink">{p.name}</h2>
                {p.tagline && <p className="text-sm text-ink-muted">{p.tagline}</p>}
              </div>
              <button type="button" onClick={() => setEditing(p)} aria-label={`Modifier ${p.name}`} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100 hover:text-ink"><Pencil size={16} /></button>
            </div>
            <p className="mt-4">
              {p.priceMonthly == null ? <span className="text-2xl font-bold text-ink">Sur devis</span> : <><span className="text-3xl font-black tabular-nums text-ink">{fcfa(p.priceMonthly).replace(' FCFA', '')}</span> <span className="text-sm text-ink-muted">FCFA / site / mois</span></>}
            </p>
            {p.yearlyDiscountPct > 0 && <p className="text-xs text-success-ink">−{p.yearlyDiscountPct} % en paiement annuel</p>}
            <ul className="mt-4 space-y-1.5 text-sm text-ink">
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxCounters, 'guichets')} par site</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxServices, 'services')}</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{limit(p.maxTicketsMonth, 'tickets')} par mois</li>
              <li className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{p.smsIncluded ? `${p.smsIncluded.toLocaleString('fr-FR')} SMS inclus / site / mois` : 'SMS en packs uniquement'}</li>
              {p.features.map(f => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" />{data.features[f as keyof typeof data.features] ?? f}</li>)}
            </ul>
            <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
              <Badge tone="neutral">{p.subscribers} client{p.subscribers > 1 ? 's' : ''}</Badge>
              {!p.isPublic && <Badge tone="info">Privé</Badge>}
              {!p.isActive && <Badge tone="danger">Désactivé</Badge>}
            </div>
          </article>
        ))}
      </div>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={current ? `Modifier ${current.name}` : 'Nouveau forfait'} size="lg">
        <form key={current?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput name="name" label="Nom" required maxLength={40} defaultValue={current?.name} />
            <TextInput name="code" label="Code" maxLength={30} defaultValue={current?.code} hint="Identifiant interne ; vide = déduit du nom" />
          </div>
          <TextInput name="tagline" label="Accroche" maxLength={120} defaultValue={current?.tagline ?? ''} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput name="priceMonthly" label="Prix par site / mois (FCFA HT)" type="number" min={0} defaultValue={current?.priceMonthly ?? ''} hint="Vide = sur devis" />
            <TextInput name="yearlyDiscountPct" label="Remise annuelle (%)" type="number" min={0} max={90} defaultValue={current?.yearlyDiscountPct ?? 15} />
            <TextInput name="maxCounters" label="Guichets par site" type="number" min={1} defaultValue={current?.maxCounters ?? ''} hint="Vide = illimité" />
            <TextInput name="maxServices" label="Services par site" type="number" min={1} defaultValue={current?.maxServices ?? ''} hint="Vide = illimité" />
            <TextInput name="maxTicketsMonth" label="Tickets par site / mois" type="number" min={1} defaultValue={current?.maxTicketsMonth ?? ''} hint="Vide = illimité" />
            <TextInput name="smsIncluded" label="SMS inclus par site / mois" type="number" min={0} defaultValue={current?.smsIncluded ?? 0} />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Fonctionnalités incluses</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(data.features).map(([k, label]) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-50">
                  <input type="checkbox" name="features" value={k} defaultChecked={current?.features.includes(k) ?? ['TV', 'KIOSK'].includes(k)} className="accent-brand" /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="isActive" defaultChecked={current?.isActive ?? true} className="accent-brand" /> Actif</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isPublic" defaultChecked={current?.isPublic ?? true} className="accent-brand" /> Visible par les clients</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="highlight" defaultChecked={current?.highlight ?? false} className="accent-brand" /> Mis en avant</label>
            <label className="flex items-center gap-2">Ordre <input name="sortOrder" type="number" defaultValue={current?.sortOrder ?? data.plans.length + 1} className="w-16 rounded-lg border border-gray-200 px-2 py-1" aria-label="Ordre d’affichage" /></label>
          </div>
          <Button type="submit" fullWidth loading={busy}>Enregistrer</Button>
        </form>
      </Dialog>
    </div>
  )
}
