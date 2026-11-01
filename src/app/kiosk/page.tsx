'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Ticket, Users, Clock,
  Volume2, ArrowLeft, UserRound, Accessibility, WifiOff, Hand
} from 'lucide-react'
import { PairingScreen, readDeviceToken } from '@/components/devices/pairing-screen'
import { getDeviceStatus, getKioskBoard, issueKioskTicket } from '@/server/actions/devices'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { haptics } from '@/lib/haptics'
import type { Priority } from '@/lib/constants'
import { cn } from '@/lib/cn'
import { iconFor } from '@/lib/icons'
import { t } from '@/lib/i18n'

type Board = NonNullable<Awaited<ReturnType<typeof getKioskBoard>>>
type Issued = Extract<Awaited<ReturnType<typeof issueKioskTicket>>, { success: true }>['ticket']
type Step = 'welcome' | 'service' | 'priority' | 'ticket'

const IDLE_MS = 30_000
const TICKET_SCREEN_MS = 15_000

function speak(text: string) {
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'fr-FR'
    u.rate = 0.9
    window.speechSynthesis.speak(u)
  } catch {}
}

export default function KioskPage() {
  const [token, setToken] = useState<string | null>(null)
  const [paired, setPaired] = useState<boolean | null>(null)
  const [board, setBoard] = useState<Board | null>(null)
  const [offline, setOffline] = useState(false)
  const [step, setStep] = useState<Step>('welcome')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout>>()

  useWakeLock(true)

  // Borne déjà appairée sur cet appareil ?
  useEffect(() => {
    const saved = readDeviceToken('KIOSK')
    if (!saved) return setPaired(false)
    setToken(saved)
    getDeviceStatus(saved).then(s => setPaired(!!s?.paired)).catch(() => setPaired(false))
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const b = await getKioskBoard(token)
      if (!b) return setPaired(false) // borne retirée du tableau de bord
      setBoard(b)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [token])

  const live = useOrgRealtime(board?.orgId, load)
  usePolling(load, live ? 30_000 : 10_000, !!paired)

  const reset = useCallback(() => {
    clearTimeout(idleTimer.current)
    setStep('welcome')
    setServiceId(null)
    setIssued(null)
    setError(null)
  }, [])

  // Retour automatique à l'accueil après une période sans contact
  const touch = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(reset, step === 'ticket' ? TICKET_SCREEN_MS : IDLE_MS)
  }, [reset, step])

  useEffect(() => {
    if (step === 'welcome') return clearTimeout(idleTimer.current)
    touch()
    return () => clearTimeout(idleTimer.current)
  }, [step, touch])

  const start = () => {
    haptics.tap()
    // Mode kiosque : plein écran au premier contact
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
    setStep('service')
  }

  const issue = async (priority: Priority) => {
    if (!token || !serviceId || busy) return
    haptics.tap()
    setBusy(true)
    setError(null)
    try {
      const res = await issueKioskTicket(token, serviceId, priority)
      if (!res.success) {
        setError(res.error)
        return
      }
      haptics.success()
      setIssued(res.ticket)
      setQr(await QRCode.toDataURL(`${window.location.origin}/ticket/${res.ticket.id}`, { width: 240, margin: 1 }))
      setStep('ticket')
      speak(`Votre ticket : ${res.ticket.displayNum.split('').join(', ')}. Prenez votre ticket imprimé.`)
      // Impression automatique sur l'imprimante de la borne
      setTimeout(() => window.print(), 300)
      load()
    } catch {
      setError(t('kiosk.networkError'))
    } finally {
      setBusy(false)
    }
  }

  if (paired === null) return <main className="min-h-screen bg-gray-950" />
  if (!paired) {
    return <PairingScreen type="KIOSK" onPaired={() => { setToken(readDeviceToken('KIOSK')); setPaired(true) }} />
  }

  const service = board?.services.find(s => s.id === serviceId)

  return (
    <main className="flex min-h-screen select-none flex-col bg-surface-sunken" onPointerDown={step === 'welcome' ? undefined : touch}>
      {/* Ticket imprimé (format 80 mm) */}
      {issued && (
        <div className="hidden print:block">
          <p style={{ fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{board?.orgName}</p>
          <p style={{ fontSize: 48, fontWeight: 900, textAlign: 'center', margin: '8px 0' }}>{issued.displayNum}</p>
          <p style={{ fontSize: 13, textAlign: 'center' }}>{issued.serviceName}</p>
          <p style={{ fontSize: 12, textAlign: 'center', margin: '6px 0' }}>{t('reception.aheadPrint', { count: issued.ahead })} · ~{issued.waitMin} min</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="" style={{ width: 140, height: 140, display: 'block', margin: '8px auto' }} />}
          <p style={{ fontSize: 11, textAlign: 'center' }}>{t('reception.scanToFollow')}</p>
          <p style={{ fontSize: 10, textAlign: 'center', marginTop: 6 }}>{new Date(issued.issuedAt).toLocaleString('fr-FR')}</p>
        </div>
      )}

      <header className="flex items-center justify-between bg-white px-8 py-5 shadow-card print:hidden">
        <span className="flex items-center gap-3 text-2xl font-black text-ink">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white"><Ticket size={24} /></span>
          {board?.orgName ?? 'ATTENDS'}
        </span>
        {step !== 'welcome' && step !== 'ticket' && (
          <button onClick={() => (step === 'priority' ? setStep('service') : reset())}
            className="flex min-h-touch items-center gap-2 rounded-2xl bg-gray-100 px-6 text-lg font-semibold text-ink">
            <ArrowLeft size={22} /> {t('kiosk.back')}
          </button>
        )}
      </header>

      {offline && (
        <p role="alert" className="flex items-center justify-center gap-2 bg-warning-soft py-3 text-base font-semibold text-warning-ink print:hidden">
          <WifiOff size={18} /> {t('kiosk.offline')}
        </p>
      )}

      <section className="flex flex-1 flex-col items-center justify-center p-8 print:hidden">
        {!board ? (
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand border-t-transparent" aria-busy="true" />
        ) : !board.isOpen ? (
          <div className="text-center">
            <p className="text-4xl font-black text-ink">{t('kiosk.closed')}</p>
            <p className="mt-3 text-xl text-ink-muted">{t('kiosk.closedText')}</p>
          </div>
        ) : step === 'welcome' ? (
          /* Écran 0 : invitation */
          <button onClick={start} className="flex h-full w-full max-w-4xl flex-col items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-brand to-brand-600 p-16 text-white shadow-raised">
            <Hand size={80} className="mb-8 animate-bounce" />
            <span className="text-5xl font-black">{t('kiosk.touch')}</span>
            <span className="mt-4 text-2xl text-white/85">{t('kiosk.touchText')}</span>
          </button>
        ) : step === 'service' ? (
          /* Écran 1 : service */
          <div className="w-full max-w-5xl">
            <h1 className="mb-8 text-center text-4xl font-black text-ink">{t('kiosk.chooseService')}</h1>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {board.services.map(s => {
                // Pictogramme choisi pour le service (sinon celui du secteur) : la borne se comprend sans lire
                const Icon = iconFor(s.icon, 'ticket')
                return (
                  <div key={s.id} className="relative">
                    <button onClick={() => { haptics.tap(); setServiceId(s.id); setStep('priority') }}
                      className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-surface-line bg-white p-6 text-center shadow-card active:border-brand">
                      <Icon size={56} className="text-brand" />
                      <span className="text-2xl font-bold text-ink">{s.name}</span>
                      <span className="flex items-center gap-4 text-base text-ink-muted">
                        <span className="flex items-center gap-1"><Users size={16} />{s.waiting}</span>
                        <span className="flex items-center gap-1"><Clock size={16} />~{s.waitMin} min</span>
                      </span>
                    </button>
                    <button onClick={() => speak(`${s.name}. ${s.waiting} personne${s.waiting > 1 ? 's' : ''} en attente.`)}
                      aria-label={t('kiosk.listen', { name: s.name })}
                      className="absolute right-3 top-3 flex h-12 w-12 items-center justify-center rounded-full bg-info-soft text-info">
                      <Volume2 size={22} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : step === 'priority' ? (
          /* Écran 2 : priorité */
          <div className="w-full max-w-4xl text-center">
            <h1 className="text-4xl font-black text-ink">{t('kiosk.priorityTitle')}</h1>
            <p className="mt-2 text-xl text-ink-muted">{service?.name}</p>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              <button onClick={() => issue('STANDARD')} disabled={busy}
                className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl bg-brand p-8 text-white shadow-raised disabled:opacity-60">
                <UserRound size={64} />
                <span className="text-3xl font-black">{t('kiosk.standard')}</span>
              </button>
              <button onClick={() => issue('PRIORITY')} disabled={busy}
                className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl border-4 border-info bg-white p-8 text-info-ink shadow-card disabled:opacity-60">
                <Accessibility size={64} />
                <span className="text-3xl font-black">{t('kiosk.priority')}</span>
                <span className="text-lg">{t('kiosk.priorityText')}</span>
              </button>
            </div>
            {error && <p role="alert" className="mt-6 rounded-2xl bg-danger-soft p-4 text-lg font-semibold text-danger-ink">{error}</p>}
          </div>
        ) : issued ? (
          /* Écran 3 : ticket */
          <div className="text-center animate-pop-in" aria-live="assertive">
            <p className="text-2xl font-semibold text-ink-muted">{t('kiosk.yourTicket')}</p>
            <p className="my-4 text-[9rem] font-black leading-none tracking-tight text-ink">{issued.displayNum}</p>
            <p className="text-2xl text-ink">{issued.serviceName}</p>
            <p className="mt-2 text-xl text-ink-muted">{t('reception.ahead', { count: issued.ahead, minutes: issued.waitMin })}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt={t('reception.scanToFollow')} className="mx-auto my-6 h-44 w-44" />}
            <p className="text-lg text-ink-muted">{t('kiosk.takeTicket')}</p>
            <button onClick={reset} className={cn('mt-8 min-h-touch rounded-2xl bg-gray-900 px-10 py-4 text-xl font-bold text-white')}>
              {t('kiosk.done')}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
