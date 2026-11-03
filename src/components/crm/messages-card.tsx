'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquareText, Send, Lock } from 'lucide-react'
import { getCustomerMessages, sendDirectSms } from '@/server/actions/customers'
import { MAX_BODY, normalizeSms, smsParts } from '@/lib/campaign-text'
import { Button, Dialog, Badge, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getCustomerMessages>>>

const QUICK = [
  'Vos résultats sont prêts. Vous pouvez passer les retirer aux heures d\'ouverture.',
  'Votre dossier est complet, merci. Nous revenons vers vous rapidement.',
  'Il manque un document à votre dossier. Merci de l\'apporter lors de votre prochain passage.'
]

/** SMS reçus par le visiteur de la part de l'établissement, et SMS écrit par l'équipe. */
export function MessagesCard({ customerId, orgName, name, open, onOpenChange }: {
  customerId: string; orgName: string; name: string; open: boolean; onOpenChange: (open: boolean) => void
}) {
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => setData(await getCustomerMessages(customerId).catch(() => null)), [customerId])
  useEffect(() => { load() }, [load])

  const full = `${orgName} : ${normalizeSms(text)}`
  const parts = smsParts(full)
  const send = async () => {
    setBusy(true)
    const res = await sendDirectSms(customerId, text)
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('SMS envoyé', 'success')
    setText('')
    onOpenChange(false)
    load()
  }

  return (
    <>
      <section className="rounded-card border border-surface-line bg-white shadow-card">
        <header className="flex items-center justify-between border-b border-surface-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><MessageSquareText size={16} className="text-brand" /> SMS reçus de vous</h2>
          {data?.enabled && !data.optedOut && <Button size="sm" variant="secondary" onClick={() => onOpenChange(true)}>Écrire</Button>}
        </header>
        {!data ? <div className="m-4 h-12 animate-pulse rounded-xl bg-gray-100" /> : (
          <ul className="max-h-72 divide-y divide-surface-line overflow-y-auto">
            {data.optedOut && <li className="bg-warning-soft/50 px-5 py-2.5 text-xs font-semibold text-warning-ink">A demandé à ne plus recevoir vos messages d’information (STOP).</li>}
            {data.messages.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-subtle">Aucun SMS envoyé à ce visiteur.</li>}
            {data.messages.map(m => (
              <li key={m.id} className="px-5 py-2.5">
                <p className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle">
                  <span className="font-semibold uppercase tracking-wide">{m.label}</span>
                  <span>{new Date(m.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </p>
                <p className="mt-0.5 line-clamp-3 text-sm text-ink">{m.body === '[effacé]' ? <span className="italic text-ink-subtle">Contenu effacé (plus de 6 mois)</span> : m.body}</p>
                {m.status !== 'SENT' && <Badge tone={m.status === 'FAILED' ? 'danger' : 'neutral'} className="mt-1">{m.status === 'FAILED' ? 'Échec' : m.status === 'SKIPPED' ? 'Non envoyé (plus de SMS)' : 'Simulé'}</Badge>}
              </li>
            ))}
          </ul>
        )}
        {data && !data.enabled && (
          <p className="flex items-start gap-2 border-t border-surface-line px-5 py-3 text-xs text-ink-muted"><Lock size={13} className="mt-0.5 shrink-0" /> Écrire aux visiteurs par SMS est inclus à partir du forfait Pro.</p>
        )}
      </section>

      <Dialog open={open} onClose={() => onOpenChange(false)} title={`SMS à ${name}`}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map(q => (
              <button key={q} onClick={() => setText(q)} className="rounded-full border border-surface-line px-2.5 py-1 text-left text-xs text-ink-muted hover:border-brand hover:text-ink">{q.split('.')[0]}</button>
            ))}
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={MAX_BODY} autoFocus
            placeholder="Votre message…"
            className="w-full resize-none rounded-control border border-gray-200 px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          <div className="rounded-2xl bg-surface-sunken p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Le visiteur recevra</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{full}</p>
            <p className={cn('mt-2 text-xs', parts.parts > 1 ? 'text-warning-ink' : 'text-ink-subtle')}>
              {parts.length} caractères{parts.parts > 1 ? ` · long : il arrivera en ${parts.parts} parties` : ''}{parts.unicode ? ' (caractères spéciaux)' : ''}
            </p>
          </div>
          <Button fullWidth icon={<Send size={15} />} loading={busy} disabled={text.trim().length < 2} onClick={send}>Envoyer</Button>
          <p className="text-center text-xs text-ink-subtle">Décompté de vos SMS. Pas de diagnostic ni d’information médicale par SMS.</p>
        </div>
      </Dialog>
    </>
  )
}
