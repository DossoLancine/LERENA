'use client'

import { useState } from 'react'
import { Star, CheckCircle2, Sparkles, Share2, Tag, Gift, X } from 'lucide-react'
import { submitNPS } from '@/server/actions/marketing'
import { FEEDBACK_REASONS, type FeedbackReason } from '@/lib/customer-labels'

// ==========================================
// 1. WIDGET NPS (Notation Post-Service)
// ==========================================
export function NPSWidget({ ticketId, onRated }: { ticketId: string; onRated?: () => void }) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  // 1. étoiles (enregistrées tout de suite) → 2. motif et commentaire facultatifs → 3. merci
  const [step, setStep] = useState<'stars' | 'details' | 'done'>('stars')
  const [reason, setReason] = useState<FeedbackReason | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const low = selected > 0 && selected <= 3

  const rate = async (star: number) => {
    setSelected(star)
    onRated?.()
    setLoading(true)
    await submitNPS(ticketId, star)
    setLoading(false)
    setStep('details')
  }
  const sendDetails = async () => {
    setLoading(true)
    await submitNPS(ticketId, selected, { comment, reason })
    setLoading(false)
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="animate-pop-in rounded-[22px] bg-white p-5 text-center shadow-card ring-1 ring-black/[0.03]">
        <div className="flex justify-center gap-1" aria-label={`${selected} étoiles sur 5`}>
          {[1, 2, 3, 4, 5].map(s => <Star key={s} size={20} className={s <= selected ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />)}
        </div>
        <p className="mt-2 font-display text-lg font-bold text-ink">Merci pour votre avis</p>
        <p className="mt-1 text-sm text-ink-muted">{low ? 'L’établissement l’a reçu et peut vous recontacter pour en parler.' : 'Il aide l’équipe à garder le cap.'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-[22px] bg-white p-5 shadow-card ring-1 ring-black/[0.03]">
      <h3 className="text-center font-display text-lg font-bold text-ink">Comment s&apos;est passé votre passage ?</h3>
      <div className="mt-3 flex justify-center gap-1.5" role="radiogroup" aria-label="Votre note">
        {[1, 2, 3, 4, 5].map(star => (
          <button key={star} role="radio" aria-checked={selected === star} aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
            onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)}
            onClick={() => rate(star)} disabled={loading} className="p-0.5 transition-transform hover:scale-110 active:scale-95">
            <Star size={36} className={`transition-colors ${star <= (hovered || selected) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
          </button>
        ))}
      </div>
      <p className="mt-1 text-center text-xs text-ink-subtle">
        {LABELS[(hovered || selected) as 1 | 2 | 3 | 4 | 5] ?? 'Touchez une étoile'}
      </p>

      {step === 'details' && (
        <div className="mt-4 animate-rise-in space-y-3 border-t border-surface-line pt-4">
          {low && (
            <>
              <p className="text-sm font-semibold text-ink">Qu’est-ce qui n’a pas été ?</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FEEDBACK_REASONS) as FeedbackReason[]).map(r => (
                  <button key={r} onClick={() => setReason(reason === r ? null : r)} aria-pressed={reason === r}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${reason === r ? 'border-brand bg-brand text-white' : 'border-surface-line text-ink-muted'}`}>
                    {FEEDBACK_REASONS[r]}
                  </button>
                ))}
              </div>
            </>
          )}
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} maxLength={500}
            placeholder={low ? 'Racontez-nous en quelques mots (facultatif)' : 'Un mot pour l’équipe ? (facultatif)'}
            className="w-full resize-none rounded-2xl border border-gray-200 px-3 py-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          <div className="flex gap-2">
            <button onClick={() => setStep('done')} className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink-muted">Passer</button>
            <button onClick={sendDetails} disabled={loading || (!comment.trim() && !reason)}
              className="flex-1 rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Envoyer</button>
          </div>
        </div>
      )}
    </div>
  )
}

const LABELS = { 1: 'Très mauvais', 2: 'Mauvais', 3: 'Moyen', 4: 'Bien', 5: 'Excellent' } as const
