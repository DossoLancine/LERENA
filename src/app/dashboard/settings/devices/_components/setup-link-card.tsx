'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, Copy, RefreshCw, XCircle, ShieldCheck } from 'lucide-react'
import { createSetupLink, getSetupLinkState, revokeSetupLink } from '@/server/actions/devices'
import { Button, Card, CardHeader, useToast } from '@/components/ui'
import { usePolling } from '@/hooks/use-polling'

type Link = { id: string; url: string; expiresAt: number; qr: string }

/**
 * Lien d'installation (tablettes, téléphones) : un QR code à usage unique, valable 30 minutes.
 * Dès qu'un appareil l'utilise, un nouveau lien remplace l'ancien : on enchaîne les installations.
 */
export function SetupLinkCard({ onInstalled }: { onInstalled: () => void }) {
  const toast = useToast()
  const [link, setLink] = useState<Link | null>(null)
  const [expired, setExpired] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const linkRef = useRef<Link | null>(null)
  linkRef.current = link

  const generate = useCallback(async () => {
    setBusy(true)
    const res = await createSetupLink()
    setBusy(false)
    if (!res) return toast('Action réservée au responsable', 'error')
    const url = `${window.location.origin}${res.path}`
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
    setExpired(false)
    setLink({ id: res.id, url, expiresAt: new Date(res.expiresAt).getTime(), qr })
  }, [toast])

  // Suivi du lien affiché : utilisé → nouveau lien automatiquement ; expiré → on le signale
  usePolling(async () => {
    const current = linkRef.current
    if (!current) return
    const state = await getSetupLinkState(current.id)
    if (!state) return
    if (state.used) {
      toast(`${state.device?.name ?? 'Appareil'} installé`)
      onInstalled()
      await generate()
    } else if (state.expired) {
      setExpired(true)
      setLink(null)
    }
  }, 4000, !!link)

  // Compte à rebours affiché
  useEffect(() => {
    if (!link) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [link])

  const revoke = async () => {
    if (!link) return
    await revokeSetupLink(link.id)
    setLink(null)
    toast('Lien annulé')
  }

  const left = link ? Math.max(0, link.expiresAt - now) : 0
  const mm = Math.floor(left / 60000)
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')

  return (
    <Card>
      <CardHeader title="Tablette ou téléphone : QR code" subtitle="Scannez avec l’appareil photo, choisissez Écran ou Borne : c’est installé." />
      <div className="p-5">
        {link ? (
          <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
            <img src={link.qr} alt="QR code d’installation" className="mx-auto h-48 w-48 rounded-2xl border border-surface-line animate-pop-in" />
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-success-ink">
                <ShieldCheck size={16} aria-hidden="true" /> Lien à usage unique — expire dans <span className="tabular-nums">{mm}:{ss}</span>
              </p>
              <p className="text-ink-muted">Après chaque appareil installé, un nouveau QR code apparaît ici automatiquement : vous pouvez enchaîner.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Copy size={15} />} onClick={() => { navigator.clipboard?.writeText(link.url); toast('Lien copié') }}>Copier le lien</Button>
                <Button size="sm" variant="secondary" icon={<RefreshCw size={15} />} loading={busy} onClick={generate}>Nouveau lien</Button>
                <Button size="sm" variant="ghost" icon={<XCircle size={15} />} onClick={revoke}>Annuler</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            {expired && <p className="text-sm font-medium text-warning-ink">Le lien a expiré sans être utilisé.</p>}
            <Button icon={<QrCode size={16} />} loading={busy} onClick={generate}>Afficher un QR code d’installation</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
