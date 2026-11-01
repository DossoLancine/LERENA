'use client'

import { useCallback, useEffect, useState } from 'react'
import { Monitor, Plus, Trash2 } from 'lucide-react'
import { createCounter, deleteCounter, getCounters, updateCounter } from '@/server/actions/counters'
import { Button, Card, CardHeader, EmptyState, TextInput, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'

type Data = NonNullable<Awaited<ReturnType<typeof getCounters>>>

export default function DashboardCountersPage() {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => getCounters().then(d => d && setData(d)), [])
  useEffect(() => { load() }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    const res = await createCounter(name)
    setAdding(false)
    if (!res.success) return toast(res.error ?? t('errors.generic.title'), 'error')
    setName('')
    toast(t('counters.added'))
    load()
  }

  const update = async (id: string, patch: Parameters<typeof updateCounter>[1]) => {
    // Mise à jour immédiate de l'écran, puis confirmation du serveur
    setData(d => d && { ...d, counters: d.counters.map(c => (c.id === id ? { ...c, ...patch } : c)) })
    const res = await updateCounter(id, patch)
    if (!res.success) {
      toast(res.error ?? t('errors.generic.title'), 'error')
      load()
    }
  }

  const remove = async (id: string, counterName: string) => {
    if (!confirm(t('counters.confirmDelete', { name: counterName }))) return
    setData(d => d && { ...d, counters: d.counters.filter(c => c.id !== id) })
    await deleteCounter(id)
  }

  if (!data) return <div className="h-64 animate-pulse rounded-card bg-gray-200/80" aria-busy="true" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('counters.title')} subtitle={t('counters.subtitle')} />
        <form onSubmit={add} className="flex items-end gap-3 p-5">
          <div className="flex-1">
            <TextInput label={t('counters.newName')} value={name} onChange={e => setName(e.target.value)} placeholder="Guichet 3, Caisse, Salle 2…" />
          </div>
          <Button type="submit" loading={adding} disabled={!name.trim()} icon={<Plus size={16} />}>{t('counters.add')}</Button>
        </form>
      </Card>

      {data.counters.length === 0 ? (
        <Card><EmptyState icon={<Monitor size={32} />} title={t('counters.empty')} description={t('counters.emptyText')} /></Card>
      ) : (
        data.counters.map(counter => (
          <Card key={counter.id} className={cn('p-5', !counter.isActive && 'opacity-60')}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info"><Monitor size={18} /></span>
              <input
                aria-label={t('counters.rename')}
                defaultValue={counter.name}
                onBlur={e => e.target.value.trim() && e.target.value.trim() !== counter.name && update(counter.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-base font-semibold text-ink hover:border-gray-200 focus:border-brand focus:outline-none"
              />
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" role="switch" className="h-5 w-5 accent-brand" checked={counter.isActive}
                  onChange={e => update(counter.id, { isActive: e.target.checked })} />
                {counter.isActive ? t('counters.active') : t('counters.inactive')}
              </label>
              <button onClick={() => remove(counter.id, counter.name)} aria-label={t('counters.delete')}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle hover:bg-danger-soft hover:text-danger">
                <Trash2 size={16} />
              </button>
            </div>

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('counters.services')}</p>
            <div className="flex flex-wrap gap-2">
              {data.services.map(svc => {
                const on = counter.serviceIds.includes(svc.id)
                return (
                  <button key={svc.id} aria-pressed={on}
                    onClick={() => update(counter.id, { serviceIds: on ? counter.serviceIds.filter(x => x !== svc.id) : [...counter.serviceIds, svc.id] })}
                    className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                      on ? 'border-brand bg-brand-50 text-brand-700' : 'border-gray-200 text-ink-muted hover:bg-gray-50')}>
                    {svc.name}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink-subtle">
              {counter.serviceIds.length === 0 ? t('counters.allServices') : t('counters.someServices', { count: counter.serviceIds.length })}
            </p>
          </Card>
        ))
      )}
    </div>
  )
}
