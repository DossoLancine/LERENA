'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Building2, ArrowRight, ArrowLeft } from 'lucide-react'
import { onboardOrganization, setOrganizationNetwork, type getAdminOrganizations } from '@/server/actions/admin'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, SelectInput, TextInput, useToast } from '@/components/ui'
import { CredentialsNotice } from '@/components/admin/credentials-notice'
import { DynamicIcon, sectorColor } from '@/lib/icons'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getAdminOrganizations>>>

const EMPTY_FORM = { name: '', sectorId: '', networkId: '', city: '', address: '', phone: '', managerName: '', managerEmail: '', managerPhone: '' }

export function OrganizationsView({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(null)

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  const orgs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? data.orgs.filter(o => [o.name, o.city, o.category, o.networkName].some(v => v?.toLowerCase().includes(q))) : data.orgs
  }, [data.orgs, query])

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

      <Card>
        <CardHeader
          title={`Établissements (${data.orgs.length})`}
          subtitle="Activité sur 30 jours"
          action={<Button size="sm" icon={<Plus size={16} />} onClick={() => setOpen(true)}>Mettre en service</Button>}
        />
        <div className="border-b border-surface-line px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Rechercher un établissement</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, ville, secteur ou réseau"
              className="w-full rounded-control border border-gray-200 py-2 pl-9 pr-3 text-sm text-ink" />
          </label>
        </div>

        {orgs.length === 0 ? (
          <EmptyState icon={<Building2 size={40} />} title="Aucun établissement trouvé" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">Établissement</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Réseau</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Équipe</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Appareils</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Tickets 30 j</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">En attente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-line">
                {orgs.map(o => (
                  <tr key={o.id}>
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', sectorColor(o.color).soft)}>
                          <DynamicIcon name={o.icon} size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-ink">
                            {o.name}
                            <Badge tone={o.isActive ? 'success' : 'neutral'}>{o.isActive ? 'Ouvert' : 'Fermé'}</Badge>
                          </p>
                          <p className="text-xs text-ink-muted">{[o.category, o.city].filter(Boolean).join(' · ')}</p>
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3">
                      <label className="sr-only" htmlFor={`net-${o.id}`}>Réseau de {o.name}</label>
                      <select id={`net-${o.id}`} value={o.networkId ?? ''} onChange={e => changeNetwork(o.id, e.target.value)}
                        className="max-w-[180px] rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-ink">
                        <option value="">Indépendant</option>
                        {data.networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.members}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.devices}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{o.tickets30d.toLocaleString('fr-FR')}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{o.waitingNow}</td>
                  </tr>
                ))}
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
