'use client'

import { useCallback, useEffect, useState } from 'react'
import { Tv, Tablet, Trash2, Link2 } from 'lucide-react'
import { listDevices, pairDevice, removeDevice, renameDevice } from '@/server/actions/devices'
import { Button, Card, CardHeader, EmptyState, TextInput, useToast } from '@/components/ui'
import { usePolling } from '@/hooks/use-polling'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'

type Device = Awaited<ReturnType<typeof listDevices>>[number]

function ago(iso: string | null) {
  if (!iso) return t('devices.never')
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  const when = min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  return t('devices.lastSeen', { when })
}

export default function DevicesSettingsPage() {
  const toast = useToast()
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [pairing, setPairing] = useState(false)

  const load = useCallback(() => listDevices().then(setDevices), [])
  useEffect(() => { load() }, [load])
  // État en ligne / hors ligne rafraîchi régulièrement
  usePolling(load, 30_000)

  const pair = async (e: React.FormEvent) => {
    e.preventDefault()
    setPairing(true)
    const res = await pairDevice(code, name)
    setPairing(false)
    if (!res.success) return toast(res.error ?? t('errors.generic.title'), 'error')
    setCode('')
    setName('')
    toast(t('devices.paired'))
    load()
  }

  const remove = async (d: Device) => {
    if (!confirm(t('devices.confirmRemove', { name: d.name ?? '' }))) return
    setDevices(list => list?.filter(x => x.id !== d.id) ?? null)
    await removeDevice(d.id)
    toast(t('devices.removed'))
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('devices.title')} subtitle={t('devices.subtitle')} />
        <div className="space-y-4 p-5">
          <div className="grid gap-2 rounded-xl bg-surface-sunken p-4 text-sm sm:grid-cols-2">
            <p><span className="text-ink-muted">{t('devices.openOnTv')}</span> <span className="font-mono font-semibold text-ink">{origin}/tv/pair</span></p>
            <p><span className="text-ink-muted">{t('devices.openOnKiosk')}</span> <span className="font-mono font-semibold text-ink">{origin}/kiosk</span></p>
          </div>
          <form onSubmit={pair} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <TextInput label={t('devices.code')} value={code} inputMode="numeric" maxLength={6} placeholder="123456"
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="font-mono text-lg tracking-widest" />
            <TextInput label={t('devices.name')} value={name} onChange={e => setName(e.target.value)} placeholder={t('devices.namePlaceholder')} />
            <Button type="submit" loading={pairing} disabled={code.length !== 6} icon={<Link2 size={16} />}>{t('devices.pair')}</Button>
          </form>
        </div>
      </Card>

      <Card>
        {devices === null ? (
          <div className="h-32 animate-pulse rounded-card bg-gray-200/80" />
        ) : devices.length === 0 ? (
          <EmptyState icon={<Tv size={32} />} title={t('devices.none')} />
        ) : (
          <ul className="divide-y divide-surface-line">
            {devices.map(d => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
                  {d.type === 'TV' ? <Tv size={18} /> : <Tablet size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <input aria-label={t('devices.name')} defaultValue={d.name ?? ''}
                    onBlur={e => e.target.value.trim() && e.target.value !== d.name && renameDevice(d.id, e.target.value)}
                    className="w-full rounded-lg border border-transparent px-1 py-0.5 font-semibold text-ink hover:border-gray-200 focus:border-brand focus:outline-none" />
                  <p className="px-1 text-xs text-ink-muted">{d.type === 'TV' ? t('devices.tv') : t('devices.kiosk')} · {ago(d.lastSeenAt)}</p>
                </div>
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold', d.online ? 'text-success' : 'text-ink-subtle')}>
                  <span className={cn('h-2 w-2 rounded-full', d.online ? 'bg-success' : 'bg-gray-300')} />
                  {d.online ? t('devices.online') : t('devices.offline')}
                </span>
                <button onClick={() => remove(d)} aria-label={t('devices.remove')} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle hover:bg-danger-soft hover:text-danger">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
