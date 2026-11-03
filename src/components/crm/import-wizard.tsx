'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { FileUp, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react'
import { getImportContext, importCustomers } from '@/server/actions/crm-insights'
import { FIELD_LABELS, MAX_IMPORT_ROWS, guessField, mapRows, parseCsv, type ImportField } from '@/lib/customer-import'
import { Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { CrmTabs, InsightsLocked } from './insights'

type Summary = { rows: number; created: number; updated: number; duplicatesInFile: number; consent: number }
type ConsentMode = 'none' | 'all' | 'column'
const BATCH = 500

/** Import guidé : fichier CSV, colonnes reconnues, aperçu, accord des visiteurs, analyse, puis import. */
export function ImportWizard() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getImportContext>> | undefined>(undefined)
  const [fileName, setFileName] = useState('')
  const [header, setHeader] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ImportField[]>([])
  const [consent, setConsent] = useState<ConsentMode>('none')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [done, setDone] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { getImportContext().then(setCtx).catch(() => setCtx(null)) }, [])

  const mapped = useMemo(
    () => mapRows(rows, mapping, { consentAll: consent === 'all', countryCode: ctx?.countryCode }),
    [rows, mapping, consent, ctx]
  )
  const effective = useMemo(() => consent === 'none' ? mapped.valid.map(r => ({ ...r, consent: false })) : mapped.valid, [mapped, consent])
  const hasPhone = mapping.includes('phone')
  const hasConsentColumn = mapping.includes('consent')

  const read = async (file: File) => {
    if (file.size > 5_000_000) return toast('Fichier trop lourd (5 Mo au maximum)', 'error')
    let text = await file.text()
    // Fichier enregistré par Excel en Windows-1252 : les accents arrivent en « � »
    if (text.includes('�')) text = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
    const all = parseCsv(text)
    if (all.length < 2) return toast('Le fichier ne contient pas de lignes de visiteurs', 'error')
    setFileName(file.name)
    setHeader(all[0])
    setRows(all.slice(1))
    const guessed = all[0].map(guessField)
    setMapping(guessed)
    setConsent(guessed.includes('consent') ? 'column' : 'none')
    setSummary(null); setDone(null)
  }

  const analyse = async () => {
    setBusy(true)
    const res = await importCustomers(effective, { dryRun: true })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setSummary(res)
  }

  const run = async () => {
    setBusy(true)
    const total: Summary = { rows: 0, created: 0, updated: 0, duplicatesInFile: 0, consent: 0 }
    for (let i = 0; i < effective.length; i += BATCH) {
      setProgress(Math.round((i / effective.length) * 100))
      const res = await importCustomers(effective.slice(i, i + BATCH), { dryRun: false })
      if (!res.success) { setBusy(false); setProgress(null); return toast(res.error, 'error') }
      for (const k of Object.keys(total) as (keyof Summary)[]) total[k] += res[k]
    }
    setProgress(null); setBusy(false)
    setDone(total)
  }

  if (ctx === undefined) return <div className="space-y-5"><CrmTabs /><div className="h-64 animate-pulse rounded-3xl bg-gray-100" /></div>
  if (!ctx) return null
  if (!ctx.enabled) return <div className="space-y-5"><CrmTabs /><InsightsLocked what="Le pilotage, l’import et l’export des visiteurs" /></div>

  return (
    <div className="space-y-5">
      <CrmTabs />
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Import</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Reprendre vos listes Excel</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Dans Excel : Fichier → Enregistrer sous → « CSV (séparateur : point-virgule) ». Une ligne par visiteur, avec au moins son téléphone. {MAX_IMPORT_ROWS.toLocaleString('fr-FR')} lignes au maximum.</p>
      </header>

      {done ? (
        <section className="animate-pop-in rounded-card border border-surface-line bg-white p-8 text-center shadow-card">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 size={28} /></span>
          <p className="mt-4 font-display text-2xl font-bold text-ink">{done.created} fiche{done.created > 1 ? 's' : ''} créée{done.created > 1 ? 's' : ''}</p>
          <p className="mt-1 text-sm text-ink-muted">{done.updated} fiche{done.updated > 1 ? 's' : ''} existante{done.updated > 1 ? 's' : ''} complétée{done.updated > 1 ? 's' : ''} · {done.consent} avec accord pour les messages</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/dashboard/visitors" className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">Voir le fichier visiteurs</Link>
            <Link href="/dashboard/visitors/duplicates" className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-ink">Vérifier les doublons</Link>
          </div>
        </section>
      ) : (
        <>
          {/* 1. Fichier */}
          <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
            <h2 className="font-semibold text-ink">1. Fichier</h2>
            <input ref={input} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = '' }} />
            <button onClick={() => input.current?.click()}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) read(f) }}
              className="mt-3 flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-gray-300 px-6 py-8 text-center transition-colors hover:border-brand hover:bg-brand-50/40">
              <FileUp size={26} className="text-brand" />
              <span className="mt-2 font-semibold text-ink">{fileName || 'Choisir ou déposer un fichier CSV'}</span>
              <span className="text-xs text-ink-muted">{rows.length ? `${rows.length} ligne${rows.length > 1 ? 's' : ''} lue${rows.length > 1 ? 's' : ''}` : 'Le fichier est lu sur votre appareil avant l’envoi'}</span>
            </button>
          </section>

          {rows.length > 0 && (
            <>
              {/* 2. Colonnes */}
              <section className="rounded-card border border-surface-line bg-white shadow-card">
                <div className="px-5 pt-5">
                  <h2 className="font-semibold text-ink">2. Colonnes</h2>
                  <p className="text-xs text-ink-muted">Reconnues d’après leur titre ; corrigez si besoin. Aperçu des 5 premières lignes.</p>
                  {!hasPhone && <p className="mt-2 text-xs font-semibold text-danger">Indiquez la colonne du téléphone.</p>}
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-y border-surface-line bg-surface-sunken/60">
                        {header.map((h, i) => (
                          <th key={i} scope="col" className="px-3 py-2 text-left align-top font-normal">
                            <span className="block truncate text-xs font-semibold text-ink-muted">{h || `Colonne ${i + 1}`}</span>
                            <select aria-label={`Contenu de la colonne ${h || i + 1}`} value={mapping[i]} onChange={e => setMapping(m => m.map((x, j) => (j === i ? (e.target.value as ImportField) : x)))}
                              className={cn('mt-1 w-full rounded-lg border px-2 py-1 text-xs font-semibold', mapping[i] === 'ignore' ? 'border-gray-200 text-ink-subtle' : 'border-brand/40 bg-brand-50 text-brand-700')}>
                              {(Object.keys(FIELD_LABELS) as ImportField[]).map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                            </select>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-line">
                      {rows.slice(0, 5).map((r, i) => (
                        <tr key={i}>{header.map((_, j) => <td key={j} className={cn('max-w-[180px] truncate px-3 py-2', mapping[j] === 'ignore' ? 'text-ink-subtle' : 'text-ink')}>{r[j]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasPhone && mapped.invalid.length > 0 && (
                  <p className="flex items-start gap-2 border-t border-surface-line px-5 py-3 text-xs text-warning-ink">
                    <AlertTriangle size={14} className="mt-px shrink-0" />
                    {mapped.invalid.length} ligne{mapped.invalid.length > 1 ? 's' : ''} sans numéro valide, ignorée{mapped.invalid.length > 1 ? 's' : ''} : {mapped.invalid.slice(0, 6).map(x => `ligne ${x.line} (${x.value})`).join(', ')}{mapped.invalid.length > 6 ? '…' : ''}
                  </p>
                )}
              </section>

              {/* 3. Accord */}
              <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
                <h2 className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck size={16} className="text-brand" /> 3. Accord pour vos messages</h2>
                <p className="text-xs text-ink-muted">Les campagnes ne partent qu’aux visiteurs qui ont accepté. En cas de doute, choisissez « Non » : ils pourront accepter depuis leur ticket.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {([
                    ['none', 'Non, pas d’accord connu', 'Aucune fiche ne recevra de campagne'],
                    ['all', 'Oui, tous ont accepté', 'Accord écrit ou oral, que vous pouvez justifier'],
                    ['column', 'Selon une colonne', hasConsentColumn ? '« oui », « x » ou « 1 » = accord' : 'Choisissez la colonne « Accord » ci-dessus']
                  ] as const).map(([id, label, hint]) => (
                    <button key={id} onClick={() => setConsent(id)} aria-pressed={consent === id} disabled={id === 'column' && !hasConsentColumn}
                      className={cn('rounded-2xl border-2 p-3 text-left disabled:opacity-40', consent === id ? 'border-brand bg-brand-50/60' : 'border-surface-line')}>
                      <span className="block text-sm font-semibold text-ink">{label}</span><span className="block text-xs text-ink-muted">{hint}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 4. Analyse et import */}
              <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
                <h2 className="font-semibold text-ink">4. Import</h2>
                {summary ? (
                  <div className="mt-3 space-y-4">
                    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[['Fiches créées', summary.created], ['Fiches complétées', summary.updated], ['Doublons dans le fichier', summary.duplicatesInFile], ['Avec accord', summary.consent]].map(([l, v]) => (
                        <div key={l as string} className="rounded-2xl bg-surface-sunken p-3"><dt className="text-xs text-ink-muted">{l}</dt><dd className="font-display text-2xl font-bold tabular-nums text-ink">{v}</dd></div>
                      ))}
                    </dl>
                    <p className="text-xs text-ink-muted">Une fiche existante n’est jamais écrasée : le nom manquant est ajouté, les étiquettes et les notes s’ajoutent, l’accord ne remplace pas un « STOP ».</p>
                    {progress != null && <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>}
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setSummary(null)} disabled={busy}>Modifier</Button>
                      <Button fullWidth loading={busy} onClick={run}>Importer {summary.rows} visiteur{summary.rows > 1 ? 's' : ''}</Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-3" fullWidth loading={busy} disabled={!hasPhone || effective.length === 0} onClick={analyse}>
                    Analyser {effective.length} ligne{effective.length > 1 ? 's' : ''}
                  </Button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}
