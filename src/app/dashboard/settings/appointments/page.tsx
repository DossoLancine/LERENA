'use client'

import { useCallback, useEffect, useState } from 'react'
import { Trash2, CalendarX } from 'lucide-react'
import { addClosureDay, getAppointmentSettings, getAppointmentStats, removeClosureDay, updateAppointmentRules, updateServiceBooking } from '@/server/actions/appointments'
import { Button, Card, CardHeader, SelectInput, StatCard, TextInput, useToast } from '@/components/ui'

type Settings = NonNullable<Awaited<ReturnType<typeof getAppointmentSettings>>>
type Stats = NonNullable<Awaited<ReturnType<typeof getAppointmentStats>>>

/** Règles de prise de rendez-vous, réglages par service, jours de fermeture et indicateurs. */
export default function AppointmentSettingsPage() {
  const toast = useToast()
  const [data, setData] = useState<Settings | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    getAppointmentSettings().then(setData)
    getAppointmentStats().then(setStats)
  }, [])
  useEffect(() => { load() }, [load])

  if (!data?.org) return <div className="h-64 rounded-card shimmer" />
  const org = data.org

  const saveRules = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await updateAppointmentRules({
      bookingMode: String(f.get('bookingMode')),
      apptMaxActive: Number(f.get('apptMaxActive')),
      apptCancelHours: Number(f.get('apptCancelHours')),
      apptNoShowGraceMin: Number(f.get('apptNoShowGraceMin')),
      apptNoShowBlock: Number(f.get('apptNoShowBlock')),
      apptNoShowSms: f.get('apptNoShowSms') === 'on'
    })
    setBusy(false)
    toast(res.success ? 'Règles enregistrées' : 'Enregistrement impossible', res.success ? 'success' : 'error')
    load()
  }

  const saveService = async (id: string, field: 'apptCapacity' | 'apptLeadMin' | 'apptHorizonDays', value: number) => {
    const svc = data.services.find(s => s.id === id)
    if (!svc) return
    const res = await updateServiceBooking(id, { apptCapacity: svc.apptCapacity, apptLeadMin: svc.apptLeadMin, apptHorizonDays: svc.apptHorizonDays, [field]: value })
    if (!res.success) toast('Enregistrement impossible', 'error')
    load()
  }

  const addClosure = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const res = await addClosureDay({ date: String(f.get('date')), label: String(f.get('label') ?? ''), siteId: String(f.get('siteId') || '') || null })
    if (!res.success) return toast(res.error ?? 'Ajout impossible', 'error')
    toast('Jour de fermeture ajouté')
    form.reset()
    load()
  }

  return (
    <div className="space-y-4">
      {stats && stats.total > 0 && (
        <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="RDV (30 derniers jours)" value={stats.total} />
          <StatCard label="Venus" value={stats.arrived} />
          <StatCard label="Absents" value={stats.noShow} hint={`${stats.noShowRate} %`} hintTone={stats.noShowRate > 15 ? 'bad' : 'neutral'} />
          <StatCard label="Annulés" value={stats.cancelled} />
        </div>
      )}

      <Card>
        <CardHeader title="Règles des rendez-vous" subtitle="S’appliquent aux réservations faites par les visiteurs (l’accueil peut toujours réserver)" />
        <form onSubmit={saveRules} className="grid gap-4 p-5 sm:grid-cols-2">
          <SelectInput name="bookingMode" label="Mode de l’établissement" defaultValue={org.bookingMode}>
            <option value="QUEUE_ONLY">File d’attente seulement</option>
            <option value="HYBRID">File d’attente et rendez-vous</option>
            <option value="APPOINTMENT_ONLY">Rendez-vous seulement</option>
          </SelectInput>
          <TextInput name="apptMaxActive" label="RDV à venir par personne" type="number" min={1} max={10} defaultValue={org.apptMaxActive} />
          <TextInput name="apptCancelHours" label="Report / annulation en ligne jusqu’à (heures avant)" type="number" min={0} max={72} defaultValue={org.apptCancelHours} />
          <TextInput name="apptNoShowGraceMin" label="Absence notée après (minutes de retard)" type="number" min={5} max={120} defaultValue={org.apptNoShowGraceMin} />
          <TextInput name="apptNoShowBlock" label="Bloquer la réservation en ligne après N absences" type="number" min={0} max={10} defaultValue={org.apptNoShowBlock} hint="0 = jamais" />
          <label className="flex items-start gap-3 rounded-control border border-gray-200 px-4 py-3 text-sm sm:col-span-2">
            <input type="checkbox" name="apptNoShowSms" defaultChecked={org.apptNoShowSms} className="mt-0.5 h-4 w-4 accent-[#c2410c]" />
            <span><span className="font-semibold text-ink">SMS aux absents pour reprogrammer</span><span className="block text-xs text-ink-muted">Après un rendez-vous manqué, le visiteur reçoit un lien pour reprendre un créneau (forfaits avec « Suivis et relances », décompté de vos SMS).</span></span>
          </label>
          <div className="flex items-end"><Button type="submit" fullWidth loading={busy}>Enregistrer</Button></div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Par service" subtitle="Durée du créneau = durée moyenne du service (page Services)" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Service</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Personnes par créneau</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Délai minimum (min)</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Réservable jusqu’à (jours)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {data.services.map(s => (
                <tr key={s.id}>
                  <th scope="row" className="px-5 py-2 text-left font-medium text-ink">{s.name}<span className="block text-xs font-normal text-ink-muted">créneaux de {s.avgDurationMin} min</span></th>
                  {(['apptCapacity', 'apptLeadMin', 'apptHorizonDays'] as const).map(field => (
                    <td key={field} className="px-3 py-2">
                      <label className="sr-only" htmlFor={`${s.id}-${field}`}>{field}</label>
                      <input id={`${s.id}-${field}`} type="number" defaultValue={s[field]} min={field === 'apptLeadMin' ? 0 : 1}
                        onBlur={e => Number(e.target.value) !== s[field] && saveService(s.id, field, Number(e.target.value))}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-ink" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Jours de fermeture" subtitle="Fériés et fermetures exceptionnelles : aucun rendez-vous ces jours-là" />
        <form onSubmit={addClosure} className="grid gap-3 border-b border-surface-line p-5 sm:grid-cols-[160px_1fr_180px_auto] sm:items-end">
          <TextInput name="date" label="Date" type="date" required />
          <TextInput name="label" label="Motif (facultatif)" maxLength={60} placeholder="Ex : Fête de l’Indépendance" />
          <SelectInput name="siteId" label="Site" defaultValue="">
            <option value="">Tous les sites</option>
            {data.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </SelectInput>
          <Button type="submit">Ajouter</Button>
        </form>
        {data.closures.length === 0 ? (
          <p className="flex items-center gap-2 p-5 text-sm text-ink-muted"><CalendarX size={16} aria-hidden="true" /> Aucun jour de fermeture à venir.</p>
        ) : (
          <ul className="divide-y divide-surface-line">
            {data.closures.map(c => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="text-ink">
                  <span className="font-semibold">{new Date(`${c.date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
                  {c.label && ` — ${c.label}`}{c.siteName && <span className="text-ink-muted"> · {c.siteName}</span>}
                </span>
                <button type="button" onClick={async () => { await removeClosureDay(c.id); load() }} aria-label="Retirer ce jour" className="rounded-lg p-2 text-ink-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
