'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Search, Flashlight } from 'lucide-react'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'

// Détecteur de QR code intégré aux navigateurs Android récents (pas de bibliothèque à télécharger)
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }
}

// Accepte les QR codes Lerena : lien vers un établissement ou vers un ticket
function routeFromQr(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    const match = url.pathname.match(/^\/(org|ticket)\/([\w-]+)/)
    return match ? `/${match[1]}/${match[2]}` : null
  } catch {
    return null
  }
}

export default function ScanPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'starting' | 'scanning' | 'unsupported' | 'denied' | 'unknown'>('starting')
  // Lampe de l'appareil photo (si le téléphone la propose) pour scanner dans un couloir sombre
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const [torch, setTorch] = useState<boolean | null>(null)
  const toggleTorch = async () => {
    const track = trackRef.current
    if (!track || torch === null) return
    haptics.tap()
    try { await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch) } catch { setTorch(null) }
  }

  useEffect(() => {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setState('unsupported')
      return
    }

    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] })

    const loop = async () => {
      if (stopped || !videoRef.current) return
      try {
        const codes = await detector.detect(videoRef.current)
        const target = codes.map(c => routeFromQr(c.rawValue)).find(Boolean)
        if (target) {
          stopped = true
          haptics.success()
          router.push(target)
          return
        }
        if (codes.length > 0) setState('unknown')
      } catch {}
      frame = window.setTimeout(loop, 250)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(s => {
        stream = s
        const track = s.getVideoTracks()[0]
        trackRef.current = track ?? null
        const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined
        if (caps?.torch) setTorch(false)
        if (videoRef.current) {
          videoRef.current.srcObject = s
          videoRef.current.play().catch(() => {})
        }
        setState('scanning')
        loop()
      })
      .catch(() => setState('denied'))

    return () => {
      stopped = true
      clearTimeout(frame)
      stream?.getTracks().forEach(track => track.stop())
    }
  }, [router])

  const fallback = state === 'unsupported' || state === 'denied'

  return (
    <main className="flex min-h-screen flex-col bg-black text-white">
      <header className="flex items-center gap-3 p-4">
        <Link href="/" aria-label={t('common.backHome')} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-bold">{t('scan.title')}</h1>
      </header>

      {fallback ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10"><Camera size={36} /></span>
          <p className="text-lg font-semibold">{state === 'denied' ? t('scan.denied') : t('scan.unsupported')}</p>
          <p className="mt-2 text-sm text-white/70">{t('scan.useCamera')}</p>
          <Link href="/explore" className="pressable mt-8 flex items-center gap-2 rounded-2xl bg-brand px-6 py-4 font-bold">
            <Search size={18} /> {t('landing.find')}
          </Link>
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" playsInline muted aria-label={t('scan.title')} />
          {/* Cadre de visée */}
          <div className="relative h-64 w-64 rounded-[36px] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]" aria-hidden="true">
            {/* Coins du cadre et ligne de balayage */}
            {['left-0 top-0 border-l-4 border-t-4 rounded-tl-[36px]', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-[36px]', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-[36px]', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-[36px]'].map(c => (
              <span key={c} className={`absolute h-12 w-12 border-white ${c}`} />
            ))}
            {state === 'scanning' && <span className="absolute inset-x-6 top-6 h-0.5 animate-scan-line rounded-full bg-gradient-to-r from-transparent via-[#fb923c] to-transparent shadow-[0_0_12px_2px_rgba(251,146,60,0.7)]" />}
          </div>
          {torch !== null && (
            <button type="button" onClick={toggleTorch} aria-pressed={torch} aria-label="Lampe" className={`absolute bottom-40 flex h-14 w-14 items-center justify-center rounded-full backdrop-blur ${torch ? 'bg-white text-black' : 'bg-white/20 text-white'}`}>
              <Flashlight size={22} />
            </button>
          )}
          <p className="absolute bottom-24 px-8 text-center text-sm font-medium">
            {state === 'unknown' ? t('scan.notAttends') : t('scan.hint')}
          </p>
        </div>
      )}
    </main>
  )
}
