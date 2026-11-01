'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { saveSector, type getAdminSectors } from '@/server/actions/admin'
import type { SectorService } from '@/lib/platform'
import { Badge, Button, Card, CardHeader, Dialog, SelectInput, TextInput, useToast } from '@/components/ui'
import { DynamicIcon, sectorColor } from '@/lib/icons'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getAdminSectors>>>
type Sector = Data['sectors'][number]
type Draft = { id?: string; name: string; description: string; icon: string; color: string; sortOrder: number; isActive: boolean; services: SectorService[] }

const NEW_DRAFT: Draft = { name: '', description: '', icon: 'building', color: 'orange', sortOrder: 100, isActive: true, services: [{ name: '', durationMin: 15, prefix: 'A', icon: 'ticket' }] }

/** Secteurs d'activité et leurs services types : tout nouveau site d'un secteur démarre avec ces services. */
export function SectorsView({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)

  const edit = (s: Sector) => setDraft({ id: s.id, name: s.name, description: s.description ?? '', icon: s.icon, color: s.color, sortOrder: s.sortOrder, isActive: s.isActive, services: s.services.length ? s.services : NEW_DRAFT.services })
  const patch = (p: Partial<Draft>) => setDraft(d => (d ? { ...d, ...p } : d))
  const patchService = (i: number, p: Partial<SectorService>) => setDraft(d => (d ? { ...d, services: d.services.map((s, j) => (j === i ? { ...s, ...p } : s)) } : d))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft) return
    setBusy(true)
    const res = await saveSector({ ...draft, services: draft.services.filter(s => s.name.trim()) })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Secteur enregistré')
    setDraft(null)
    router.refresh()
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Secteurs d’activité"
          subtitle="Filtres de l’application, pictogrammes et services proposés à la création d’un site"
          action={<Button size="sm" icon={<Plus size={16} />} onClick={() => setDraft(NEW_DRAFT)}>Nouveau secteur</Button>}
        />
        <ul className="stagger divide-y divide-surface-line">
          {data.sectors.map(s => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', sectorColor(s.color).soft)}>
                <DynamicIcon name={s.icon} size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  {s.name}
                  {!s.isActive && <Badge>Masqué</Badge>}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {s.organizations} établissement{s.organizations > 1 ? 's' : ''} · {s.services.map(sv => sv.name).join(', ') || 'aucun service type'}
                </p>
              </div>
              <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => edit(s)} aria-label={`Modifier ${s.name}`}>Modifier</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? `Secteur — ${draft.name}` : 'Nouveau secteur'} size="lg">
        {draft && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Nom" required maxLength={60} value={draft.name} onChange={e => patch({ name: e.target.value })} />
              <TextInput label="Ordre d’affichage" type="number" value={draft.sortOrder} onChange={e => patch({ sortOrder: Number(e.target.value) })} />
            </div>
            <TextInput label="Description" maxLength={160} value={draft.description} onChange={e => patch({ description: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectInput label="Pictogramme" value={draft.icon} onChange={e => patch({ icon: e.target.value })}>
                {data.icons.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
              </SelectInput>
              <SelectInput label="Couleur" value={draft.color} onChange={e => patch({ color: e.target.value })}>
                {data.colors.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </SelectInput>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={draft.isActive} onChange={e => patch({ isActive: e.target.checked })} className="h-4 w-4 accent-brand" />
              Visible dans l’application (filtres et création de sites)
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Services types</legend>
              {draft.services.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_72px_64px_auto] items-end gap-2 sm:grid-cols-[1fr_88px_72px_150px_auto]">
                  <TextInput label="Service" value={s.name} maxLength={60} onChange={e => patchService(i, { name: e.target.value })} />
                  <TextInput label="Durée (min)" type="number" min={1} max={240} value={s.durationMin} onChange={e => patchService(i, { durationMin: Number(e.target.value) })} />
                  <TextInput label="Préfixe" value={s.prefix} maxLength={3} onChange={e => patchService(i, { prefix: e.target.value.toUpperCase() })} />
                  <div className="hidden sm:block">
                    <SelectInput label="Pictogramme" value={s.icon ?? ''} onChange={e => patchService(i, { icon: e.target.value || undefined })}>
                      <option value="">Celui du secteur</option>
                      {data.icons.map(ic => <option key={ic.key} value={ic.key}>{ic.label}</option>)}
                    </SelectInput>
                  </div>
                  <button type="button" onClick={() => patch({ services: draft.services.filter((_, j) => j !== i) })}
                    aria-label={`Retirer le service ${s.name || i + 1}`} className="mb-1 flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-danger-soft hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={<Plus size={15} />} onClick={() => patch({ services: [...draft.services, { name: '', durationMin: 15, prefix: 'A' }] })}>
                Ajouter un service
              </Button>
            </fieldset>

            <Button type="submit" fullWidth loading={busy}>Enregistrer</Button>
          </form>
        )}
      </Dialog>
    </>
  )
}
