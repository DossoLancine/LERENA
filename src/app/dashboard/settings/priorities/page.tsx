'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown, Accessibility, Siren, Smartphone, Tablet } from 'lucide-react'
import { listPriorityCategories, savePriorityCategory, deletePriorityCategory, movePriorityCategory, getVisitorPrioritySettings, setVisitorPriority } from '@/server/actions/priorities'
import { Button, Card, CardHeader, EmptyState, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Category = NonNullable<Awaited<ReturnType<typeof listPriorityCategories>>>[number]

/** Motifs de priorité de l'établissement : chaque structure décide qui passe devant. */
export default function PrioritiesSettingsPage() {
  const toast = useToast()
  const [items, setItems] = useState<Category[] | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [visitor, setVisitor] = useState<{ visitorPriorityApp: boolean; visitorPriorityKiosk: boolean } | null>(null)

  useEffect(() => { getVisitorPrioritySettings().then(setVisitor) }, [])

  const toggleVisitor = async (channel: 'app' | 'kiosk', enabled: boolean) => {
    setVisitor(v => v && { ...v, [channel === 'app' ? 'visitorPriorityApp' : 'visitorPriorityKiosk']: enabled })
    const res = await setVisitorPriority(channel, enabled)
    toast(res.success ? (enabled ? 'Choix de priorité activé' : 'Choix de priorité désactivé') : 'Enregistrement impossible', res.success ? 'success' : 'error')
  }

  const load = useCallback(() => listPriorityCategories().then(list => setItems(list ?? [])), [])
  useEffect(() => { load() }, [load])

  const save = async (item: Category, patch: Partial<Category>) => {
    const next = { ...item, ...patch }
    setItems(list => list?.map(x => (x.id === item.id ? next : x)) ?? null)
    const res = await savePriorityCategory(next)
    if (!res.success) { toast(res.error ?? 'Enregistrement impossible', 'error'); load() }
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await savePriorityCategory({ label: newLabel, level: 2, selfService: true, isActive: true })
    if (!res.success) return toast(res.error ?? 'Ajout impossible', 'error')
    setNewLabel('')
    toast('Motif ajouté')
    load()
  }

  const remove = async (item: Category) => {
    if (!confirm(`Supprimer le motif « ${item.label} » ? Les tickets déjà émis gardent leur priorité.`)) return
    setItems(list => list?.filter(x => x.id !== item.id) ?? null)
    await deletePriorityCategory(item.id)
    toast('Motif supprimé')
  }

  const move = async (item: Category, direction: -1 | 1) => {
    await movePriorityCategory(item.id, direction)
    load()
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 text-sm leading-relaxed text-ink">
        <h2 className="text-base font-bold">Priorités</h2>
        <p className="mt-1 text-ink-muted">
          Définissez qui passe devant dans vos files. Dans chaque file, les tickets <strong>très prioritaires</strong> passent d’abord,
          puis les <strong>prioritaires</strong>, puis tous les autres dans l’ordre d’arrivée.
          Un visiteur transféré vers un autre service se place derrière la dernière personne arrivée dans ce service, sauf s’il a une priorité.
        </p>
        <p className="mt-2 text-ink-muted">
          Par défaut, seul l’agent d’accueil attribue une priorité, sur place. Vous pouvez aussi laisser le visiteur la choisir lui-même, dans l’application ou à la borne — avec le risque que certains en abusent.
          Sur la TV, le motif n’est jamais affiché, seulement la mention « Prioritaire ».
        </p>
      </Card>

      <Card>
        <CardHeader title="Le visiteur peut-il choisir sa priorité ?" subtitle="Désactivé : la priorité s’attribue uniquement à l’accueil" />
        <div className="divide-y divide-surface-line">
          {([['app', Smartphone, 'Dans l’application mobile', 'Au moment de prendre un ticket depuis son téléphone'], ['kiosk', Tablet, 'Sur la borne', 'Un écran « priorité » apparaît après le choix du service']] as const).map(([channel, Icon, title, hint]) => {
            const on = channel === 'app' ? visitor?.visitorPriorityApp : visitor?.visitorPriorityKiosk
            return (
              <label key={channel} className="flex cursor-pointer items-center gap-4 px-5 py-4">
                <Icon size={22} className="shrink-0 text-ink-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="block text-xs text-ink-muted">{hint}</span>
                </span>
                <input type="checkbox" role="switch" checked={!!on} disabled={!visitor} aria-label={title}
                  onChange={e => toggleVisitor(channel, e.target.checked)} className="peer sr-only" />
                <span aria-hidden="true" className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2', on ? 'bg-brand' : 'bg-gray-300')}>
                  <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring', on ? 'translate-x-6' : 'translate-x-1')} />
                </span>
              </label>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Motifs de priorité" subtitle="Dans l’ordre où ils sont proposés" />
        {items === null ? (
          <div className="m-5 h-24 rounded-card shimmer" />
        ) : items.length === 0 ? (
          <EmptyState title="Aucun motif" description="Sans motif, tout le monde est servi dans l’ordre d’arrivée." />
        ) : (
          <ul className="stagger divide-y divide-surface-line">
            {items.map((item, i) => (
              <li key={item.id} className={cn('space-y-3 px-5 py-4', !item.isActive && 'opacity-60')}>
                <div className="flex items-center gap-2">
                  {item.level >= 3 ? <Siren size={18} className="shrink-0 text-danger" aria-hidden="true" /> : <Accessibility size={18} className="shrink-0 text-info" aria-hidden="true" />}
                  <label className="sr-only" htmlFor={`label-${item.id}`}>Nom du motif</label>
                  <input id={`label-${item.id}`} defaultValue={item.label} maxLength={60}
                    onBlur={e => e.target.value.trim() && e.target.value !== item.label && save(item, { label: e.target.value })}
                    className="min-w-0 flex-1 rounded-control border border-transparent px-2 py-1.5 font-semibold text-ink hover:border-gray-200 focus:border-brand" />
                  <button type="button" onClick={() => move(item, -1)} disabled={i === 0} aria-label={`Monter ${item.label}`} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100 disabled:opacity-30"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => move(item, 1)} disabled={i === items.length - 1} aria-label={`Descendre ${item.label}`} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100 disabled:opacity-30"><ArrowDown size={16} /></button>
                  <button type="button" onClick={() => remove(item)} aria-label={`Supprimer ${item.label}`} className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} /></button>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-7 text-sm">
                  <label className="flex items-center gap-2">
                    <span className="text-ink-muted">Niveau</span>
                    <select value={item.level} onChange={e => save(item, { level: Number(e.target.value) })} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-ink">
                      <option value={2}>Prioritaire</option>
                      <option value={3}>Très prioritaire</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-ink">
                    <input type="checkbox" checked={item.selfService} onChange={e => save(item, { selfService: e.target.checked })} className="h-4 w-4 accent-brand" />
                    Proposé aux visiteurs
                  </label>
                  <label className="flex items-center gap-2 text-ink">
                    <input type="checkbox" checked={item.isActive} onChange={e => save(item, { isActive: e.target.checked })} className="h-4 w-4 accent-brand" />
                    Actif
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex gap-2 border-t border-surface-line p-5">
          <label className="sr-only" htmlFor="new-priority">Nouveau motif</label>
          <input id="new-priority" value={newLabel} onChange={e => setNewLabel(e.target.value)} maxLength={60}
            placeholder="Nouveau motif (ex. Parent avec bébé)"
            className="min-w-0 flex-1 rounded-control border border-gray-200 px-4 text-sm text-ink" />
          <Button type="submit" icon={<Plus size={16} />} disabled={!newLabel.trim()}>Ajouter</Button>
        </form>
      </Card>
    </div>
  )
}
