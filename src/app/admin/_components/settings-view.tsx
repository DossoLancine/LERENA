'use client'

import { useState } from 'react'
import { updatePlatformSettings } from '@/server/actions/admin'
import { Button, Card, CardHeader, TextInput, useToast } from '@/components/ui'

type Form = { appName: string; defaultCountryCode: string; defaultCity: string; defaultLat: string; defaultLng: string; demoMode: boolean }

/** Réglages qui dépendent du pays de déploiement : rien de tout cela n'est écrit dans le code. */
export function SettingsView({ initial }: { initial: Form }) {
  const toast = useToast()
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await updatePlatformSettings({
      ...form,
      defaultLat: form.defaultLat === '' ? null : Number(form.defaultLat),
      defaultLng: form.defaultLng === '' ? null : Number(form.defaultLng)
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Réglages enregistrés')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <CardHeader title="Plateforme" subtitle="Nom affiché et pays de déploiement" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <TextInput label="Nom de l’application" required maxLength={40} value={form.appName} onChange={set('appName')} />
          <TextInput label="Indicatif téléphonique par défaut" required value={form.defaultCountryCode} onChange={set('defaultCountryCode')} hint="Ex : +225, +221, +33" />
        </div>
      </Card>

      <Card>
        <CardHeader title="Carte" subtitle="Point de départ de la carte quand la position de l’utilisateur est inconnue" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <TextInput label="Ville par défaut" maxLength={60} value={form.defaultCity} onChange={set('defaultCity')} />
          <TextInput label="Latitude" inputMode="decimal" value={form.defaultLat} onChange={set('defaultLat')} />
          <TextInput label="Longitude" inputMode="decimal" value={form.defaultLng} onChange={set('defaultLng')} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Mode démonstration" />
        <label className="flex items-start gap-3 p-5 text-sm text-ink">
          <input type="checkbox" checked={form.demoMode} onChange={e => setForm(f => ({ ...f, demoMode: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-brand" />
          <span>
            Afficher les boutons « Accès démo » sur les pages de connexion.
            <span className="block text-xs text-ink-muted">À désactiver dès la mise en production avec de vrais clients : ces comptes ont un mot de passe connu.</span>
          </span>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={busy}>Enregistrer</Button>
      </div>
    </form>
  )
}
