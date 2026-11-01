'use client'

import { useMemo, useState } from 'react'
import { Plus, UserPlus, Wand2, Users, Clock, CheckCircle2, Building2, Star } from 'lucide-react'
import { getNetworkOverview, createNetworkSite, addSiteManager, applyTemplateToSite } from '@/server/actions/network'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, SelectInput, StatCard, TextInput, useToast } from '@/components/ui'
import { CredentialsNotice } from '@/components/admin/credentials-notice'
import { DynamicIcon, sectorColor } from '@/lib/icons'
import { usePolling } from '@/hooks/use-polling'
import { cn } from '@/lib/cn'

type Overview = NonNullable<Awaited<ReturnType<typeof getNetworkOverview>>>
type Site = Overview['sites'][number]
type SortKey = 'waiting' | 'served' | 'wait' | 'name'

const fr = (n: number | null, suffix = '') => (n == null ? '—' : `${n.toLocaleString('fr-FR')}${suffix}`)

export function SitesView({ initial }: { initial: Overview }) {
  const toast = useToast()
  const [data, setData] = useState(initial)
  const [sort, setSort] = useState<SortKey>('waiting')
  const [showNew, setShowNew] = useState(false)
  const [managerFor, setManagerFor] = useState<Site | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => { const next = await getNetworkOverview(); if (next) setData(next) }
  usePolling(refresh, 30_000)

  const sites = useMemo(() => {
    const list = [...data.sites]
    if (sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    if (sort === 'served') return list.sort((a, b) => b.today.served - a.today.served)
    if (sort === 'wait') return list.sort((a, b) => (b.today.avgWaitMin ?? -1) - (a.today.avgWaitMin ?? -1))
    return list.sort((a, b) => b.today.waitingNow - a.today.waitingNow)
  }, [data.sites, sort])

  const totals = useMemo(() => {
    const t = data.sites.reduce((acc, s) => ({
      open: acc.open + (s.isActive ? 1 : 0),
      waiting: acc.waiting + s.today.waitingNow,
      served: acc.served + s.today.served,
      waitSum: acc.waitSum + (s.today.avgWaitMin ?? 0) * s.today.tickets,
      waitWeight: acc.waitWeight + (s.today.avgWaitMin != null ? s.today.tickets : 0)
    }), { open: 0, waiting: 0, served: 0, waitSum: 0, waitWeight: 0 })
    return { ...t, avgWait: t.waitWeight ? Math.round((t.waitSum / t.waitWeight) * 10) / 10 : null }
  }, [data.sites])

  const createSite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await createNetworkSite({
      name: String(f.get('name') ?? ''),
      sectorId: String(f.get('sectorId') ?? ''),
      city: String(f.get('city') ?? ''),
      address: String(f.get('address') ?? '')
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast(`Site créé avec ${res.services} service${res.services > 1 ? 's' : ''}`)
    setShowNew(false)
    refresh()
  }

  const createManager = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!managerFor) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await addSiteManager(managerFor.id, {
      name: String(f.get('name') ?? ''),
      email: String(f.get('email') ?? ''),
      phone: String(f.get('phone') ?? '')
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setCredentials({ email: res.email, password: res.tempPassword })
    setManagerFor(null)
    refresh()
  }

  const applyTemplate = async (site: Site) => {
    const res = await applyTemplateToSite(site.id)
    if (!res.success) return toast(res.error, 'error')
    toast(res.added ? `${res.added} service(s) ajouté(s) à ${site.name}` : `${site.name} a déjà tous les services du secteur`)
  }

  return (
    <>
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sites ouverts" value={`${totals.open}/${data.sites.length}`} icon={<Building2 size={18} className="text-brand" aria-hidden="true" />} />
        <StatCard label="En attente maintenant" value={fr(totals.waiting)} icon={<Users size={18} className="text-info" aria-hidden="true" />} />
        <StatCard label="Servis aujourd’hui" value={fr(totals.served)} icon={<CheckCircle2 size={18} className="text-success" aria-hidden="true" />} />
        <StatCard label="Attente moyenne du jour" value={fr(totals.avgWait, ' min')} icon={<Clock size={18} className="text-warning" aria-hidden="true" />} />
      </div>

      {credentials && <CredentialsNotice email={credentials.email} password={credentials.password} onDone={() => setCredentials(null)} />}

      <Card>
        <CardHeader
          title="Sites du réseau"
          subtitle="Activité du jour, actualisée toutes les 30 secondes"
          action={data.canEdit && <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Nouveau site</Button>}
        />
        <div className="flex items-center justify-end gap-2 border-b border-surface-line px-5 py-2">
          <label htmlFor="sort" className="text-xs text-ink-muted">Trier par</label>
          <select id="sort" value={sort} onChange={e => setSort(e.target.value as SortKey)} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-ink">
            <option value="waiting">Affluence</option>
            <option value="served">Personnes servies</option>
            <option value="wait">Attente moyenne</option>
            <option value="name">Nom</option>
          </select>
        </div>

        {sites.length === 0 ? (
          <EmptyState icon={<Building2 size={40} />} title="Aucun site pour l’instant"
            description={data.canEdit ? 'Créez le premier site : ses services sont préparés d’après son secteur.' : 'L’administrateur du réseau n’a pas encore ajouté de site.'} />
        ) : (
          <ul className="stagger divide-y divide-surface-line">
            {sites.map((site, i) => (
              <li key={site.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-ink-subtle">{i + 1}</span>
                  <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', sectorColor(site.color).soft)}>
                    <DynamicIcon name={site.icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-ink">{site.name}</p>
                      <Badge tone={site.isActive ? 'success' : 'neutral'} dot>{site.isActive ? 'Ouvert' : 'Fermé'}</Badge>
                    </div>
                    <p className="truncate text-xs text-ink-muted">
                      {[site.category, site.city].filter(Boolean).join(' · ')}
                      {' · '}
                      {site.managers.length ? `Responsable : ${site.managers.join(', ')}` : <span className="font-medium text-warning-ink">Sans responsable</span>}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-4 gap-2 text-center md:w-[360px]">
                  <div><dt className="text-[11px] text-ink-muted">En attente</dt><dd className="font-bold tabular-nums text-ink">{site.today.waitingNow}</dd></div>
                  <div><dt className="text-[11px] text-ink-muted">Servis</dt><dd className="font-bold tabular-nums text-ink">{site.today.served}</dd></div>
                  <div><dt className="text-[11px] text-ink-muted">Attente</dt><dd className="font-bold tabular-nums text-ink">{fr(site.today.avgWaitMin, ' min')}</dd></div>
                  <div><dt className="text-[11px] text-ink-muted">Satisfaction</dt><dd className="flex items-center justify-center gap-0.5 font-bold tabular-nums text-ink">{site.today.satisfaction != null && <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />}{fr(site.today.satisfaction)}</dd></div>
                </dl>

                {data.canEdit && (
                  <div className="flex gap-2 md:w-auto">
                    <Button size="sm" variant="secondary" icon={<UserPlus size={15} />} onClick={() => setManagerFor(site)} aria-label={`Ajouter un responsable à ${site.name}`}>Responsable</Button>
                    <Button size="sm" variant="ghost" icon={<Wand2 size={15} />} onClick={() => applyTemplate(site)} title="Ajouter les services standard du secteur" aria-label={`Compléter les services de ${site.name}`}>Services</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={showNew} onClose={() => setShowNew(false)} title="Nouveau site">
        <form onSubmit={createSite} className="space-y-4">
          <TextInput name="name" label="Nom du site" required maxLength={80} placeholder="Ex : Agence de Cocody" />
          <SelectInput name="sectorId" label="Secteur" required defaultValue="" hint="Les services, préfixes de tickets et pictogrammes du secteur sont créés automatiquement.">
            <option value="" disabled>Choisir…</option>
            {data.sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
          <TextInput name="city" label="Ville" maxLength={60} />
          <TextInput name="address" label="Adresse" maxLength={120} />
          <Button type="submit" fullWidth loading={busy}>Créer le site</Button>
        </form>
      </Dialog>

      <Dialog open={!!managerFor} onClose={() => setManagerFor(null)} title={`Responsable — ${managerFor?.name ?? ''}`}>
        <form onSubmit={createManager} className="space-y-4">
          <TextInput name="name" label="Nom complet" required maxLength={80} />
          <TextInput name="email" type="email" label="E-mail" required hint="Un mot de passe provisoire sera généré et affiché une seule fois." />
          <TextInput name="phone" type="tel" label="Téléphone (facultatif)" />
          <Button type="submit" fullWidth loading={busy}>Créer le compte</Button>
        </form>
      </Dialog>
    </>
  )
}
