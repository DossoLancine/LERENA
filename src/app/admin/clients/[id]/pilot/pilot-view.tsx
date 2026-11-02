'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import { setPilot, type getPilotReport } from '@/server/actions/pilot'
import { Button, Card, CardHeader, TextArea, TextInput, useToast } from '@/components/ui'
import { BarChart } from '@/components/charts/bar-chart'
import { OrgMark } from '@/components/branding/org-mark'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getPilotReport>>>
const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const num = (v: number | null, unit = '') => (v == null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`)

/** Rapport de pilote : réglage des mesures « avant », puis résultats avant / après imprimables (étude de cas). */
export function PilotView({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { org, report: r } = data

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    const res = await setPilot(org.id, { startedAt: String(f.get('startedAt') ?? ''), baselineWaitMin: String(f.get('baselineWaitMin') ?? ''), baselineDaily: String(f.get('baselineDaily') ?? ''), notes: String(f.get('notes') ?? '') })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Pilote enregistré')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admin/clients/${org.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeft size={15} /> {org.name}</Link>
        {r && <Button variant="secondary" size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>Imprimer l’étude de cas</Button>}
      </div>

      <Card className="print:hidden">
        <CardHeader title="Pilote" subtitle="Relevez sur place, avant d’installer Lerena, l’attente moyenne et la fréquentation : ce sont les chiffres « avant »." />
        <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-3">
          <TextInput name="startedAt" label="Début du pilote" type="date" defaultValue={org.pilotStartedAt?.slice(0, 10) ?? ''} hint="Vide = pas de pilote" />
          <TextInput name="baselineWaitMin" label="Attente moyenne avant (min)" type="number" min={0} defaultValue={org.pilotBaselineWaitMin ?? ''} />
          <TextInput name="baselineDaily" label="Visiteurs par jour avant" type="number" min={0} defaultValue={org.pilotBaselineDaily ?? ''} />
          <div className="sm:col-span-3"><TextArea name="notes" label="Observations de terrain" rows={3} defaultValue={org.pilotNotes ?? ''} placeholder="Retours des agents, incidents, demandes d’amélioration, citations du responsable…" /></div>
          <div className="sm:col-span-3 flex justify-end"><Button type="submit" loading={busy}>Enregistrer</Button></div>
        </form>
      </Card>

      {!r ? (
        <p className="rounded-card border border-dashed border-gray-300 p-8 text-center text-sm text-ink-muted">Indiquez la date de début du pilote pour obtenir le rapport.</p>
      ) : (
        <article className="animate-rise-in space-y-5 rounded-card border border-surface-line bg-white p-6 shadow-card print:border-0 print:p-0 print:shadow-none sm:p-8">
          <header className="flex flex-wrap items-center gap-4 border-b border-surface-line pb-5">
            <OrgMark name={org.name} logo={org.logo} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">Étude de cas Lerena</p>
              <h1 className="text-2xl font-bold tracking-tight text-ink">{org.name}</h1>
              <p className="text-sm text-ink-muted">{[org.category, org.city].filter(Boolean).join(' · ')} · pilote depuis le {date(org.pilotStartedAt!)} ({r.days} jours) · {org._count.branches} site{org._count.branches > 1 ? 's' : ''}, {org._count.members} membres d’équipe, {org._count.devices} appareils</p>
            </div>
          </header>

          {/* Avant / après */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Attente moyenne</p>
              <div className="mt-2 flex items-end gap-4">
                <div><p className="text-xs text-ink-subtle">Avant</p><p className="text-3xl font-black tabular-nums text-ink-muted">{num(org.pilotBaselineWaitMin, ' min')}</p></div>
                <div><p className="text-xs text-ink-subtle">Avec Lerena</p><p className="text-3xl font-black tabular-nums text-ink">{num(r.avgWaitMin, ' min')}</p></div>
                {r.waitGain != null && (
                  <span className={cn('mb-1 ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold', r.waitGain > 0 ? 'bg-success-soft text-success-ink' : 'bg-danger-soft text-danger-ink')}>
                    {r.waitGain > 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}{r.waitGain > 0 ? `−${r.waitGain}` : `+${-r.waitGain}`} %
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-subtle">Attente mesurée de la prise du ticket à l’appel. Le visiteur n’attend plus debout : il suit sa place sur son téléphone.</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Fréquentation</p>
              <div className="mt-2 flex items-end gap-4">
                <div><p className="text-xs text-ink-subtle">Avant</p><p className="text-3xl font-black tabular-nums text-ink-muted">{num(org.pilotBaselineDaily)}</p></div>
                <div><p className="text-xs text-ink-subtle">Avec Lerena</p><p className="text-3xl font-black tabular-nums text-ink">{num(r.ticketsPerDay)}</p></div>
                <span className="mb-1 ml-auto text-xs text-ink-subtle">visiteurs / jour</span>
              </div>
              <p className="mt-2 text-xs text-ink-subtle">{r.tickets.toLocaleString('fr-FR')} tickets en {r.days} jours, dont {r.served.toLocaleString('fr-FR')} servis.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Temps au guichet', num(r.avgServiceMin, ' min')],
              ['Absents à l’appel', num(r.absentRate, ' %')],
              ['Satisfaction', r.satisfaction != null ? `${r.satisfaction.toLocaleString('fr-FR')} / 5` : '—', `${r.ratings} avis`],
              ['Incidents techniques', String(r.incidents), 'plateforme, sur la période']
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl border border-surface-line p-4">
                <p className="text-xs text-ink-muted">{label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</p>
                {hint && <p className="text-[11px] text-ink-subtle">{hint}</p>}
              </div>
            ))}
          </div>

          {r.weeks.length > 1 && (
            <Card className="print:break-inside-avoid">
              <CardHeader title="Attente moyenne semaine par semaine (minutes)" subtitle="L’équipe prend ses marques : l’attente baisse au fil des semaines" />
              <div className="p-5"><BarChart label="Attente moyenne par semaine" data={r.weeks.map(w => ({ label: w.label, value: w.avgWaitMin ?? 0, hint: `${w.tickets} tickets${w.absentRate != null ? ` · ${w.absentRate} % absents` : ''}` }))} /></div>
            </Card>
          )}

          {org.pilotNotes && (
            <section>
              <h2 className="text-sm font-semibold text-ink">Observations de terrain</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{org.pilotNotes}</p>
            </section>
          )}
          <p className="text-[11px] text-ink-subtle">Rapport généré le {new Date(r.generatedAt).toLocaleString('fr-FR')} à partir des tickets enregistrés par Lerena. Chiffres « avant » relevés sur place.</p>
        </article>
      )}
    </div>
  )
}
