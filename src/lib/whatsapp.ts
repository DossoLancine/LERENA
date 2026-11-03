import { getIntegration, type ResolvedIntegration } from '@/lib/integrations'

// Envoi WhatsApp Business par le connecteur de la console : Meta (API Cloud), 360dialog ou Twilio.
// Hors de la fenêtre de 24 h ouverte par une réponse du visiteur, WhatsApp n'accepte que des modèles validés par Meta :
// l'appelant fournit alors un modèle (nom, langue, paramètres) ; sinon le texte libre est envoyé.

export interface WhatsAppTemplate {
  name: string
  language?: string
  params?: string[]
}

const digits = (to: string) => to.replace(/\D/g, '')

function cloudPayload(to: string, text: string, template?: WhatsAppTemplate) {
  return template
    ? {
        messaging_product: 'whatsapp', to: digits(to), type: 'template',
        template: {
          name: template.name, language: { code: template.language ?? 'fr' },
          ...(template.params?.length ? { components: [{ type: 'body', parameters: template.params.map(p => ({ type: 'text', text: p })) }] } : {})
        }
      }
    : { messaging_product: 'whatsapp', to: digits(to), type: 'text', text: { body: text, preview_url: true } }
}

export async function whatsappEnabled() {
  return (await getIntegration('WHATSAPP')).live
}

/** Envoie un message WhatsApp ; lève une erreur détaillée en cas d'échec. Renvoie le prestataire utilisé. */
export async function deliverWhatsApp(to: string, text: string, template?: WhatsAppTemplate, config?: ResolvedIntegration) {
  const c = config ?? await getIntegration('WHATSAPP')
  if (!c.live) throw new Error('Connecteur WhatsApp en simulation')
  const v = c.values
  if (c.provider === 'meta') {
    const res = await fetch(`https://graph.facebook.com/${v.apiVersion || 'v21.0'}/${encodeURIComponent(v.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${v.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cloudPayload(to, text, template))
    })
    if (!res.ok) throw new Error(`WhatsApp Meta ${res.status} : ${(await res.text()).slice(0, 200)}`)
    return 'meta'
  }
  if (c.provider === '360dialog') {
    const res = await fetch('https://waba-v2.360dialog.io/messages', {
      method: 'POST',
      headers: { 'D360-API-KEY': v.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(cloudPayload(to, text, template))
    })
    if (!res.ok) throw new Error(`360dialog ${res.status} : ${(await res.text()).slice(0, 200)}`)
    return '360dialog'
  }
  if (c.provider === 'twilio') {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.accountSid)}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${v.accountSid}:${v.authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: `whatsapp:+${digits(to)}`, From: `whatsapp:+${digits(v.from)}`, Body: text })
    })
    if (!res.ok) throw new Error(`Twilio WhatsApp ${res.status} : ${(await res.text()).slice(0, 200)}`)
    return 'twilio'
  }
  throw new Error(`Fournisseur WhatsApp inconnu : ${c.provider}`)
}
