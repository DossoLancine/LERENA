'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BellRing, Smartphone, Moon, Send, AlertTriangle } from 'lucide-react'
import { getMyNotificationSettings, saveMyNotificationSettings, sendMyTestNotification } from '@/server/actions/notification-center'
import { useMyPush } from '@/hooks/use-my-push'
import type { NotificationChannel } from '@/lib/notification-events'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getMyNotificationSettings>>>
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** Mes notifications : appareil, événements et canaux, heures de silence. */
export default function NotificationSettingsPage() {
  const toast = useToast()
  const push = useMyPush()
  const [data, setData] = useState<Data | null>(null)
  const [prefs, setPrefs] = useState<Record<string, NotificationChannel[]>>({})
  const [quiet, setQuiet] = useState<{ on: boolean; from: number; to: number }>({ on: true, from: 21, to: 7 })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const d = await getMyNotificationSettings()
    if (!d) return
    setData(d)
    setPrefs(Object.fromEntries(d.events.map(e => [e.id, e.channels])))
    setQuiet({ on: d.quietFrom != null && d.quietTo != null, from: d.quietFrom ?? 21, to: d.quietTo ?? 7 })
  }, [])
  useEffect(() => { load() }, [load])

  const toggle = (event: string, channel: NotificationChannel) =>
    setPrefs(p => { const cur = p[event] ?? ['APP']; return { ...p, [event]: cur.includes(channel) ? cur.filter(c => c !== channel) : [...cur, channel] } })

  const save = async () => {
    setBusy(true)
    const res = await saveMyNotificationSettings({ prefs, quietFrom: quiet.on ? quiet.from : null, quietTo: quiet.on ? quiet.to : null })
    setBusy(false)
    toast(res.success ? 'Réglages enregistrés' : 'Enregistrement impossible', res.success ? 'success' : 'error')
  }
  const test = async () => {
    const res = await sendMyTestNotification()
    toast(res.devices ? `Notification envoyée sur ${res.devices} appareil${res.devices > 1 ? 's' : ''}` : 'Notification ajoutée à la cloche (activez cet appareil pour la recevoir aussi en dehors de l’application)', 'success')
  }

  const channels = data?.channels.filter(c => c.id !== 'APP') ?? []

  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <button onClick={() => history.back()} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-ink"><ArrowLeft size={16} /> Retour</button>
        <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Mes notifications</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Être prévenu, sans être dérangé</h1>
          <p className="mt-1 text-sm text-ink-muted">Tout arrive dans la cloche de l’application. Choisissez en plus le téléphone, l’e-mail ou WhatsApp pour ce qui compte.</p>
        </header>

        {/* Cet appareil */}
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Smartphone size={16} className="text-brand" /> Cet appareil</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-ink-muted">
              {push.state === 'subscribed' && 'Activé : vous recevez les notifications même application fermée.'}
              {push.state === 'default' && 'Pas encore activé sur cet appareil.'}
              {push.state === 'denied' && 'Bloqué dans les réglages du navigateur : autorisez les notifications pour ce site, puis revenez ici.'}
              {push.state === 'ios-install' && 'Sur iPhone (iOS 16.4 ou plus) : touchez Partager puis « Sur l’écran d’accueil », ouvrez Lerena depuis l’icône, puis revenez ici.'}
              {push.state === 'unsupported' && 'Ce navigateur ne reçoit pas les notifications, ou elles ne sont pas encore activées sur Lerena.'}
              {push.state === 'loading' && '…'}
            </p>
            {push.state === 'default' && <Button size="sm" icon={<BellRing size={14} />} onClick={async () => { if (await push.enable()) await load() }}>Activer</Button>}
            {push.state === 'subscribed' && <Button size="sm" variant="ghost" onClick={() => push.disable().then(load)}>Désactiver</Button>}
            <Button size="sm" variant="secondary" icon={<Send size={14} />} onClick={test}>Tester</Button>
          </div>
          {data && <p className="mt-2 text-xs text-ink-subtle">{data.devices} appareil{data.devices > 1 ? 's' : ''} activé{data.devices > 1 ? 's' : ''} sur votre compte.</p>}
        </section>

        {/* Événements */}
        <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
          <h2 className="border-b border-surface-line px-5 py-3.5 font-semibold text-ink">Ce que vous recevez</h2>
          {!data ? <div className="m-5 h-40 animate-pulse rounded-xl bg-gray-100" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-surface-line text-left text-xs text-ink-muted">
                    <th scope="col" className="px-5 py-2.5 font-semibold">Événement</th>
                    {channels.map(c => (
                      <th key={c.id} scope="col" className="w-24 px-2 py-2.5 text-center font-semibold">
                        {c.label}
                        {!c.live && <span className="block text-[10px] font-normal text-ink-subtle">bientôt</span>}
                        {c.live && !c.available && <span className="block text-[10px] font-normal text-warning-ink">{c.id === 'EMAIL' ? 'pas d’e-mail' : 'pas de numéro'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-line">
                  {data.events.map(e => (
                    <tr key={e.id}>
                      <th scope="row" className="px-5 py-3 text-left font-normal">
                        <span className="flex items-center gap-1.5 font-semibold text-ink">{e.label}{e.urgent && <AlertTriangle size={12} className="text-warning-ink" aria-label="Urgent" />}</span>
                        <span className="block text-xs text-ink-muted">{e.description}{e.since ? ` (à partir de ${e.since})` : ''}</span>
                      </th>
                      {channels.map(c => {
                        const on = (prefs[e.id] ?? []).includes(c.id)
                        return (
                          <td key={c.id} className="px-2 py-3 text-center">
                            <button role="switch" aria-checked={on} aria-label={`${e.label} par ${c.label}`} onClick={() => toggle(e.id, c.id)}
                              className={cn('relative inline-block h-6 w-10 rounded-full transition-colors', on ? 'bg-brand' : 'bg-gray-200')}>
                              <span className={cn('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Heures de silence */}
        <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><Moon size={16} className="text-brand" /> Heures de silence</h2>
          <p className="text-xs text-ink-muted">Pas de notification sur le téléphone ni de WhatsApp pendant ces heures, sauf urgence (signalée par ⚠). La cloche, elle, garde tout.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={quiet.on} onChange={e => setQuiet(q => ({ ...q, on: e.target.checked }))} className="h-4 w-4 accent-[#c2410c]" /> Silence de</label>
            <select disabled={!quiet.on} value={quiet.from} onChange={e => setQuiet(q => ({ ...q, from: Number(e.target.value) }))} className="rounded-lg border border-gray-200 px-2 py-1.5 disabled:opacity-40">{HOURS.map(h => <option key={h} value={h}>{h} h</option>)}</select>
            à
            <select disabled={!quiet.on} value={quiet.to} onChange={e => setQuiet(q => ({ ...q, to: Number(e.target.value) }))} className="rounded-lg border border-gray-200 px-2 py-1.5 disabled:opacity-40">{HOURS.map(h => <option key={h} value={h}>{h} h</option>)}</select>
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link href="/" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted">Annuler</Link>
          <Button loading={busy} onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </main>
  )
}
