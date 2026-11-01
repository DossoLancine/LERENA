'use client'

import { useEffect, useState } from 'react'
import { MessageSquare, Mail, BellRing } from 'lucide-react'
import { getNotificationSettings, setSmsTurnAlerts } from '@/server/actions/notifications'
import { AnimatedNumber, Card, CardHeader, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Settings = NonNullable<Awaited<ReturnType<typeof getNotificationSettings>>>

/** Comment les visiteurs sont prévenus, et ce que cela consomme ce mois-ci. */
export default function NotificationsSettingsPage() {
  const toast = useToast()
  const [data, setData] = useState<Settings | null>(null)
  useEffect(() => { getNotificationSettings().then(setData) }, [])

  const toggle = async (enabled: boolean) => {
    setData(d => d && { ...d, smsTurnAlerts: enabled })
    const res = await setSmsTurnAlerts(enabled)
    toast(res.success ? (enabled ? 'Alertes SMS activées' : 'Alertes SMS désactivées') : 'Enregistrement impossible', res.success ? 'success' : 'error')
  }

  if (!data) return <div className="h-64 rounded-card shimmer" />

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Prévenir les visiteurs" subtitle="Notification sur le téléphone d’abord ; SMS en complément si vous l’activez" />
        <div className="space-y-4 p-5 text-sm text-ink">
          <p className="flex items-start gap-3"><BellRing size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span>Les visiteurs qui suivent leur ticket dans l’application reçoivent gratuitement une notification quand leur tour approche et quand c’est leur tour.</span></p>
          <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-surface-line p-4">
            <MessageSquare size={22} className="shrink-0 text-ink-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">SMS « vous êtes le prochain » et « c’est votre tour »</span>
              <span className="block text-xs text-ink-muted">Pour les visiteurs sans notification (ticket pris à l’accueil ou à la borne avec un numéro). Au plus 2 SMS par ticket, facturés selon votre offre.</span>
            </span>
            <input type="checkbox" role="switch" checked={data.smsTurnAlerts} onChange={e => toggle(e.target.checked)} className="peer sr-only" aria-label="Alertes SMS" />
            <span aria-hidden="true" className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand', data.smsTurnAlerts ? 'bg-brand' : 'bg-gray-300')}>
              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ease-spring', data.smsTurnAlerts ? 'translate-x-6' : 'translate-x-1')} />
            </span>
          </label>
          {!data.smsProviderReady && (
            <p className="rounded-2xl bg-warning-soft p-3 text-xs text-warning-ink">
              Le service SMS de la plateforme n’est pas encore raccordé : les SMS sont simulés (rien ne part) et comptés à part.
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Messages envoyés — ${data.month}`} />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {([['SMS', MessageSquare, data.sms], ['E-mails', Mail, data.email]] as const).map(([label, Icon, c]) => (
            <div key={label} className="rounded-2xl bg-surface-sunken p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Icon size={16} aria-hidden="true" /> {label}</p>
              <p className="mt-2 text-3xl font-black text-ink"><AnimatedNumber value={c.sent} /></p>
              <p className="text-xs text-ink-muted">envoyés{c.simulated ? ` · ${c.simulated} simulés` : ''}{c.failed ? ` · ${c.failed} en échec` : ''}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
