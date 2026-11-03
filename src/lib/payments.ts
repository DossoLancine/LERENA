import { randomUUID } from 'crypto'
import { getIntegration, type ResolvedIntegration } from '@/lib/integrations'

// Paiement en ligne (connecteur « Paiement » de la console) : Wave ou CinetPay.
// Sans connecteur, aucun lien n'est créé : l'équipe valide le paiement à la main (espèces, Mobile Money au guichet…).
// La confirmation définitive d'un paiement se fera par la notification serveur du prestataire (étape N7).

export interface PaymentRequest {
  amount: number // FCFA
  reference: string // identifiant interne (commande, facture)
  description: string
  returnUrl: string
  notifyUrl?: string
}

export interface PaymentLink {
  url: string
  provider: string
  providerRef: string
}

export async function paymentsEnabled() {
  return (await getIntegration('PAYMENT')).live
}

/** Crée un lien de paiement ; null si le paiement en ligne n'est pas activé. Lève une erreur si le prestataire refuse. */
export async function createPaymentLink(req: PaymentRequest, config?: ResolvedIntegration): Promise<PaymentLink | null> {
  const c = config ?? await getIntegration('PAYMENT')
  if (!c.live) return null
  const amount = Math.round(req.amount)
  if (amount < 100) throw new Error('Montant minimum : 100 FCFA')

  if (c.provider === 'wave') {
    const res = await fetch('https://api.wave.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.values.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: String(amount), currency: 'XOF', client_reference: req.reference, success_url: req.returnUrl, error_url: req.returnUrl })
    })
    if (!res.ok) throw new Error(`Wave ${res.status} : ${(await res.text()).slice(0, 200)}`)
    const data = await res.json() as { id: string; wave_launch_url: string }
    return { url: data.wave_launch_url, provider: 'wave', providerRef: data.id }
  }

  if (c.provider === 'cinetpay') {
    const transactionId = `${req.reference}-${randomUUID().slice(0, 8)}`
    const res = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: c.values.apiKey, site_id: c.values.siteId, transaction_id: transactionId, amount, currency: 'XOF',
        description: req.description.slice(0, 100), return_url: req.returnUrl, notify_url: req.notifyUrl ?? req.returnUrl, channels: 'ALL'
      })
    })
    const data = await res.json().catch(() => null) as { code?: string; message?: string; data?: { payment_url?: string } } | null
    if (!res.ok || !data?.data?.payment_url) throw new Error(`CinetPay ${res.status} : ${data?.message ?? 'réponse inattendue'}`)
    return { url: data.data.payment_url, provider: 'cinetpay', providerRef: transactionId }
  }

  throw new Error(`Prestataire de paiement inconnu : ${c.provider}`)
}
