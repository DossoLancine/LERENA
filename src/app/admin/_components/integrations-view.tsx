'use client'

import { useCallback, useEffect, useState } from 'react'
import { Mail, MessageSquareText, MessageCircle, BellRing, Sparkles, Wallet, KeyRound, CheckCircle2, AlertTriangle, CircleDashed, FlaskConical, Send, RefreshCw } from 'lucide-react'
import { generatePushIntegrationKeys, getIntegrations, testIntegration, updateIntegration } from '@/server/actions/integrations'
import { INTEGRATIONS, type IntegrationDefinition, type IntegrationKind, type IntegrationMode } from '@/lib/integration-catalog'
import { Badge, Button, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { AUTH_TEMPLATE, WHATSAPP_TEMPLATES } from '@/lib/whatsapp-templates'

type Item = NonNullable<Awaited<ReturnType<typeof getIntegrations>>>[number]

const ICONS: Record<IntegrationKind, typeof Mail> = { EMAIL: Mail, SMS: MessageSquareText, WHATSAPP: MessageCircle, PUSH: BellRing, AI: Sparkles, PAYMENT: Wallet, AUTH: KeyRound, AUTH_MICROSOFT: KeyRound }

function status(i: Item) {
  if (i.live) return { tone: 'success' as const, label: 'En production', Icon: CheckCircle2 }
  if (i.mode === 'LIVE' && i.missing.length) return { tone: 'warning' as const, label: 'Incomplet', Icon: AlertTriangle }
  return { tone: 'neutral' as const, label: 'Simulation', Icon: CircleDashed }
}

/** Console → Intégrations : chaque service extérieur, réglé et testé sans redéploiement. */
export function IntegrationsView() {
  const [items, setItems] = useState<Item[] | null>(null)
  const load = useCallback(async () => setItems(await getIntegrations().catch(() => null)), [])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Intégrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          Chaque service extérieur a son connecteur. En <strong>simulation</strong>, rien ne part : les messages sont visibles dans « Messages » et tous les parcours se testent.
          Collez les clés, appuyez sur « Tester », puis passez en <strong>production</strong>. Les clés sont chiffrées et ne sont jamais réaffichées.
        </p>
      </header>
      {!items ? <div className="h-64 animate-pulse rounded-card bg-gray-100" /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          {INTEGRATIONS.map(def => {
            const item = items.find(i => i.kind === def.kind)
            return item ? <IntegrationCard key={def.kind} def={def} item={item} onChange={load} /> : null
          })}
        </div>
      )}
      <WhatsAppTemplates />
    </div>
  )
}

function IntegrationCard({ def, item, onChange }: { def: IntegrationDefinition; item: Item; onChange: () => Promise<void> }) {
  const toast = useToast()
  const [provider, setProvider] = useState(item.provider)
  const [mode, setMode] = useState<IntegrationMode>(item.mode)
  const [values, setValues] = useState<Record<string, string>>({ ...item.settings })
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'keys' | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const Icon = ICONS[def.kind]
  const s = status(item)
  const p = def.providers.find(x => x.id === provider) ?? def.providers[0]
  const sameProvider = provider === item.provider

  useEffect(() => { setProvider(item.provider); setMode(item.mode); setValues({ ...item.settings }) }, [item])

  const save = async (nextMode = mode) => {
    setBusy('save')
    const res = await updateIntegration(def.kind, { provider, mode: nextMode, values })
    setBusy(null)
    if (!res.success) return toast(res.error, 'error')
    toast(nextMode === 'LIVE' ? `${def.label} : en production` : `${def.label} : enregistré`, 'success')
    await onChange()
  }
  const test = async () => {
    setBusy('test'); setResult(null)
    // Le test porte sur les réglages enregistrés : on enregistre d'abord ce qui a été saisi
    const saved = await updateIntegration(def.kind, { provider, mode, values })
    if (!saved.success) { setBusy(null); return toast(saved.error, 'error') }
    const res = await testIntegration(def.kind, target)
    setBusy(null)
    setResult(res.success ? { ok: true, text: res.detail } : { ok: false, text: res.error })
    await onChange()
  }
  const newKeys = async () => {
    if (item.live && !window.confirm('Remplacer les clés ? Chaque appareil devra réactiver ses notifications.')) return
    setBusy('keys')
    const res = await generatePushIntegrationKeys()
    setBusy(null)
    if (!res.success) return toast(res.error, 'error')
    toast('Clés générées : notifications push en production', 'success')
    await onChange()
  }

  return (
    <section className="flex flex-col rounded-card border border-surface-line bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-surface-line px-5 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 font-semibold text-ink">{def.label}
            <Badge tone={s.tone}><s.Icon size={12} /> {s.label}</Badge>
            {item.source === 'environment' && <Badge tone="info">Variables Vercel</Badge>}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{def.description}</p>
        </div>
      </header>

      <div className="flex-1 space-y-4 p-5">
        {!item.live && <p className="rounded-xl bg-surface-sunken px-3 py-2 text-xs text-ink-muted"><FlaskConical size={12} className="mr-1 inline" />{def.simulation}</p>}
        {item.month && (
          <p className="text-xs text-ink-muted">Ce mois-ci : <strong className="text-ink">{item.month.sent}</strong> envoyés · {item.month.simulated} simulés · <span className={item.month.failed ? 'font-semibold text-danger' : ''}>{item.month.failed} échecs</span></p>
        )}

        {def.providers.length > 1 && (
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">Prestataire
            <select value={provider} onChange={e => { setProvider(e.target.value); setValues({}); setResult(null) }} className="mt-1 h-10 w-full rounded-control border border-gray-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink">
              {def.providers.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {p.fields.map(f => (
            <label key={f.key} className="block text-xs font-semibold text-ink-muted">
              {f.label}{f.required && <span className="text-danger"> *</span>}
              <input
                type={f.secret ? 'password' : 'text'} autoComplete="off" spellCheck={false}
                value={values[f.key] ?? ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                placeholder={f.secret && sameProvider && item.secretsSet[f.key] ? '•••••••• (enregistré, laisser vide pour garder)' : f.placeholder}
                className="mt-1 h-10 w-full rounded-control border border-gray-200 px-3 font-mono text-sm font-normal text-ink placeholder:font-sans placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              {f.hint && <span className="mt-0.5 block font-normal text-ink-subtle">{f.hint}</span>}
            </label>
          ))}
        </div>

        {def.kind === 'PUSH' && (
          <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} loading={busy === 'keys'} onClick={newKeys}>{item.live ? 'Générer de nouvelles clés' : 'Générer les clés et activer'}</Button>
        )}

        {/* Test */}
        <div className="rounded-2xl border border-dashed border-gray-300 p-3">
          <p className="text-xs text-ink-muted">{p.testHint}</p>
          <div className="mt-2 flex gap-2">
            {def.testTarget && (
              <input value={target} onChange={e => setTarget(e.target.value)} type={def.testTarget.type === 'email' ? 'email' : 'tel'} placeholder={def.testTarget.placeholder}
                aria-label={def.testTarget.label} className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-sm" />
            )}
            <Button size="sm" variant="secondary" icon={<Send size={14} />} loading={busy === 'test'} disabled={!!def.testTarget && !target.trim()} onClick={test}>Tester</Button>
          </div>
          {result && <p role="status" className={cn('mt-2 break-words text-xs font-medium', result.ok ? 'text-success-ink' : 'text-danger')}>{result.ok ? '✓ ' : '✗ '}{result.text}</p>}
          {!result && item.lastTestAt && (
            <p className={cn('mt-2 text-[11px]', item.lastTestOk ? 'text-ink-subtle' : 'text-danger')}>
              Dernier test le {new Date(item.lastTestAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} : {item.lastTestOk ? 'réussi' : `échec (${item.lastError ?? ''})`}
            </p>
          )}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-line px-5 py-3">
        <div className="inline-flex rounded-xl bg-surface-sunken p-1 text-xs font-semibold" role="radiogroup" aria-label={`Mode du connecteur ${def.label}`}>
          {(['SIMULATION', 'LIVE'] as const).map(m => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn('rounded-lg px-3 py-1.5', mode === m ? (m === 'LIVE' ? 'bg-success text-white' : 'bg-white text-ink shadow-sm') : 'text-ink-muted')}>
              {m === 'LIVE' ? 'Production' : 'Simulation'}
            </button>
          ))}
        </div>
        <Button size="sm" loading={busy === 'save'} onClick={() => save()}>Enregistrer</Button>
      </footer>
    </section>
  )
}

/** Modèles à créer chez Meta (WhatsApp Manager → Modèles de message), en français, avec ces noms exacts. */
function WhatsAppTemplates() {
  const toast = useToast()
  return (
    <section className="rounded-card border border-surface-line bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-semibold text-ink"><MessageCircle size={16} className="text-[#128c7e]" /> Modèles WhatsApp à faire valider</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-muted">Hors des 24 h qui suivent un message du visiteur, WhatsApp n’accepte que des modèles approuvés. Créez-les chez Meta avec ces noms exacts, langue « Français », puis passez le connecteur en production : Lerena choisit le bon modèle selon le message.</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {WHATSAPP_TEMPLATES.map(t => (
          <li key={t.name} className="rounded-xl border border-surface-line p-3">
            <p className="flex flex-wrap items-center gap-2"><code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-ink">{t.name}</code><Badge tone={t.category === 'MARKETING' ? 'warning' : 'info'}>{t.category === 'MARKETING' ? 'Marketing' : 'Utilitaire'}</Badge></p>
            <p className="mt-1 text-xs text-ink-muted">{t.label}</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-sunken p-2 text-xs text-ink">{t.body}</pre>
            <p className="mt-1 text-[11px] text-ink-subtle">Exemple : {'{{1}}'} = {t.sample[0]} · {'{{2}}'} = {t.sample[1]}</p>
            <button onClick={() => navigator.clipboard?.writeText(t.body).then(() => toast('Texte copié', 'success')).catch(() => null)} className="mt-2 text-xs font-semibold text-brand hover:underline">Copier le texte</button>
          </li>
        ))}
        <li className="rounded-xl border border-surface-line p-3">
          <p className="flex flex-wrap items-center gap-2"><code className="rounded bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-ink">{AUTH_TEMPLATE.name}</code><Badge tone="success">Authentification</Badge></p>
          <p className="mt-1 text-xs text-ink-muted">{AUTH_TEMPLATE.label}. Chez Meta, choisissez la catégorie « Authentification » avec le bouton « Copier le code ».</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-sunken p-2 text-xs text-ink">{AUTH_TEMPLATE.body}</pre>
          <p className="mt-1 text-[11px] text-ink-subtle">Exemple : {'{{1}}'} = {AUTH_TEMPLATE.sample}</p>
        </li>
      </ul>
    </section>
  )
}
