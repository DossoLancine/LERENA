'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, Send, Settings2, ChevronRight, AlertTriangle, Plus, X } from 'lucide-react'
import { getReportSettings, listReports, saveReportSettings, sendSampleReport } from '@/server/actions/reports'
import { Badge, Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Rows = NonNullable<Awaited<ReturnType<typeof listReports>>>
type Settings = NonNullable<Awaited<ReturnType<typeof getReportSettings>>>

/** Rapports : archive, exemple immédiat, réglages des envois et des alertes. */
export function ReportsPage() {
  const router = useRouter()
  const toast = useToast()
  const [rows, setRows] = useState<Rows | null | undefined>(undefined)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const [r, s] = await Promise.all([listReports().catch(() => null), getReportSettings().catch(() => null)])
    setRows(r); setSettings(s)
  }, [])
  useEffect(() => { load() }, [load])

  const sample = async () => {
    setBusy(true)
    const res = await sendSampleReport()
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Exemple prêt : il est aussi dans votre cloche', 'success')
    router.push(`/dashboard/reports/${res.id}`)
  }

  if (rows === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (rows === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès aux rapports.</p>

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Rapports</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Vos chiffres, sans les chercher</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          {settings ? [settings.weekly && 'chaque lundi à 8 h', settings.monthly && 'le 1er du mois', settings.daily && 'chaque matin'].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()) : '…'} : un rapport arrive dans votre cloche, sur votre téléphone et par e-mail. Il reste archivé ici.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon={<Send size={15} />} loading={busy} onClick={sample}>M’envoyer un exemple maintenant</Button>
          {settings?.canEdit && <Button variant="secondary" icon={<Settings2 size={15} />} onClick={() => setShowSettings(s => !s)}>Réglages</Button>}
        </div>
      </header>

      {showSettings && settings && <SettingsCard initial={settings} onSaved={() => { setShowSettings(false); load() }} />}

      <section className="overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><FileText size={26} /></span>
            <p className="mt-4 font-semibold text-ink">Pas encore de rapport</p>
            <p className="mt-1 text-sm text-ink-muted">Le premier arrivera lundi à 8 h. En attendant, générez un exemple sur les 7 derniers jours.</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-line">
            {rows.map((r, i) => (
              <li key={r.id} className="animate-rise-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                <Link href={`/dashboard/reports/${r.id}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-surface-sunken/60">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><FileText size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{r.label} <span className="font-normal text-ink-muted">· {r.period}</span>
                      {r.kind === 'SAMPLE' && <Badge tone="neutral">Exemple</Badge>}
                      {r.bad > 0 && <Badge tone="warning"><AlertTriangle size={11} /> {r.bad} point{r.bad > 1 ? 's' : ''} d’attention</Badge>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">{r.headline}</p>
                  </div>
                  <ChevronRight size={18} className="text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function SettingsCard({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const toast = useToast()
  const [s, setS] = useState(initial)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    const res = await saveReportSettings({ daily: s.daily, weekly: s.weekly, monthly: s.monthly, extraEmails: s.extraEmails, alerts: s.alerts })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Réglages enregistrés', 'success'); onSaved()
  }
  const addEmail = () => { const e = email.trim().toLowerCase(); if (e && !s.extraEmails.includes(e)) setS({ ...s, extraEmails: [...s.extraEmails, e] }); setEmail('') }
  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-6 w-10 shrink-0 rounded-full transition-colors', on ? 'bg-brand' : 'bg-gray-200')}>
      <span className={cn('absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
  const a = s.alerts
  const alertRows = [
    { key: 'waitHigh' as const, label: 'Attente trop longue', unit: 'min d’attente', field: 'min' as const },
    { key: 'queueLong' as const, label: 'File trop longue', unit: 'personnes en attente', field: 'max' as const },
    { key: 'noCall' as const, label: 'Personne n’est appelé', unit: 'min sans appel', field: 'min' as const },
    { key: 'complaintBurst' as const, label: 'Avis négatifs en rafale', unit: 'avis en une heure', field: 'count' as const }
  ]

  return (
    <section className="animate-rise-in grid gap-5 rounded-card border border-surface-line bg-white p-5 shadow-card lg:grid-cols-2">
      <div className="space-y-3">
        <h2 className="font-semibold text-ink">Rapports envoyés</h2>
        {([['weekly', 'Chaque lundi à 8 h (semaine précédente)'], ['monthly', 'Le 1er du mois (mois précédent)'], ['daily', 'Chaque matin à 8 h (la veille)']] as const).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between gap-3 text-sm text-ink">{label}<Toggle on={s[k]} onChange={v => setS({ ...s, [k]: v })} label={label} /></label>
        ))}
        <div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Adresses en plus (hors équipe : DG, DAF…)</p>
          <div className="mt-2 flex gap-2">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addEmail()} placeholder="dg@exemple.ci" className="h-10 min-w-0 flex-1 rounded-control border border-gray-200 px-3 text-sm" />
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={addEmail}>Ajouter</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.extraEmails.map(e => <span key={e} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2.5 py-1 text-xs text-ink">{e}<button aria-label={`Retirer ${e}`} onClick={() => setS({ ...s, extraEmails: s.extraEmails.filter(x => x !== e) })}><X size={12} /></button></span>)}
          </div>
          <p className="mt-1 text-[11px] text-ink-subtle">Les directeurs et responsables de l’équipe le reçoivent déjà, selon leurs préférences de notification.</p>
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="font-semibold text-ink">Alertes en direct</h2>
        <p className="text-xs text-ink-muted">Sur le téléphone des responsables du site, même pendant les heures de silence. Une même alerte ne se répète pas avant 1 heure.</p>
        {alertRows.map(r => {
          const v = a[r.key] as { on: boolean } & Record<string, number | boolean>
          return (
            <div key={r.key} className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-surface-line px-3 py-2 text-sm', !v.on && 'opacity-60')}>
              <Toggle on={v.on} onChange={on => setS({ ...s, alerts: { ...a, [r.key]: { ...v, on } } })} label={r.label} />
              <span className="flex-1 font-semibold text-ink">{r.label}</span>
              <span className="text-xs text-ink-muted">dès</span>
              <input type="number" min={1} value={Number(v[r.field])} disabled={!v.on} onChange={e => setS({ ...s, alerts: { ...a, [r.key]: { ...v, [r.field]: Number(e.target.value) } } })}
                aria-label={`Seuil : ${r.label}`} className="h-8 w-16 rounded-lg border border-gray-200 px-2 text-center tabular-nums" />
              <span className="text-xs text-ink-muted">{r.unit}</span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end lg:col-span-2"><Button loading={busy} onClick={save}>Enregistrer</Button></div>
    </section>
  )
}
