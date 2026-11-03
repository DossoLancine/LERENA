'use client'

import { useState } from 'react'
import { Star, CheckCircle2, Sparkles, Share2, Tag, Gift, X } from 'lucide-react'
import { submitNPS, claimTicketPromotion, cancelTicketPromotion } from '@/server/actions/marketing'
import { FEEDBACK_REASONS, type FeedbackReason } from '@/lib/customer-labels'

// ==========================================
// 1. WIDGET NPS (Notation Post-Service)
// ==========================================
export function NPSWidget({ ticketId }: { ticketId: string }) {
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

// ==========================================
// 2. CARROUSEL DE PROMOTIONS & CONVERSION
// ==========================================
export function PromoCarousel({
  promotions,
  ticketId,
  claimedPromoTitle: initialClaimedTitle,
  claimedPromoPrice: initialClaimedPrice,
  onPromoClaimed
}: {
  promotions: any[]
  ticketId?: string
  claimedPromoTitle?: string | null
  claimedPromoPrice?: string | null
  onPromoClaimed?: (title: string, price: string) => void
}) {
  const [current, setCurrent] = useState(0)
  const [claimedTitle, setClaimedTitle] = useState<string | null>(initialClaimedTitle || null)
  const [claimedPrice, setClaimedPrice] = useState<string | null>(initialClaimedPrice || null)
  const [isClaiming, setIsClaiming] = useState(false)

  if (!promotions || promotions.length === 0) return null

  const promo = promotions[current]
  const isThisPromoClaimed = claimedTitle === promo.title

  const handleClaim = async (promoId: string) => {
    if (!ticketId) return
    setIsClaiming(true)
    const res = await claimTicketPromotion(ticketId, promoId)
    if (res.success) {
      setClaimedTitle(res.claimedPromoTitle || promo.title)
      setClaimedPrice(res.claimedPromoPrice || promo.price || 'Spécial')
      if (onPromoClaimed) {
        onPromoClaimed(res.claimedPromoTitle || promo.title, res.claimedPromoPrice || promo.price || '')
      }
    }
    setIsClaiming(false)
  }

  const handleCancelClaim = async () => {
    if (!ticketId) return
    setIsClaiming(true)
    await cancelTicketPromotion(ticketId)
    setClaimedTitle(null)
    setClaimedPrice(null)
    setIsClaiming(false)
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
          <Gift size={14} /> Offres & Promotions
        </p>
        {promotions.length > 1 && (
          <div className="flex gap-1">
            {promotions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-orange-500 w-3' : 'bg-orange-200'}`}
              />
            ))}
          </div>
        )}
      </div>

      {promo.imageUrl && (
        <img
          src={promo.imageUrl}
          alt={promo.title}
          className="w-full h-36 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-bold text-gray-900 text-base">{promo.title}</h4>
            {promo.description && (
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">{promo.description}</p>
            )}
          </div>
          {promo.price && (
            <span className="shrink-0 bg-orange-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-sm">
              {promo.price}
            </span>
          )}
        </div>

        {/* Le Juste Milieu : Action d'attribution de l'offre */}
        {ticketId && (
          <div className="mt-3 pt-3 border-t border-orange-100/60">
            {isThisPromoClaimed ? (
              <div className="bg-emerald-600 text-white rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="shrink-0 text-white" />
                  <div>
                    <p className="text-xs font-bold">Offre activée sur votre ticket !</p>
                    <p className="text-[11px] opacity-90">Présentez simplement votre écran à l&apos;agent au guichet.</p>
                  </div>
                </div>
                <button
                  onClick={handleCancelClaim}
                  disabled={isClaiming}
                  className="p-1 hover:bg-emerald-700 rounded-lg text-white/80 hover:text-white"
                  title="Annuler"
                >
                  <X size={14} />
                </button>
              </div>
            ) : claimedTitle ? (
              <div className="text-xs text-gray-500 text-center py-1">
                Une autre offre est déjà associée à votre ticket ({claimedTitle}).
              </div>
            ) : (
              <button
                onClick={() => handleClaim(promo.id)}
                disabled={isClaiming}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Sparkles size={14} />
                {isClaiming ? 'Activation en cours...' : 'Ajouter à ma visite (Payer au guichet)'}
              </button>
            )}

            {/* Alternative universelle : WhatsApp pour plus tard ou un proche */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🎁 Offre spéciale : ${promo.title} (${promo.price || ''}) chez LERENA !`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 hover:text-green-600 flex items-center justify-center gap-1.5 mt-2 transition-colors"
            >
              <Share2 size={12} /> Partager ou réserver via WhatsApp
            </a>
          </div>
        )}
      </div>

      {promotions.length > 1 && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="flex-1 py-1.5 text-xs font-medium text-orange-600 bg-white/70 hover:bg-white border border-orange-200 rounded-lg disabled:opacity-30 transition-all"
          >
            ← Précédent
          </button>
          <button
            onClick={() => setCurrent(c => Math.min(promotions.length - 1, c + 1))}
            disabled={current === promotions.length - 1}
            className="flex-1 py-1.5 text-xs font-medium text-orange-600 bg-white/70 hover:bg-white border border-orange-200 rounded-lg disabled:opacity-30 transition-all"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
