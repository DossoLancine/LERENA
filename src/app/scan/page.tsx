'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Search } from 'lucide-react'
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
          <div className="relative h-64 w-64 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" aria-hidden="true" />
          <p className="absolute bottom-24 px-8 text-center text-sm font-medium">
            {state === 'unknown' ? t('scan.notAttends') : t('scan.hint')}
          </p>
        </div>
      )}
    </main>
  )
}
