'use client'

import { useState } from 'react'
import { Navigation, Volume2 } from 'lucide-react'
import { distanceKm } from '@/lib/geo'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'

// Vitesse moyenne en ville, détours compris : estimation volontairement prudente
const CITY_KMH = 18
const ROAD_FACTOR = 1.4

/**
 * « Partez maintenant » : compare le trajet jusqu'à l'établissement au temps d'attente restant,
 * pour que l'usager attende chez lui plutôt que sur place.
 */
export function LeaveNowCard({ orgLat, orgLng, waitMin }: { orgLat: number | null; orgLng: number | null; waitMin: number }) {
  const [travelMin, setTravelMin] = useState<number | null>(null)
  const [state, setState] = useState<'idle' | 'locating' | 'denied'>('idle')

  if (orgLat === null || orgLng === null) return null

  const locate = () => {
    haptics.tap()
    if (!navigator.geolocation) return setState('denied')
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      pos => {
        const km = distanceKm(pos.coords.latitude, pos.coords.longitude, orgLat, orgLng) * ROAD_FACTOR
        setTravelMin(Math.max(1, Math.round((km / CITY_KMH) * 60)))
        setState('idle')
      },
      () => setState('denied'),
      { maximumAge: 2 * 60 * 1000, timeout: 8000 }
    )
  }

  if (travelMin === null) {
    return (
      <button onClick={locate} disabled={state === 'locating'}
        className="pressable flex w-full items-center gap-3 rounded-card border border-surface-line bg-white p-4 text-left shadow-card disabled:opacity-60">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-info"><Navigation size={20} /></span>
        <span>
          <span className="block text-sm font-bold text-ink">{state === 'locating' ? t('leaveNow.locating') : t('leaveNow.cta')}</span>
          <span className="block text-xs text-ink-muted">{state === 'denied' ? t('leaveNow.denied') : t('leaveNow.hint')}</span>
        </span>
      </button>
    )
  }

  // Marge de 5 min pour se garer, entrer et trouver la salle
  const leaveIn = waitMin - travelMin - 5
  const urgent = leaveIn <= 0

  return (
    <div className={`flex items-center gap-3 rounded-card p-4 animate-rise-in ${urgent ? 'bg-brand text-white' : 'border border-green-100 bg-success-soft text-success-ink'}`} role="status">
      <Navigation size={22} className="shrink-0" />
      <div>
        <p className="font-bold">{urgent ? t('leaveNow.now') : t('leaveNow.inMinutes', { minutes: leaveIn })}</p>
        <p className={`text-xs ${urgent ? 'text-white/85' : ''}`}>{t('leaveNow.travel', { minutes: travelMin })}</p>
      </div>
    </div>
  )
}

/** Lecture à voix haute de la position, pour les personnes qui lisent difficilement l'écran. */
export function SpeakPositionButton({ text }: { text: string }) {
  const speak = () => {
    haptics.tap()
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'fr-FR'
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button onClick={speak} aria-label={t('leaveNow.speak')} title={t('leaveNow.speak')}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 active:scale-95">
      <Volume2 size={17} />
    </button>
  )
}
