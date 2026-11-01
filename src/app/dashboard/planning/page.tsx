'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Copy, Trash2, Monitor } from 'lucide-react'
import { addShift, copyPreviousWeek, deleteShift, getWeekPlanning } from '@/server/actions/planning'
import { Button, Card, Dialog, SelectInput, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'

type Planning = NonNullable<Awaited<ReturnType<typeof getWeekPlanning>>>

const iso = (d: Date) => d.toISOString().slice(0, 10)

// Lundi de la semaine contenant la date (UTC = heure d'Abidjan)
function mondayOf(d: Date) {
  const day = d.getUTCDay() || 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 1))
}

// Couleur stable par agent, pour repérer chacun d'un coup d'œil
const COLORS = ['bg-brand-100 text-brand-700', 'bg-info-soft text-info-ink', 'bg-success-soft text-success-ink', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-warning-soft text-warning-ink']

export default function DashboardPlanningPage() {
  const toast = useToast()
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const [data, setData] = useState<Planning | null>(null)
  const [addFor, setAddFor] = useState<string | null>(null)
  const [form, setForm] = useState({ userId: '', counterId: '', startTime: '08:00', endTime: '13:00' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => getWeekPlanning(iso(monday)).then(setData), [monday])
  useEffect(() => { setData(null); load() }, [load])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86400_000)), [monday])
  const today = iso(new Date())
  const colorOf = (userId: string) => COLORS[Math.max(0, data?.staff.findIndex(s => s.id === userId) ?? 0) % COLORS.length]

  const openAdd = (day: string) => {
    setForm(f => ({ ...f, userId: f.userId || data?.staff[0]?.id || '' }))
    setAddFor(day)
  }

  const save = async () => {
    if (!addFor) return
    setSaving(true)
    const res = await addShift({ ...form, counterId: form.counterId || null, date: addFor })
    setSaving(false)
    if (!res.success) return toast(res.error ?? t('errors.generic.title'), 'error')
    setAddFor(null)
    toast(t('planning.added'))
    load()
  }

  const remove = async (id: string) => {
    setData(d => d && { ...d, shifts: d.shifts.filter(s => s.id !== id) })
    const res = await deleteShift(id)
    if (!res.success) load()
  }

  const copyWeek = async () => {
    const res = await copyPreviousWeek(iso(monday))
    toast(res.success ? t('planning.copied', { count: res.count }) : res.error ?? t('planning.nothingToCopy'), res.success ? 'success' : 'error')
    load()
  }

  const weekLabel = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}`

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonday(m => new Date(m.getTime() - 7 * 86400_000))} aria-label={t('planning.prevWeek')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:scale-95"><ChevronLeft size={18} /></button>
          <div className="min-w-[180px] text-center">
            <p className="text-xs text-ink-muted">{t('planning.title')}</p>
            <p className="font-bold text-ink">{weekLabel}</p>
          </div>
          <button onClick={() => setMonday(m => new Date(m.getTime() + 7 * 86400_000))} aria-label={t('planning.nextWeek')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:scale-95"><ChevronRight size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => setMonday(mondayOf(new Date()))}>{t('planning.thisWeek')}</Button>
          <Button variant="secondary" size="sm" className="whitespace-nowrap" icon={<Copy size={14} />} onClick={copyWeek}>{t('planning.copyPrevious')}</Button>
        </div>
      </Card>

      {!data ? (
        <div className="h-96 animate-pulse rounded-card bg-gray-200/80" aria-busy="true" />
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map(d => {
            const key = iso(d)
            const dayShifts = data.shifts.filter(s => s.date === key)
            return (
              <Card key={key} className={cn('flex flex-col p-3', key === today && 'ring-2 ring-brand')}>
                <div className="mb-2 flex items-center justify-between md:flex-col md:items-start">
                  <p className="text-sm font-bold capitalize text-ink">
                    {d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' })} <span className="font-normal text-ink-muted">{d.getUTCDate()}</span>
                  </p>
                </div>
                <ul className="flex-1 space-y-1.5">
                  {dayShifts.length === 0 && <li className="text-xs text-ink-subtle">{t('planning.noShift')}</li>}
                  {dayShifts.map(s => {
                    const person = data.staff.find(p => p.id === s.userId)
                    const counter = data.counters.find(c => c.id === s.counterId)
                    return (
                      <li key={s.id} className={cn('group flex items-start justify-between gap-1 rounded-lg px-2 py-1.5 text-xs', colorOf(s.userId))}>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{person?.name ?? '—'}</span>
                          <span className="block">{s.startTime}–{s.endTime}</span>
                          {counter && <span className="flex items-center gap-1 opacity-80"><Monitor size={10} />{counter.name}</span>}
                        </span>
                        <button onClick={() => remove(s.id)} aria-label={t('planning.delete')} className="shrink-0 opacity-60 hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <button onClick={() => openAdd(key)} disabled={data.staff.length === 0}
                  className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-semibold text-ink-muted hover:border-brand hover:text-brand disabled:opacity-40">
                  <Plus size={12} /> {t('planning.add')}
                </button>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!addFor} onClose={() => setAddFor(null)}
        title={addFor ? t('planning.addTitle', { day: new Date(`${addFor}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) }) : ''}>
        <div className="space-y-4">
          <SelectInput label={t('planning.agent')} value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}>
            {data?.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectInput>
          <SelectInput label={t('planning.counter')} value={form.counterId} onChange={e => setForm(f => ({ ...f, counterId: e.target.value }))}>
            <option value="">{t('planning.anyCounter')}</option>
            {data?.counters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectInput>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('planning.start')}
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="block w-full rounded-control border border-gray-200 px-3 py-3 text-sm text-ink" />
            </label>
            <label className="space-y-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {t('planning.end')}
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="block w-full rounded-control border border-gray-200 px-3 py-3 text-sm text-ink" />
            </label>
          </div>
          <Button fullWidth loading={saving} disabled={!form.userId} onClick={save}>{t('common.save')}</Button>
        </div>
      </Dialog>
    </div>
  )
}
