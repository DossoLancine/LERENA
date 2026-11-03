import { getIntegration, type ResolvedIntegration } from '@/lib/integrations'

// Envoi de SMS par le connecteur « SMS » de la console (Orange, Infobip, Twilio, passerelle HTTP).
// En simulation, rien ne part : le message est journalisé par src/lib/messaging.ts.
// Les anciennes variables (SMS_PROVIDER, ORANGE_*, SMS_HTTP_*) restent reconnues tant que la console n'est pas réglée.

export async function smsEnabled() {
  return (await getIntegration('SMS')).live
}

/** Numéro au format international sans espaces (+225…). */
function international(to: string) {
  const digits = to.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

type Values = Record<string, string>

// ---- Orange SMS API ----

let orangeToken: { key: string; value: string; expiresAt: number } | null = null

async function orangeAccessToken(v: Values) {
  const key = `${v.clientId}:${v.clientSecret}`
  if (orangeToken && orangeToken.key === key && orangeToken.expiresAt > Date.now() + 60_000) return orangeToken.value
  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(key).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  })
  if (!res.ok) throw new Error(`Orange OAuth ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  orangeToken = { key, value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return orangeToken.value
}

async function sendWithOrange(v: Values, to: string, text: string) {
  const sender = v.senderPhone.replace(/\D/g, '')
  const token = await orangeAccessToken(v)
  const res = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(`tel:+${sender}`)}/requests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outboundSMSMessageRequest: {
        address: `tel:${international(to)}`,
        senderAddress: `tel:+${sender}`,
        ...(v.senderName ? { senderName: v.senderName } : {}),
        outboundSMSTextMessage: { message: text }
      }
    })
  })
  if (!res.ok) throw new Error(`Orange SMS ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

// ---- Infobip ----

async function sendWithInfobip(v: Values, to: string, text: string) {
  const res = await fetch(`${v.baseUrl.replace(/\/$/, '')}/sms/2/text/advanced`, {
    method: 'POST',
    headers: { Authorization: `App ${v.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ messages: [{ destinations: [{ to: international(to).replace('+', '') }], from: v.sender, text }] })
  })
  if (!res.ok) throw new Error(`Infobip ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

// ---- Twilio ----

async function sendWithTwilio(v: Values, to: string, text: string) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(v.accountSid)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${v.accountSid}:${v.authToken}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: international(to), From: v.from, Body: text })
  })
  if (!res.ok) throw new Error(`Twilio ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

// ---- Agrégateur générique ----

async function sendWithHttp(v: Values, to: string, text: string) {
  const res = await fetch(v.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(v.authHeader ? { Authorization: v.authHeader } : {}) },
    body: JSON.stringify({ to: international(to), text, sender: v.sender || 'Lerena' })
  })
  if (!res.ok) throw new Error(`SMS HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

/** Envoie un SMS ; lève une erreur détaillée en cas d'échec (pour le journal et le test de la console). */
export async function deliverSms(to: string, text: string, config?: ResolvedIntegration) {
  const c = config ?? await getIntegration('SMS')
  if (!c.live) throw new Error('Connecteur SMS en simulation')
  if (c.provider === 'orange') return sendWithOrange(c.values, to, text)
  if (c.provider === 'infobip') return sendWithInfobip(c.values, to, text)
  if (c.provider === 'twilio') return sendWithTwilio(c.values, to, text)
  if (c.provider === 'http') return sendWithHttp(c.values, to, text)
  throw new Error(`Fournisseur SMS inconnu : ${c.provider}`)
}

/** Fournisseur effectivement utilisé (pour le journal). */
export async function smsProviderName() {
  return (await getIntegration('SMS')).provider
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  try {
    await deliverSms(to, text)
    return true
  } catch (error) {
    console.error('Envoi SMS :', error instanceof Error ? error.message : error)
    return false
  }
}
