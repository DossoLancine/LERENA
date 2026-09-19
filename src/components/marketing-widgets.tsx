'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { submitNPS } from '@/app/actions/marketing'

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

export function PromoCarousel({ promotions }: { promotions: any[] }) {
  const [current, setCurrent] = useState(0)

  if (!promotions || promotions.length === 0) return null

  const promo = promotions[current]

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider">Offres & Promotions</p>
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
            <h4 className="font-bold text-gray-900">{promo.title}</h4>
            {promo.description && (
              <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{promo.description}</p>
            )}
          </div>
          {promo.price && (
            <span className="shrink-0 bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {promo.price}
            </span>
          )}
        </div>
      </div>

      {promotions.length > 1 && (
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="flex-1 py-1.5 text-xs font-medium text-orange-500 border border-orange-200 rounded-lg disabled:opacity-30"
          >
            ← Précédent
          </button>
          <button
            onClick={() => setCurrent(c => Math.min(promotions.length - 1, c + 1))}
            disabled={current === promotions.length - 1}
            className="flex-1 py-1.5 text-xs font-medium text-orange-500 border border-orange-200 rounded-lg disabled:opacity-30"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
