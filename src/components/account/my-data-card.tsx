'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ShieldCheck } from 'lucide-react'
import { exportMyData } from '@/server/actions/account'
import { Button, Card, useToast } from '@/components/ui'

/** Téléchargement d'un fichier JSON sur l'appareil. */
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** « Mes données » : télécharger tout ce que Lerena conserve sur le compte (la suppression est en bas du profil). */
export function MyDataCard() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const exportData = async () => {
    setBusy(true)
    const res = await exportMyData()
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    downloadJson(res.data, `lerena-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`)
    toast('Export téléchargé')
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck size={18} className="text-brand" /> Mes données</h2>
      <p className="mt-1 text-sm text-ink-muted">Téléchargez tout ce que Lerena conserve sur vous : compte, tickets, rendez-vous, messages reçus. <Link href="/legal/confidentialite" className="font-medium text-brand underline">Confidentialité</Link></p>
      <Button className="mt-4" variant="secondary" fullWidth icon={<Download size={16} />} loading={busy} onClick={exportData}>Exporter mes données</Button>
    </Card>
  )
}
