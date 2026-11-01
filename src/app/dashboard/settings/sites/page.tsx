'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, MapPin, Users } from 'lucide-react'
import { createSite, deleteSite, getSitesOverview, setActiveSite, updateSite } from '@/server/actions/sites'
import { Badge, Button, Card, CardHeader, Dialog, TextInput, useToast } from '@/components/ui'

type Overview = NonNullable<Awaited<ReturnType<typeof getSitesOverview>>>
type Site = Overview['sites'][number]

/** Sites de l'établissement : chacun a ses services, guichets, horaires, écrans et file d'attente. */
export default function SitesSettingsPage() {
  const toast = useToast()
  const [data, setData] = useState<Overview | null>(null)
  const [editing, setEditing] = useState<Site | 'new' | null>(null)
  const [copy, setCopy] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => getSitesOverview().then(setData), [])
  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const values = { name: String(f.get('name') ?? ''), address: String(f.get('address') ?? ''), city: String(f.get('city') ?? ''), phone: String(f.get('phone') ?? '') }
    setBusy(true)
    const res = editing === 'new' ? await createSite({ ...values, copyServices: copy }) : await updateSite((editing as Site).id, values)
    setBusy(false)
    if (!res.success) return toast(res.error ?? 'Enregistrement impossible', 'error')
    toast(editing === 'new' ? 'Site créé' : 'Site mis à jour')
    setEditing(null)
    load()
  }

  const remove = async (site: Site) => {
    if (!confirm(`Supprimer le site « ${site.name} » ? Ses services, guichets et horaires seront supprimés.`)) return
    const res = await deleteSite(site.id)
    if (!res.success) return toast(res.error ?? 'Suppression impossible', 'error')
    toast('Site supprimé')
    load()
  }

  const toggle = async (site: Site) => {
    await updateSite(site.id, { isActive: !site.isActive })
    load()
  }

  const workOn = async (site: Site) => {
    await setActiveSite(site.id)
    window.location.href = '/dashboard'
  }

  if (!data) return <div className="h-64 rounded-card shimmer" />
  const current = editing && editing !== 'new' ? editing : null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Sites" subtitle="Agences, antennes, bâtiments : chaque site a ses services, guichets, horaires, écrans et sa propre file."
          action={data.canManage && <Button size="sm" icon={<Plus size={16} />} onClick={() => { setCopy(true); setEditing('new') }}>Nouveau site</Button>} />
        <ul className="stagger divide-y divide-surface-line">
          {data.sites.map(site => (
            <li key={site.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {site.name}
                  {data.activeId === site.id && <Badge tone="brand">Site actif</Badge>}
                  {!site.isActive && <Badge>Fermé</Badge>}
                </p>
                <p className="flex items-center gap-1 text-xs text-ink-muted"><MapPin size={12} aria-hidden="true" />{[site.address, site.city].filter(Boolean).join(', ') || 'Adresse à compléter'}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                  {site.services} service{site.services > 1 ? 's' : ''} · {site.counters} guichet{site.counters > 1 ? 's' : ''} · {site.devices} appareil{site.devices > 1 ? 's' : ''} · <Users size={11} aria-hidden="true" /> {site.waiting} en attente
                </p>
              </div>
              {data.canManage && (
                <div className="flex flex-wrap gap-2">
                  {data.activeId !== site.id && <Button size="sm" variant="secondary" onClick={() => workOn(site)}>Travailler sur ce site</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(site)}>Modifier</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(site)}>{site.isActive ? 'Fermer' : 'Rouvrir'}</Button>
                  {data.sites.length > 1 && (
                    <button type="button" onClick={() => remove(site)} aria-label={`Supprimer ${site.name}`} className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} /></button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-ink-muted">Le site actif se choisit aussi en haut du tableau de bord. Services, guichets, horaires, planning et appareils se règlent site par site ; « Tous les sites » donne une vue d’ensemble.</p>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouveau site' : `Modifier — ${current?.name ?? ''}`}>
        {editing && (
          <form onSubmit={submit} className="space-y-4">
            <TextInput name="name" label="Nom du site" required maxLength={60} defaultValue={current?.name ?? ''} placeholder="Ex : Agence de Yopougon" />
            <TextInput name="address" label="Adresse" maxLength={120} defaultValue={current?.address ?? ''} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="city" label="Ville" maxLength={60} defaultValue={current?.city ?? ''} />
              <TextInput name="phone" label="Téléphone" type="tel" maxLength={30} defaultValue={current?.phone ?? ''} />
            </div>
            {editing === 'new' && (
              <label className="flex items-start gap-3 text-sm text-ink">
                <input type="checkbox" checked={copy} onChange={e => setCopy(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                <span>Reprendre les services et les files du site actif<span className="block text-xs text-ink-muted">Vous pourrez les ajuster ensuite dans « Services ».</span></span>
              </label>
            )}
            <Button type="submit" fullWidth loading={busy}>{editing === 'new' ? 'Créer le site' : 'Enregistrer'}</Button>
          </form>
        )}
      </Dialog>
    </div>
  )
}
