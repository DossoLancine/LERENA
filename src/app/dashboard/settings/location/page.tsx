'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { MapPin, ShieldCheck, Clock } from 'lucide-react'
import { getPublicConfig } from '@/server/actions/platform'
import { getSiteLocation, updateBusinessHours, updateSiteLocation } from '@/server/actions/site'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { t } from '@/lib/i18n'

const LocationPickerMap = dynamic(() => import('@/components/maps/location-picker-map'), {
  ssr: false,
  loading: () => <div className="flex h-[360px] items-center justify-center rounded-2xl bg-gray-100 animate-pulse"><MapPin size={32} className="text-gray-300" /></div>
})

type Hour = { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }

// Lundi en premier, comme sur un planning ; dimanche = 0
const DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DEFAULT_HOURS: Hour[] = DAYS.map(d => ({
  dayOfWeek: d,
  openTime: '08:00',
  closeTime: d === 6 ? '12:00' : '17:00',
  isClosed: d === 0
}))

export default function LocationSettingsPage() {
  const toast = useToast()
  const [loaded, setLoaded] = useState(false)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [requireGps, setRequireGps] = useState(false)
  const [radius, setRadius] = useState(10)
  const [hours, setHours] = useState<Hour[]>(DEFAULT_HOURS)
  const [savingPos, setSavingPos] = useState(false)
  const [savingHours, setSavingHours] = useState(false)
  const [fallback, setFallback] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null })

  useEffect(() => {
    getPublicConfig().then(c => setFallback({ lat: c.defaultLat, lng: c.defaultLng }))
  }, [])

  useEffect(() => {
    getSiteLocation().then(data => {
      if (data) {
        if (data.lat !== null && data.lng !== null) setPos({ lat: data.lat, lng: data.lng })
        setRequireGps(data.requireGps)
        setRadius(data.maxRadiusKm)
        if (data.hours.length > 0) {
          setHours(DAYS.map(d => data.hours.find(h => h.dayOfWeek === d) ?? { dayOfWeek: d, openTime: '08:00', closeTime: '17:00', isClosed: true }))
        }
      }
      setLoaded(true)
    })
  }, [])

  const savePosition = async () => {
    if (!pos) return
    setSavingPos(true)
    const res = await updateSiteLocation({ ...pos, requireGps, maxRadiusKm: radius })
    setSavingPos(false)
    toast(res.success ? t('location.saved') : res.error ?? t('errors.generic.title'), res.success ? 'success' : 'error')
  }

  const saveHours = async () => {
    setSavingHours(true)
    const res = await updateBusinessHours(hours)
    setSavingHours(false)
    toast(res.success ? t('location.hoursSaved') : res.error ?? t('errors.generic.title'), res.success ? 'success' : 'error')
  }

  const setHour = (day: number, patch: Partial<Hour>) =>
    setHours(hs => hs.map(h => (h.dayOfWeek === day ? { ...h, ...patch } : h)))

  if (!loaded) return <div className="h-96 animate-pulse rounded-card bg-gray-200/80" aria-busy="true" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t('location.title')} subtitle={t('location.subtitle')} />
        <div className="space-y-4 p-5">
          <LocationPickerMap initialLat={pos?.lat} initialLng={pos?.lng} defaultLat={fallback.lat} defaultLng={fallback.lng} onLocationSelect={(lat, lng) => setPos({ lat, lng })} />
          <p className="text-sm text-ink-muted">
            {pos ? <>{t('location.coords')} <span className="font-mono text-ink">{pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</span></> : t('location.noPosition')}
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-line p-4">
            <input type="checkbox" role="switch" className="mt-0.5 h-5 w-5 accent-brand" checked={requireGps} onChange={e => setRequireGps(e.target.checked)} />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><ShieldCheck size={16} className="text-brand" />{t('location.requireGps')}</span>
              <span className="mt-0.5 block text-xs text-ink-muted">{t('location.requireGpsText')}</span>
            </span>
          </label>

          {requireGps && (
            <div className="animate-rise-in">
              <label htmlFor="radius" className="mb-2 flex justify-between text-sm font-semibold text-ink">
                {t('location.radius')} <span className="text-brand">{radius} km</span>
              </label>
              <input id="radius" type="range" min={0.5} max={30} step={0.5} value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full accent-brand" />
            </div>
          )}

          <Button onClick={savePosition} loading={savingPos} disabled={!pos}>{t('common.save')}</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('location.hoursTitle')} subtitle={t('location.hoursSubtitle')} />
        <ul className="divide-y divide-surface-line">
          {hours.map(h => (
            <li key={h.dayOfWeek} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-24 text-sm font-semibold text-ink">{DAY_NAMES[h.dayOfWeek]}</span>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={!h.isClosed} onChange={e => setHour(h.dayOfWeek, { isClosed: !e.target.checked })} />
                {h.isClosed ? t('common.closed') : t('common.open')}
              </label>
              <div className={cn('flex items-center gap-2', h.isClosed && 'pointer-events-none opacity-40')}>
                <Clock size={14} className="text-ink-subtle" />
                <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} ouverture`} value={h.openTime} onChange={e => setHour(h.dayOfWeek, { openTime: e.target.value })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                <span className="text-ink-subtle">–</span>
                <input type="time" aria-label={`${DAY_NAMES[h.dayOfWeek]} fermeture`} value={h.closeTime} onChange={e => setHour(h.dayOfWeek, { closeTime: e.target.value })}
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-surface-line p-5">
          <Button onClick={saveHours} loading={savingHours}>{t('location.saveHours')}</Button>
        </div>
      </Card>
    </div>
  )
}
