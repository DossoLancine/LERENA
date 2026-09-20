'use client'

import { useState } from 'react'
import { Star, CheckCircle2, Sparkles, Share2, Tag, Gift, X } from 'lucide-react'
import { submitNPS, claimTicketPromotion, cancelTicketPromotion } from '@/app/actions/marketing'

// ==========================================
// 1. WIDGET NPS (Notation Post-Service)
// ==========================================
export function NPSWidget({ ticketId }: { ticketId: string }) {
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  if (submitted) {
    return (
      <div className="bg-green-50 rounded-2xl border border-green-100 p-6 text-center">
        <div className="text-4xl mb-2">{'⭐'.repeat(selected)}</div>
        <p className="font-bold text-green-700">Merci pour votre avis !</p>
        <p className="text-sm text-green-600 mt-1">Votre retour nous aide à améliorer nos services.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 text-center mb-1">Comment s&apos;est passé votre service ?</h3>
      <p className="text-xs text-gray-500 text-center mb-4">Notez votre expérience</p>
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={async () => {
              setSelected(star)
              setLoading(true)
              await submitNPS(ticketId, star)
              setSubmitted(true)
              setLoading(false)
            }}
            disabled={loading}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={36}
              className={`transition-colors ${
                star <= (hovered || selected)
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center">
        {hovered === 1 ? 'Très mauvais' : hovered === 2 ? 'Mauvais' : hovered === 3 ? 'Correct' : hovered === 4 ? 'Bien' : hovered === 5 ? 'Excellent !' : 'Touchez une étoile'}
      </p>
    </div>
  )
}

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
                className="w-full py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
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
