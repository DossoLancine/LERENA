'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitLead } from '@/server/actions/leads'
import { Button, SelectInput, TextArea, TextInput } from '@/components/ui'

const SECTORS = ['Santé (hôpital, clinique)', 'Administration publique', 'Banque, assurance', 'Opérateur, services', 'Commerce, restauration', 'Autre']

/** Formulaire de demande de démonstration (prospect enregistré et transmis à l'équipe Lerena). */
export function DemoForm() {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    setError(null)
    const res = await submitLead({ contactName: v('contactName'), organization: v('organization'), sector: v('sector'), city: v('city'), phone: v('phone'), email: v('email'), sites: v('sites'), message: v('message'), website: v('website') })
    setBusy(false)
    if (!res.success) return setError(res.error)
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex animate-pop-in flex-col items-center justify-center rounded-2xl bg-success-soft p-8 text-center text-success-ink" role="status">
        <CheckCircle2 size={44} />
        <p className="mt-3 text-lg font-bold">Merci, demande envoyée !</p>
        <p className="mt-1 text-sm">Nous vous rappelons sous 24 heures ouvrées.</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <TextInput name="contactName" label="Votre nom" required maxLength={80} autoComplete="name" />
      <TextInput name="organization" label="Établissement" required maxLength={120} autoComplete="organization" />
      <TextInput name="phone" label="Téléphone" type="tel" required autoComplete="tel" placeholder="07 00 00 00 00" />
      <TextInput name="email" label="E-mail (facultatif)" type="email" autoComplete="email" />
      <SelectInput name="sector" label="Secteur" defaultValue="">
        <option value="">Choisir…</option>
        {SECTORS.map(s => <option key={s}>{s}</option>)}
      </SelectInput>
      <div className="grid grid-cols-[1fr_90px] gap-3">
        <TextInput name="city" label="Ville" maxLength={60} />
        <TextInput name="sites" label="Sites" type="number" min={1} max={500} />
      </div>
      <div className="sm:col-span-2"><TextArea name="message" label="Votre besoin (facultatif)" rows={3} maxLength={1000} placeholder="Nombre de guichets, affluence, date souhaitée…" /></div>
      {/* Piège à robots : invisible pour les personnes */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {error && <p role="alert" className="text-sm font-medium text-danger sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" fullWidth size="lg" loading={busy}>Être rappelé</Button>
        <p className="mt-2 text-center text-xs text-ink-subtle">Vos coordonnées servent uniquement à vous recontacter. <a href="/legal/confidentialite" className="underline">Confidentialité</a></p>
      </div>
    </form>
  )
}
