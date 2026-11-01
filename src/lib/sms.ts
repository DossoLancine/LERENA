// Envoi de SMS. Le fournisseur se choisit par la variable SMS_PROVIDER :
//   (vide)   → aucun SMS : les messages sont simulés et journalisés (voir src/lib/messaging.ts)
//   console  → le SMS est écrit dans les journaux du serveur (développement)
//   orange   → Orange SMS API (Côte d'Ivoire) : ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET, ORANGE_SENDER_PHONE (ex. 2250700000000),
//              ORANGE_SENDER_NAME facultatif (nom d'expéditeur validé par Orange)
//   http     → agrégateur générique (JSON) : SMS_HTTP_URL, SMS_HTTP_AUTH (en-tête Authorization), SMS_HTTP_SENDER ;
//              corps envoyé : { "to": "+225…", "text": "…", "sender": "…" }

export function smsEnabled() {
  return !!process.env.SMS_PROVIDER
}

/** Numéro au format international sans espaces (+225…). */
function international(to: string) {
  const digits = to.replace(/[^\d+]/g, '')
  return digits.startsWith('+') ? digits : `+${digits}`
}

// ---- Orange SMS API ----

let orangeToken: { value: string; expiresAt: number } | null = null

async function orangeAccessToken() {
  if (orangeToken && orangeToken.expiresAt > Date.now() + 60_000) return orangeToken.value
  const id = process.env.ORANGE_CLIENT_ID
  const secret = process.env.ORANGE_CLIENT_SECRET
  if (!id || !secret) throw new Error('ORANGE_CLIENT_ID / ORANGE_CLIENT_SECRET manquants')
  const res = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  })
  if (!res.ok) throw new Error(`Orange OAuth ${res.status}`)
  const data = await res.json() as { access_token: string; expires_in: number }
  orangeToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return orangeToken.value
}

async function sendWithOrange(to: string, text: string) {
  const sender = (process.env.ORANGE_SENDER_PHONE || '').replace(/\D/g, '')
  if (!sender) throw new Error('ORANGE_SENDER_PHONE manquant')
  const token = await orangeAccessToken()
  const res = await fetch(`https://api.orange.com/smsmessaging/v1/outbound/${encodeURIComponent(`tel:+${sender}`)}/requests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      outboundSMSMessageRequest: {
        address: `tel:${international(to)}`,
        senderAddress: `tel:+${sender}`,
        ...(process.env.ORANGE_SENDER_NAME ? { senderName: process.env.ORANGE_SENDER_NAME } : {}),
        outboundSMSTextMessage: { message: text }
      }
    })
  })
  if (!res.ok) throw new Error(`Orange SMS ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

// ---- Agrégateur générique ----

async function sendWithHttp(to: string, text: string) {
  const url = process.env.SMS_HTTP_URL
  if (!url) throw new Error('SMS_HTTP_URL manquant')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.SMS_HTTP_AUTH ? { Authorization: process.env.SMS_HTTP_AUTH } : {}) },
    body: JSON.stringify({ to: international(to), text, sender: process.env.SMS_HTTP_SENDER || 'ATTENDS' })
  })
  if (!res.ok) throw new Error(`SMS HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`)
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER
  if (!provider) return false
  try {
    if (provider === 'console') console.log(`[SMS → ${to}] ${text}`)
    else if (provider === 'orange') await sendWithOrange(to, text)
    else if (provider === 'http') await sendWithHttp(to, text)
    else throw new Error(`Fournisseur SMS inconnu : ${provider}`)
    return true
  } catch (error) {
    console.error('Envoi SMS :', error instanceof Error ? error.message : error)
    return false
  }
}
