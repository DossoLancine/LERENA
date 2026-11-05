'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bot, CheckCheck, FlaskConical, MessageCircle, MessageSquare, RotateCcw, Search, Send, Settings2, UserRound } from 'lucide-react'
import { assignConversation, getConversation, getMessagingSettings, getQuickReplies, listConversations, replyConversation, saveMessagingSettings, setConversationStatus, simulateInbound, type ConversationFilter } from '@/server/actions/conversations'
import { Badge, Button, Dialog, TextArea, TextInput, useToast } from '@/components/ui'
import { usePolling } from '@/hooks/use-polling'
import { normalizeSms, smsParts, MAX_BODY } from '@/lib/campaign-text'
import { cn } from '@/lib/cn'

type List = NonNullable<Awaited<ReturnType<typeof listConversations>>>
type Thread = NonNullable<Awaited<ReturnType<typeof getConversation>>>

const FILTERS: { id: ConversationFilter; label: string }[] = [{ id: 'open', label: 'À traiter' }, { id: 'mine', label: 'Les miennes' }, { id: 'done', label: 'Traitées' }]
const STATUS: Record<string, string> = { SENT: 'envoyé', SIMULATED: 'simulé', FAILED: 'échec', SKIPPED: 'plus de SMS' }
const time = (iso: string) => {
  const d = new Date(iso); const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
const ChannelIcon = ({ c, size = 13 }: { c: string; size?: number }) => c === 'WHATSAPP' ? <MessageCircle size={size} className="text-[#128c7e]" aria-label="WhatsApp" /> : <MessageSquare size={size} className="text-ink-subtle" aria-label="SMS" />

/** Boîte commune des messages reçus des visiteurs (WhatsApp et SMS). */
export function Inbox({ visitorsPath }: { visitorsPath: string }) {
  const [filter, setFilter] = useState<ConversationFilter>('open')
  const [q, setQ] = useState('')
  const [list, setList] = useState<List | null | undefined>(undefined)
  const [openId, setOpenId] = useState<string | null>(null)
  const [settings, setSettings] = useState(false)
  const load = useCallback(async () => setList(await listConversations(filter, q).catch(() => null)), [filter, q])
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t) }, [load, q])
  usePolling(load, 10000)

  if (list === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne donne pas accès aux conversations.</p>
  return (
    <div className="space-y-4">
      <header className="rounded-3xl bg-gradient-to-br from-[#fde3cc] via-[#fff1e5] to-surface-sunken px-5 py-6 sm:px-7">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700"><MessageCircle size={14} /> Conversations</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{list ? (list.unread ? `${list.unread} message${list.unread > 1 ? 's' : ''} à lire` : list.open ? `${list.open} conversation${list.open > 1 ? 's' : ''} en cours` : 'Tout est traité') : 'Conversations'}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">Les réponses de vos visiteurs par WhatsApp et SMS. Le menu automatique répond aux questions simples (ticket, rendez-vous, annulation) ; le reste arrive ici.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <nav className="inline-flex rounded-xl bg-white/80 p-1 text-sm font-semibold" aria-label="Conversations affichées">
            {FILTERS.map(f => <button key={f.id} onClick={() => { setFilter(f.id); setOpenId(null) }} aria-pressed={filter === f.id} className={cn('rounded-lg px-3 py-1.5', filter === f.id ? 'bg-ink text-white' : 'text-ink-muted')}>{f.label}</button>)}
          </nav>
          {list?.canSettings && <Button size="sm" variant="secondary" icon={<Settings2 size={14} />} onClick={() => setSettings(true)}>Réponses automatiques</Button>}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <section className={cn('overflow-hidden rounded-card border border-surface-line bg-white shadow-card', openId && 'hidden lg:block')}>
          <div className="relative border-b border-surface-line p-3">
            <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nom ou numéro" aria-label="Rechercher une conversation" className="h-10 w-full rounded-xl border border-gray-200 pl-9 pr-3 text-sm" />
          </div>
          {list === undefined ? <div className="m-3 h-40 animate-pulse rounded-xl bg-gray-100" /> : list.conversations.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-subtle">{filter === 'done' ? 'Aucune conversation traitée.' : 'Aucun message en attente. Les réponses des visiteurs arriveront ici.'}</p>
          ) : (
            <ul className="max-h-[65vh] divide-y divide-surface-line overflow-y-auto">
              {list.conversations.map(c => (
                <li key={c.id}>
                  <button onClick={() => setOpenId(c.id)} aria-current={openId === c.id} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-sunken/60', openId === c.id && 'bg-brand-50/60')}>
                    <span className="mt-0.5"><ChannelIcon c={c.channel} size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm text-ink', c.unread ? 'font-bold' : 'font-semibold')}>{c.name ?? c.phone}</span>
                        <span className="shrink-0 text-[11px] text-ink-subtle">{time(c.lastMessageAt)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{c.last ? `${c.last.direction === 'OUT' ? (c.last.auto ? 'Réponse auto : ' : 'Vous : ') : ''}${c.last.body}` : ''}</span>
                        {c.unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white tabular-nums">{c.unread}</span>}
                      </span>
                      {(c.wantsHuman || c.assignee) && <span className="mt-1 flex flex-wrap gap-1">{c.wantsHuman && <Badge tone="warning">Veut parler à l’accueil</Badge>}{c.assignee && <Badge>{c.assignee}</Badge>}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={cn(!openId && 'hidden lg:block')}>
          {openId ? <ThreadView key={openId} id={openId} visitorsPath={visitorsPath} canReply={!!list?.canReply} onBack={() => setOpenId(null)} onChange={load} />
            : <div className="flex h-full min-h-[300px] items-center justify-center rounded-card border border-dashed border-surface-line bg-white text-sm text-ink-subtle">Choisissez une conversation</div>}
        </section>
      </div>
      {settings && <SettingsDialog onClose={() => setSettings(false)} onSimulated={id => { setSettings(false); setFilter('open'); load().then(() => setOpenId(id)) }} />}
    </div>
  )
}

function ThreadView({ id, visitorsPath, canReply, onBack, onChange }: { id: string; visitorsPath: string; canReply: boolean; onBack: () => void; onChange: () => void }) {
  const toast = useToast()
  const [t, setT] = useState<Thread | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState<string[]>([])
  const end = useRef<HTMLDivElement>(null)
  const load = useCallback(async () => setT(await getConversation(id).catch(() => null)), [id])
  useEffect(() => { load(); getQuickReplies().then(setQuick).catch(() => null) }, [load])
  usePolling(load, 8000)
  const count = t?.messages.length ?? 0
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [count])

  if (t === undefined) return <div className="h-96 animate-pulse rounded-card bg-gray-100" />
  if (t === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Conversation introuvable.</p>
  const full = `${t.orgName} : ${t.replyChannel === 'SMS' ? normalizeSms(text) : text}`
  const parts = smsParts(full)
  const send = async () => {
    setBusy(true)
    const res = await replyConversation(t.id, text)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    setText(''); load(); onChange()
  }
  const status = async (s: 'OPEN' | 'DONE') => {
    const res = await setConversationStatus(t.id, s)
    if (!res.success) return toast(res.error, 'error')
    toast(s === 'DONE' ? 'Conversation traitée' : 'Conversation rouverte', 'success'); load(); onChange()
  }
  const assign = async (userId: string) => {
    const res = await assignConversation(t.id, userId || null)
    if (!res.success) return toast(res.error, 'error')
    load(); onChange()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-surface-line px-4 py-3">
        <button onClick={onBack} className="rounded-lg p-1.5 text-ink-muted hover:bg-gray-100 lg:hidden" aria-label="Retour à la liste"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-ink"><ChannelIcon c={t.channel} size={15} /> {t.customer?.name ?? t.phone}</p>
          <p className="text-xs text-ink-muted">
            {t.customer?.name ? `${t.phone} · ` : ''}{t.customer ? <Link href={`${visitorsPath}/${t.customer.id}`} className="font-semibold text-brand hover:underline">Fiche visiteur</Link> : 'Pas encore de fiche'}
            {t.ticket && <> · ticket <b className="text-ink">{t.ticket.displayNum}</b> ({t.ticket.service})</>}
            {t.appointment && <> · RDV {new Date(t.appointment.scheduledDate).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</>}
          </p>
        </div>
        {canReply && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-muted"><UserRound size={13} />
              <select value={t.assignedToId ?? ''} onChange={e => assign(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-ink" aria-label="Membre chargé de répondre">
                <option value="">Personne</option>
                {t.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            {t.status === 'OPEN' ? <Button size="sm" variant="secondary" icon={<CheckCheck size={14} />} onClick={() => status('DONE')}>Traité</Button>
              : <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => status('OPEN')}>Rouvrir</Button>}
          </div>
        )}
      </header>

      <div className="max-h-[55vh] min-h-[280px] flex-1 space-y-2 overflow-y-auto bg-surface-sunken/50 px-4 py-4">
        {t.messages.map(m => {
          const out = m.direction === 'OUT'
          return (
            <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', out ? (m.auto ? 'rounded-br-md bg-white text-ink ring-1 ring-surface-line' : 'rounded-br-md bg-brand text-white') : 'rounded-bl-md bg-white text-ink')}>
                {out && m.auto && <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ink-subtle"><Bot size={11} /> Réponse automatique</p>}
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={cn('mt-1 text-right text-[10px]', out && !m.auto ? 'text-white/75' : 'text-ink-subtle')}>
                  {m.author ? `${m.author} · ` : ''}{m.channel === 'WHATSAPP' ? 'WhatsApp' : 'SMS'}{out && m.channel === 'SMS' && m.parts > 1 ? ` · ${m.parts} parties` : ''}{out && m.status && m.status !== 'SENT' ? ` · ${STATUS[m.status] ?? m.status}` : ''} · {time(m.createdAt)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>

      {canReply && (
        (
          <div className="border-t border-surface-line p-3">
            {quick.length > 0 && (
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {quick.map(qr => <button key={qr} onClick={() => setText(qr)} className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-ink-muted ring-1 ring-gray-200 hover:text-ink">{qr.length > 40 ? `${qr.slice(0, 40)}…` : qr}</button>)}
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={MAX_BODY} placeholder="Votre réponse" aria-label="Votre réponse"
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) send() }}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              <Button icon={<Send size={15} />} loading={busy} disabled={text.trim().length < 2} onClick={send}>Envoyer</Button>
            </div>
            <p className="mt-1.5 text-[11px] text-ink-subtle">
              {t.replyChannel === 'WHATSAPP' ? `Réponse par WhatsApp${t.waLive ? '' : ' (simulation : rien n’est envoyé)'} · gratuite pendant 24 h après le message du visiteur.` : `Réponse par SMS · ${parts.length} caractères · ${parts.parts} SMS${parts.unicode ? ' (émoji ou caractères spéciaux : 70 caractères par SMS)' : ''}.`} Ctrl + Entrée pour envoyer.
            </p>
          </div>
        )
      )}
    </div>
  )
}

function SettingsDialog({ onClose, onSimulated }: { onClose: () => void; onSimulated: (id: string) => void }) {
  const toast = useToast()
  const [s, setS] = useState<NonNullable<Awaited<ReturnType<typeof getMessagingSettings>>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [sim, setSim] = useState({ phone: '+2250700000000', text: 'Bonjour, je serai en retard de 10 minutes', channel: 'WHATSAPP' as 'SMS' | 'WHATSAPP' })
  useEffect(() => { getMessagingSettings().then(setS).catch(() => null) }, [])
  if (!s) return <Dialog open onClose={onClose} title="Réponses automatiques"><div className="h-40 animate-pulse rounded-xl bg-gray-100" /></Dialog>
  const save = async () => {
    setBusy(true)
    const res = await saveMessagingSettings(s)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Réglages enregistrés', 'success'); onClose()
  }
  const simulate = async () => {
    setBusy(true)
    const res = await simulateInbound(sim)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Message simulé reçu', 'success'); onSimulated(res.id)
  }
  const canSimulate = sim.channel === 'WHATSAPP' ? !s.waLive : !s.smsLive
  return (
    <Dialog open onClose={onClose} title="Réponses automatiques" size="lg">
      <div className="space-y-5">
        <label className="flex items-start gap-3 rounded-xl border border-surface-line p-3">
          <input type="checkbox" className="mt-1 accent-brand" checked={s.autoMenu} onChange={e => setS({ ...s, autoMenu: e.target.checked })} />
          <span><span className="block text-sm font-semibold text-ink">Menu automatique</span><span className="block text-xs text-ink-muted">1 Mon ticket · 2 Mon rendez-vous · 3 Annuler mon rendez-vous · 4 Parler à l’accueil. Envoyé au plus une fois par demi-journée, jamais pendant qu’un membre de l’équipe répond.</span></span>
        </label>
        <TextArea label="Message hors des horaires" rows={2} maxLength={300} value={s.awayMessage} onChange={e => setS({ ...s, awayMessage: e.target.value })} hint="Vide : « … est fermé pour le moment. Votre message est bien reçu : l’accueil vous répondra à la réouverture. »" />
        <div className="rounded-xl border border-surface-line p-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 accent-brand" checked={s.whatsappTickets} onChange={e => setS({ ...s, whatsappTickets: e.target.checked })} />
            <span><span className="block text-sm font-semibold text-ink">Prise de ticket par message</span><span className="block text-xs text-ink-muted">Le visiteur envoie « TICKET {s.code || 'CODE'} », choisit son service et reçoit son ticket avec le lien de suivi. Refusé si vous exigez la présence sur place (GPS).</span></span>
          </label>
          <div className="mt-3 max-w-[200px]"><TextInput label="Code de l’établissement" value={s.code} maxLength={12} onChange={e => setS({ ...s, code: e.target.value.toUpperCase() })} hint="À afficher sur l’affiche" /></div>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Réponses rapides de l’équipe</p>
          <p className="text-[11px] text-ink-subtle">Une par ligne, 10 au plus.</p>
          <textarea rows={4} value={s.quickReplies.join('\n')} onChange={e => setS({ ...s, quickReplies: e.target.value.split('\n') })} aria-label="Réponses rapides" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" placeholder={'Vos résultats sont prêts.\nMerci, nous gardons votre place.'} />
        </div>
        <Button fullWidth loading={busy} onClick={save}>Enregistrer</Button>

        <section className="rounded-xl bg-surface-sunken p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><FlaskConical size={15} className="text-brand" /> Tester sans téléphone</p>
          <p className="text-xs text-ink-muted">Simule un message reçu d’un visiteur : la réponse automatique et le journal s’affichent comme en vrai, sans rien envoyer. Pratique tant que le connecteur n’est pas branché.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px]">
            <TextInput label="Numéro du visiteur" value={sim.phone} onChange={e => setSim({ ...sim, phone: e.target.value })} />
            <label className="block text-sm font-medium text-ink">Canal
              <select value={sim.channel} onChange={e => setSim({ ...sim, channel: e.target.value as 'SMS' | 'WHATSAPP' })} className="mt-1.5 h-11 w-full rounded-control border border-gray-200 bg-white px-2 text-sm"><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option></select>
            </label>
          </div>
          <div className="mt-2"><TextInput label="Message" value={sim.text} onChange={e => setSim({ ...sim, text: e.target.value })} hint="Essayez : MENU, 1, 2, 3, 4, TICKET suivi du code, ou un texte libre" /></div>
          <Button className="mt-3" variant="secondary" loading={busy} disabled={!canSimulate} onClick={simulate}>Simuler la réception</Button>
          {!canSimulate && <p className="mt-1 text-[11px] text-ink-subtle">Connecteur branché : écrivez depuis un vrai téléphone.</p>}
        </section>
      </div>
    </Dialog>
  )
}
