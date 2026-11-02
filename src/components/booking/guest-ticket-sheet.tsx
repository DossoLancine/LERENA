'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Ticket, ShieldCheck } from 'lucide-react'
import PhoneInput from '@/components/ui/phone-input'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/field'
import { guestFlowConfig, joinQueueAsGuest, requestGuestCode } from '@/server/actions/guest'
import { rememberGuestTicket } from '@/lib/guest-tickets'
import { haptics } from '@/lib/haptics'
import { t } from '@/lib/i18n'

const NAME_KEY = 'attends_guest_name'
const PHONE_KEY = 'attends_guest_phone'

/** Ticket sans compte : prénom, téléphone, puis code SMS si l'établissement l'exige. */
export function GuestTicketSheet({ open, onClose, orgId, serviceId, serviceName, priorityId = null, getPosition }: {
  open: boolean
  onClose: () => void
  orgId: string
  serviceId: string
  serviceName?: string
  priorityId?: string | null
  getPosition: () => Promise<{ lat: number; lng: number } | null>
}) {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Le visiteur fréquent n'a pas à tout ressaisir
  useEffect(() => {
    if (!open) return
    try {
      setName(n => n || localStorage.getItem(NAME_KEY) || '')
      setPhone(p => p || localStorage.getItem(PHONE_KEY) || '')
    } catch {}
    setStep('form')
    setCode('')
    setError(null)
  }, [open])

  const submitTicket = async (verificationCode?: string) => {
    setBusy(true)
    setError(null)
    const coords = await getPosition()
    const res = await joinQueueAsGuest({
      orgId, serviceId, priorityId, name, phone, code: verificationCode,
      lat: coords?.lat, lng: coords?.lng
    })
    if (res.success && res.ticketId) {
      haptics.success()
      rememberGuestTicket(res.ticketId)
      try {
        localStorage.setItem(NAME_KEY, name.trim())
        localStorage.setItem(PHONE_KEY, phone)
      } catch {}
      router.push(`/ticket/${res.ticketId}?new=1`)
      return
    }
    setBusy(false)
    setError(res.error === 'CODE_INVALID' ? t('guest.codeInvalid') : res.error === 'GPS_REQUIRED' ? t('guest.gpsRequired') : res.error === 'OUT_OF_BOUNDS' ? t('guest.tooFar') : res.error ?? t('errors.generic.title'))
  }

  const handleForm = async (e: React.FormEvent) => {
    e.preventDefault()
    haptics.tap()
    if (name.trim().length < 2) return setError(t('guest.nameRequired'))

    setBusy(true)
    setError(null)
    const config = await guestFlowConfig()
    if (!config.smsRequired) return submitTicket()

    const res = await requestGuestCode(phone)
    setBusy(false)
    if (!res.success) return setError(res.error ?? t('errors.generic.title'))
    setStep('code')
  }

  const handleCode = (e: React.FormEvent) => {
    e.preventDefault()
    haptics.tap()
    submitTicket(code)
  }

  return (
    <BottomSheet open={open} onClose={() => !busy && onClose()}>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600">
          {step === 'form' ? <Ticket size={22} /> : <ShieldCheck size={22} />}
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">{step === 'form' ? t('guest.title') : t('guest.codeTitle')}</h2>
          <p className="text-sm text-ink-muted">
            {step === 'form' ? serviceName : t('guest.codeSent', { phone })}
          </p>
        </div>
      </div>

      {step === 'form' ? (
        <form onSubmit={handleForm} className="space-y-4">
          <TextInput label={t('guest.firstName')} value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" placeholder="Aminata" required />
          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('guest.phone')}</span>
            <PhoneInput value={phone} onChange={setPhone} />
            <p className="text-xs text-ink-subtle">{t('guest.phoneHint')}</p>
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">{error}</p>}
          <p className="text-xs text-ink-subtle">Votre prénom et votre numéro servent uniquement à vous appeler et à vous prévenir. <a href="/legal/confidentialite" target="_blank" className="underline">Confidentialité</a></p>
          <Button type="submit" size="lg" fullWidth loading={busy} icon={<Ticket size={20} />}>{t('guest.submit')}</Button>
          <p className="text-center text-sm text-ink-muted">
            {t('guest.haveAccount')}{' '}
            <Link href={`/auth/login?callbackUrl=/org/${orgId}`} className="font-semibold text-brand">{t('guest.login')}</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleCode} className="space-y-4">
          <TextInput
            label={t('guest.code')}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center text-2xl font-bold tracking-[0.5em]"
            autoFocus
          />
          {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">{error}</p>}
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={code.length !== 4}>{t('guest.confirm')}</Button>
          <button type="button" onClick={() => setStep('form')} className="w-full text-center text-sm font-medium text-ink-muted">
            {t('guest.changeNumber')}
          </button>
        </form>
      )}
    </BottomSheet>
  )
}
