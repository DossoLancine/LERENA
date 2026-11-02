'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveBillingSettings, type getBillingSettings } from '@/server/actions/billing-admin'
import { Button, Card, CardHeader, SelectInput, TextArea, TextInput, useToast } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'

type Data = NonNullable<Awaited<ReturnType<typeof getBillingSettings>>>

/** Règles commerciales de Lerena : essai, délai de grâce, échéance, TVA, mentions des factures. */
export function BillingSettingsView({ data }: { data: Data }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const c = data.config

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const v = (k: string) => String(f.get(k) ?? '')
    setBusy(true)
    const res = await saveBillingSettings({
      trialDays: v('trialDays'), trialPlanId: v('trialPlanId'), graceDays: v('graceDays'), paymentTermDays: v('paymentTermDays'), taxRate: v('taxRate'), invoicePrefix: v('invoicePrefix'),
      companyName: v('companyName'), companyAddress: v('companyAddress'), companyTaxId: v('companyTaxId'), companyRccm: v('companyRccm'),
      companyPhone: v('companyPhone'), companyEmail: v('companyEmail'), paymentInstructions: v('paymentInstructions'),
      retentionMonths: v('retentionMonths'), dpoEmail: v('dpoEmail'), artciReference: v('artciReference')
    })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast('Réglages enregistrés')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title="Réglages de facturation" subtitle="S’appliquent aux nouveaux clients et aux prochaines factures." actions={<Button type="submit" loading={busy}>Enregistrer</Button>} />

      <Card>
        <CardHeader title="Essai et relances" subtitle="Ce qui se passe quand un établissement démarre, puis quand il ne paie pas" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput name="trialDays" label="Durée de l’essai (jours)" type="number" min={0} max={365} defaultValue={c.trialDays} hint="0 = pas d’essai" />
          <SelectInput name="trialPlanId" label="Forfait pendant l’essai" defaultValue={c.trialPlanId ?? ''}>
            <option value="">Le forfait mis en avant</option>
            {data.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectInput>
          <TextInput name="graceDays" label="Délai de grâce (jours)" type="number" min={0} max={90} defaultValue={c.graceDays} hint="Après l’échéance, avant suspension" />
          <TextInput name="paymentTermDays" label="Échéance des factures (jours)" type="number" min={0} max={120} defaultValue={c.paymentTermDays} />
        </div>
        <p className="border-t border-surface-line px-5 py-3 text-xs text-ink-muted">
          Déroulé : essai → facture envoyée 7 jours avant la fin → délai de grâce (bandeau d’alerte chez le client) → suspension des tickets en ligne. Le paiement réactive tout aussitôt.
        </p>
      </Card>

      <Card>
        <CardHeader title="Factures" subtitle="Mentions légales et numérotation" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <TextInput name="companyName" label="Raison sociale" maxLength={80} defaultValue={c.companyName ?? ''} placeholder="Lerena SAS" />
          <TextInput name="companyAddress" label="Adresse" maxLength={200} defaultValue={c.companyAddress ?? ''} placeholder="Cocody, Abidjan" />
          <TextInput name="companyRccm" label="RCCM" maxLength={40} defaultValue={c.companyRccm ?? ''} />
          <TextInput name="companyTaxId" label="N° compte contribuable (NCC)" maxLength={40} defaultValue={c.companyTaxId ?? ''} />
          <TextInput name="companyPhone" label="Téléphone" maxLength={40} defaultValue={c.companyPhone ?? ''} />
          <TextInput name="companyEmail" label="E-mail (reçoit aussi les demandes de devis et paiements déclarés)" type="email" maxLength={80} defaultValue={c.companyEmail ?? ''} />
          <TextInput name="taxRate" label="TVA (%)" type="number" min={0} max={50} defaultValue={c.taxRate} hint="18 % en Côte d’Ivoire si vous êtes assujetti ; 0 sinon" />
          <TextInput name="invoicePrefix" label="Préfixe des numéros" maxLength={8} defaultValue={c.invoicePrefix} hint={`Ex. ${c.invoicePrefix}-${new Date().getFullYear()}-0001`} />
          <div className="sm:col-span-2">
            <TextArea name="paymentInstructions" label="Comment payer (affiché sur chaque facture)" rows={4} maxLength={1000} defaultValue={c.paymentInstructions ?? ''}
              placeholder={'Orange Money : 07 00 00 00 00 (Lerena)\nWave : 05 00 00 00 00\nVirement : banque, IBAN…'} />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Données personnelles" subtitle="Repris dans la politique de confidentialité et les mentions légales (loi n° 2013-450)" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <TextInput name="dpoEmail" label="Contact données personnelles" type="email" maxLength={80} defaultValue={c.dpoEmail ?? ''} hint="Vide = e-mail de la société" />
          <TextInput name="artciReference" label="N° de déclaration ARTCI" maxLength={60} defaultValue={c.artciReference ?? ''} hint="Vide = « en cours »" />
          <TextInput name="retentionMonths" label="Anonymisation des tickets après (mois)" type="number" min={1} max={120} defaultValue={c.retentionMonths} hint="Noms et numéros effacés, statistiques gardées" />
        </div>
        <p className="border-t border-surface-line px-5 py-3 text-xs text-ink-muted">Documents publics : <a href="/legal/cgu" target="_blank" className="font-semibold text-brand">CGU</a> · <a href="/legal/cgv" target="_blank" className="font-semibold text-brand">CGV</a> · <a href="/legal/confidentialite" target="_blank" className="font-semibold text-brand">Confidentialité</a> · <a href="/legal/mentions-legales" target="_blank" className="font-semibold text-brand">Mentions légales</a> · <a href="/legal/sous-traitance" target="_blank" className="font-semibold text-brand">Sous-traitance</a></p>
      </Card>
    </form>
  )
}
