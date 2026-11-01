'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Building2, ArrowRight, ArrowLeft, Sparkles, ChevronRight } from 'lucide-react'
import { onboardOrganization, setOrganizationNetwork, type getAdminOrganizations } from '@/server/actions/admin'
import type { getClients } from '@/server/actions/billing-admin'
import { StateBadge, PageHeader } from '@/components/billing/badges'
import { fcfa, STATE_LABELS } from '@/lib/billing-labels'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, SelectInput, TextInput, useToast } from '@/components/ui'
import { CredentialsNotice } from '@/components/admin/credentials-notice'
import { DynamicIcon, sectorColor } from '@/lib/icons'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getAdminOrganizations>>>
type Billing = NonNullable<Awaited<ReturnType<typeof getClients>>>
type StateFilter = 'ALL' | keyof typeof STATE_LABELS

const EMPTY_FORM = { name: '', sectorId: '', networkId: '', city: '', address: '', phone: '', managerName: '', managerEmail: '', managerPhone: '' }

/** Liste des clients : forfait, état de l'abonnement, revenu mensuel et activité ; mise en service d'un nouveau client. */
export function OrganizationsView({ data, billing }: { data: Data; billing: Billing }) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL')
  const billingById = useMemo(() => new Map(billing.clients.map(c => [c.id, c])), [billing.clients])
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(null)

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  const orgs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.orgs
      .filter(o => !q || [o.name, o.city, o.category, o.networkName, billingById.get(o.id)?.planName].some(v => v?.toLowerCase().includes(q)))
      .filter(o => stateFilter === 'ALL' || billingById.get(o.id)?.state === stateFilter)
  }, [data.orgs, query, stateFilter, billingById])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const b of billing.clients) c[b.state] = (c[b.state] ?? 0) + 1
    return c
  }, [billing.clients])

  const close = () => { setOpen(false); setStep(1); setForm(EMPTY_FORM) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1) return setStep(2)
    setBusy(true)
    const res = await onboardOrganization({
      name: form.name, sectorId: form.sectorId, networkId: form.networkId || null,
      city: form.city, address: form.address, phone: form.phone,
      manager: { name: form.managerName, email: form.managerEmail, phone: form.managerPhone }
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast(`${form.name} est en service (${res.services} services)`)
    setCredentials({ email: res.email, password: res.tempPassword })
    close()
    router.refresh()
  }

  const changeNetwork = async (orgId: string, networkId: string) => {
    const res = await setOrganizationNetwork(orgId, networkId || null)
    if (!res.success) return toast(res.error, 'error')
    toast('Réseau mis à jour')
    router.refresh()
  }

  return (
    <>
      {credentials && <CredentialsNotice email={credentials.email} password={credentials.password} onDone={() => setCredentials(null)} />}

      <PageHeader title="Clients" subtitle={`${data.orgs.length} établissements · forfait, abonnement et activité sur 30 jours`}
        actions={<Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>Mettre en service</Button>} />

      <Card>
        <div className="flex flex-wrap gap-1.5 border-b border-surface-line px-5 py-3" role="group" aria-label="Filtrer par état">
          {(['ALL', 'TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'CANCELLED'] as StateFilter[]).map(f => (
            <button key={f} type="button" onClick={() => setStateFilter(f)} aria-pressed={stateFilter === f}
              className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-all', stateFilter === f ? 'bg-ink text-white shadow-sm' : 'bg-gray-100 text-ink-muted hover:bg-gray-200')}>
              {f === 'ALL' ? 'Tous' : STATE_LABELS[f][0]} <span className="opacity-60">{f === 'ALL' ? billing.clients.length : counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="border-b border-surface-line px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Rechercher un établissement</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, ville, secteur, réseau ou forfait"
              className="w-full rounded-control border border-gray-200 py-2 pl-9 pr-3 text-sm text-ink" />
          </label>
        </div>

        {orgs.length === 0 ? (
          <EmptyState icon={<Building2 size={40} />} title="Aucun établissement trouvé" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Établissement</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Forfait</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Abonnement</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Revenu / mois</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Réseau</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Tickets 30 j</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">En attente</th>
                  <th scope="col" className="w-8 px-3"><span className="sr-only">Ouvrir</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {orgs.map(o => {
                  const b = billingById.get(o.id)
                  return (
                  <tr key={o.id} className="group cursor-pointer transition-colors hover:bg-brand-50/50" onClick={e => { if (!(e.target as HTMLElement).closest('select,a,button')) router.push(`/admin/clients/${o.id}`) }}>
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', sectorColor(o.color).soft)}>
                          <DynamicIcon name={o.icon} size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            <Link href={`/admin/clients/${o.id}`} className="hover:text-brand">{o.name}</Link>
                            {b?.featured && <Sparkles size={14} className="text-warning" aria-label="Mis en avant" />}
                            <Badge tone={o.isActive ? 'success' : 'neutral'}>{o.isActive ? 'Ouvert' : 'Fermé'}</Badge>
                          </p>
                          <p className="text-xs text-ink-muted">{[o.category, o.city].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3 font-medium text-ink">{b?.planName ?? '—'}<span className="block text-xs font-normal text-ink-subtle">{b ? `${b.sites} site${b.sites > 1 ? 's' : ''}${b.cycle === 'YEARLY' ? ' · annuel' : ''}` : ''}</span></td>
                    <td className="px-3 py-3">{b && <StateBadge state={b.state} daysLeft={b.daysLeft} />}{b && b.due > 0 && <span className={cn('mt-1 block text-xs', b.overdue ? 'font-semibold text-danger' : 'text-ink-subtle')}>{fcfa(b.due)} à régler</span>}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{b?.mrr ? fcfa(b.mrr) : <span className="font-normal text-ink-subtle">—</span>}</td>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`net-${o.id}`}>Réseau de {o.name}</label>
                      <select id={`net-${o.id}`} value={o.networkId ?? ''} onChange={e => changeNetwork(o.id, e.target.value)}
                        className="max-w-[180px] rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-ink">
                        <option value="">Indépendant</option>
                        {data.networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.tickets30d.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{o.waitingNow}</td>
                    <td className="px-3 py-3 text-ink-subtle"><ChevronRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onClose={close} title={step === 1 ? 'Mise en service — 1/2 : l’établissement' : 'Mise en service — 2/2 : le responsable'}>
        <form onSubmit={submit} className="space-y-4">
          {step === 1 ? (
            <>
              <TextInput label="Nom de l’établissement" required maxLength={80} value={form.name} onChange={set('name')} />
              <SelectInput label="Secteur" required value={form.sectorId} onChange={set('sectorId')} hint="Les services standard du secteur sont créés automatiquement ; le responsable pourra les ajuster.">
                <option value="" disabled>Choisir…</option>
                {data.sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectInput>
              <SelectInput label="Réseau" value={form.networkId} onChange={set('networkId')}>
                <option value="">Indépendant</option>
                {data.networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </SelectInput>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Ville" maxLength={60} value={form.city} onChange={set('city')} />
                <TextInput label="Téléphone" type="tel" value={form.phone} onChange={set('phone')} />
              </div>
              <TextInput label="Adresse" maxLength={120} value={form.address} onChange={set('address')} />
              <Button type="submit" fullWidth icon={<ArrowRight size={16} />}>Continuer</Button>
            </>
          ) : (
            <>
              <TextInput label="Nom du responsable" required maxLength={80} value={form.managerName} onChange={set('managerName')} />
              <TextInput label="E-mail" type="email" required value={form.managerEmail} onChange={set('managerEmail')} hint="Un mot de passe provisoire sera affiché une seule fois." />
              <TextInput label="Téléphone (facultatif)" type="tel" value={form.managerPhone} onChange={set('managerPhone')} />
              <div className="flex gap-2">
                <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => setStep(1)}>Retour</Button>
                <Button type="submit" fullWidth loading={busy}>Mettre en service</Button>
              </div>
            </>
          )}
        </form>
      </Dialog>
    </>
  )
}
