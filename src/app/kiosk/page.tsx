'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Ticket, Users, Clock,
  Volume2, ArrowLeft, WifiOff, Hand, Loader2, ChevronRight, UserRound, Accessibility, CalendarCheck, Delete
} from 'lucide-react'
import { PairingScreen, readDeviceToken, adoptDeviceRole } from '@/components/devices/pairing-screen'
import { getDeviceStatus, getKioskBoard, issueKioskTicket, kioskCheckIn } from '@/server/actions/devices'
import { usePolling } from '@/hooks/use-polling'
import { useOrgRealtime } from '@/hooks/use-org-realtime'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { haptics } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { iconFor } from '@/lib/icons'
import { t } from '@/lib/i18n'

type Board = NonNullable<Awaited<ReturnType<typeof getKioskBoard>>>
type Issued = Extract<Awaited<ReturnType<typeof issueKioskTicket>>, { success: true }>['ticket']
// L'étape « priorité » n'existe que si l'établissement autorise le choix d'une priorité à la borne
type Step = 'welcome' | 'service' | 'priority' | 'appointment' | 'ticket'

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
  // Code d'arrivée d'un rendez-vous, tapé sur le pavé numérique
  const [apptCode, setApptCode] = useState('')
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
    setApptCode('')
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

  const issue = async (sid: string, priorityId: string | null = null) => {
    if (!token || busy) return
    haptics.tap()
    setServiceId(sid)
    setBusy(true)
    setError(null)
    try {
      const res = await issueKioskTicket(token, sid, priorityId)
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

  const arriveWithCode = async (code: string) => {
    if (!token || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await kioskCheckIn(token, code)
      if (!res.success) { setError(res.error); setApptCode(''); return }
      haptics.success()
      setIssued(res.ticket)
      setQr(await QRCode.toDataURL(`${window.location.origin}/ticket/${res.ticket.id}`, { width: 240, margin: 1 }))
      setStep('ticket')
      speak(`Votre ticket : ${res.ticket.displayNum.split('').join(', ')}. Vous serez appelé à l'heure de votre rendez-vous.`)
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
    return <PairingScreen type="KIOSK" onPaired={status => {
      // Le responsable a pu choisir « écran d'affichage » : l'appareil bascule alors sur la TV
      const next = adoptDeviceRole(status)
      if (status.type !== 'KIOSK') return window.location.replace(next)
      setToken(status.token)
      setPaired(true)
    }} />
  }

  // Beaucoup de services : bandeaux plus compacts pour tout voir sans faire défiler
  const dense = (board?.services.length ?? 0) > 9

  return (
    <main className="flex h-[100dvh] select-none flex-col overflow-hidden bg-surface-sunken" onPointerDown={step === 'welcome' ? undefined : touch}>
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

      <header className="flex shrink-0 items-center justify-between bg-white px-5 py-4 shadow-card md:px-8 md:py-5 print:hidden">
        <span className="flex items-center gap-3 text-2xl font-black text-ink">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white"><Ticket size={24} /></span>
          {board?.orgName ?? 'Lerena'}
        </span>
        {step !== 'welcome' && step !== 'ticket' && (
          <button onClick={() => (step === 'priority' || step === 'appointment' ? setStep('service') : reset())}
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

      <section className={cn('flex min-h-0 flex-1 flex-col items-center p-4 md:p-6 print:hidden', step === 'service' ? 'justify-start' : 'justify-center')}>
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
          /* Écran 1 : service — bandeaux horizontaux, 1 à 3 colonnes selon la largeur de la tablette */
          <div className="flex min-h-0 w-full max-w-7xl flex-1 flex-col">
            <h1 className={cn('mb-4 text-center font-black text-ink md:mb-6 [@media(max-height:700px)]:mb-3 [@media(max-height:700px)]:text-2xl', dense ? 'text-3xl' : 'text-4xl')}>{t('kiosk.chooseService')}</h1>
            {error && <p role="alert" className="mb-4 rounded-2xl bg-danger-soft p-4 text-center text-lg font-semibold text-danger-ink">{error}</p>}
            <button onClick={() => { haptics.tap(); setError(null); setApptCode(''); setStep('appointment') }}
              className="mb-4 flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl border-2 border-info bg-info-soft px-4 text-xl font-bold text-info-ink">
              <CalendarCheck size={28} aria-hidden="true" /> J’ai un rendez-vous
            </button>
            <ul className={cn('stagger grid content-start gap-3 overflow-y-auto overscroll-contain pb-4 md:grid-cols-2', board.services.length > 6 && 'xl:grid-cols-3')}>
              {board.services.map(s => {
                // Pictogramme choisi pour le service (sinon celui du secteur) : la borne se comprend sans lire
                const Icon = iconFor(s.icon, 'ticket')
                const loading = busy && serviceId === s.id
                return (
                  <li key={s.id} className="flex items-stretch gap-2">
                    <button onClick={() => {
                        // Priorité proposée seulement si l'établissement l'autorise à la borne
                        if (board.priorities.length > 0) { haptics.tap(); setServiceId(s.id); setError(null); setStep('priority') }
                        else issue(s.id)
                      }} disabled={busy}
                      className={cn('flex min-w-0 flex-1 items-center gap-4 rounded-2xl border-2 bg-white px-4 text-left shadow-card disabled:opacity-60',
                        dense ? 'min-h-[76px] py-2 [@media(max-height:700px)]:min-h-[64px]' : 'min-h-[96px] py-3',
                        loading ? 'border-brand' : 'border-surface-line active:border-brand')}>
                      <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand', dense ? 'h-12 w-12' : 'h-14 w-14')}>
                        {loading ? <Loader2 size={dense ? 26 : 30} className="animate-spin" aria-hidden="true" /> : <Icon size={dense ? 26 : 30} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span lang="fr" className={cn('block font-bold leading-tight text-ink line-clamp-2 break-words hyphens-auto', dense ? 'text-xl' : 'text-2xl')}>{s.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 whitespace-nowrap text-sm text-ink-muted">
                          <span className="flex items-center gap-1"><Users size={14} aria-hidden="true" />{s.waiting} en attente</span>
                          <span className="flex items-center gap-1"><Clock size={14} aria-hidden="true" />~{s.waitMin} min</span>
                        </span>
                      </span>
                      <ChevronRight size={22} className="shrink-0 text-ink-subtle" aria-hidden="true" />
                    </button>
                    <button onClick={() => speak(`${s.name}. ${s.waiting} personne${s.waiting > 1 ? 's' : ''} en attente.`)}
                      aria-label={t('kiosk.listen', { name: s.name })}
                      className="flex w-12 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info">
                      <Volume2 size={22} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : step === 'appointment' ? (
          /* Arrivée d'un rendez-vous : code à 6 chiffres reçu par SMS */
          <div className="w-full max-w-md text-center">
            <h1 className="text-3xl font-black text-ink">Votre code de rendez-vous</h1>
            <p className="mt-2 text-lg text-ink-muted">6 chiffres, reçus par SMS à la réservation</p>
            <p aria-live="polite" className="my-6 flex justify-center gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="flex h-16 w-12 items-center justify-center rounded-xl border-2 border-surface-line bg-white font-mono text-4xl font-black text-ink">{apptCode[i] ?? ''}</span>
              ))}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                <button key={d} onClick={() => { haptics.tap(); setApptCode(c => (c + d).slice(0, 6)) }} disabled={busy}
                  className="h-20 rounded-2xl border-2 border-surface-line bg-white text-3xl font-black text-ink active:border-brand">{d}</button>
              ))}
              <button onClick={() => setApptCode(c => c.slice(0, -1))} aria-label="Effacer" className="flex h-20 items-center justify-center rounded-2xl bg-gray-100 text-ink"><Delete size={28} /></button>
              <button onClick={() => { haptics.tap(); setApptCode(c => (c + '0').slice(0, 6)) }} disabled={busy} className="h-20 rounded-2xl border-2 border-surface-line bg-white text-3xl font-black text-ink">0</button>
              <button onClick={() => arriveWithCode(apptCode)} disabled={apptCode.length !== 6 || busy}
                className="flex h-20 items-center justify-center rounded-2xl bg-brand text-xl font-black text-white disabled:opacity-40">{busy ? <Loader2 className="animate-spin" /> : 'OK'}</button>
            </div>
            {error && <p role="alert" className="mt-6 rounded-2xl bg-danger-soft p-4 text-lg font-semibold text-danger-ink">{error}</p>}
          </div>
        ) : step === 'priority' && serviceId ? (
          /* Écran 2 (facultatif) : priorité */
          <div className="w-full max-w-4xl text-center">
            <h1 className="text-3xl font-black text-ink md:text-4xl">{t('kiosk.priorityTitle')}</h1>
            <p className="mt-2 text-xl text-ink-muted">{board.services.find(x => x.id === serviceId)?.name}</p>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <button onClick={() => issue(serviceId)} disabled={busy}
                className="flex min-h-[180px] flex-col items-center justify-center gap-4 rounded-3xl bg-brand p-8 text-white shadow-raised disabled:opacity-60 md:row-span-2">
                {busy ? <Loader2 size={56} className="animate-spin" /> : <UserRound size={56} />}
                <span className="text-3xl font-black">{t('kiosk.standard')}</span>
              </button>
              <div className="stagger grid content-start gap-3">
                {board.priorities.map(p => (
                  <button key={p.id} onClick={() => issue(serviceId, p.id)} disabled={busy}
                    className="flex min-h-[80px] items-center gap-4 rounded-3xl border-4 border-info bg-white px-6 text-left text-info-ink shadow-card disabled:opacity-60">
                    <Accessibility size={36} className="shrink-0" aria-hidden="true" />
                    <span className="text-2xl font-black">{p.label}</span>
                  </button>
                ))}
              </div>
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
