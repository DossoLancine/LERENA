import { createHmac, timingSafeEqual } from 'crypto'
import { getIntegration } from '@/lib/integrations'
import { handleInbound } from '@/lib/inbox'

// Messages WhatsApp reçus (API Cloud de Meta ou 360dialog, et Twilio) : réponses des visiteurs, boutons du menu.
// GET : vérification de l'adresse par Meta. POST : signature Meta (clé secrète de l'application) ou jeton ?token=.
export const dynamic = 'force-dynamic'

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

export async function GET(req: Request) {
  const u = new URL(req.url)
  const { values } = await getIntegration('WHATSAPP')
  if (u.searchParams.get('hub.mode') === 'subscribe' && values.verifyToken && same(u.searchParams.get('hub.verify_token') ?? '', values.verifyToken)) {
    return new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Non autorisé', { status: 403 })
}

type CloudMessage = { from?: string; type?: string; text?: { body?: string }; button?: { text?: string; payload?: string }; interactive?: { button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string } } }

export async function POST(req: Request) {
  const raw = await req.text()
  const { values } = await getIntegration('WHATSAPP')
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const sig = req.headers.get('x-hub-signature-256') ?? ''
  const signed = !!values.appSecret && !!sig && same(sig, `sha256=${createHmac('sha256', values.appSecret).update(raw).digest('hex')}`)
  const tokenOk = !!values.verifyToken && !!token && same(token, values.verifyToken)
  if (!signed && !tokenOk) return new Response('Non autorisé', { status: 401 })

  const type = req.headers.get('content-type') ?? ''
  // Twilio : formulaire From=whatsapp:+225…, Body=…, ButtonPayload=…
  if (!type.includes('json')) {
    const f = new URLSearchParams(raw)
    const from = (f.get('From') ?? '').replace(/^whatsapp:/, '')
    if (from) await handleInbound({ channel: 'WHATSAPP', from, text: f.get('Body') ?? '', buttonId: f.get('ButtonPayload') }).catch(e => console.error('WhatsApp entrant :', e))
    return new Response('<Response></Response>', { headers: { 'Content-Type': 'text/xml' } })
  }

  // API Cloud : entry[].changes[].value.messages[] (les accusés de lecture « statuses » sont ignorés)
  let body: { entry?: { changes?: { value?: { messages?: CloudMessage[] } }[] }[] } = {}
  try { body = JSON.parse(raw) } catch { return Response.json({ ok: false }, { status: 400 }) }
  const messages = (body.entry ?? []).flatMap(e => (e.changes ?? []).flatMap(c => c.value?.messages ?? [])).slice(0, 20)
  for (const m of messages) {
    if (!m.from) continue
    const reply = m.interactive?.button_reply ?? m.interactive?.list_reply
    const text = m.text?.body ?? reply?.title ?? m.button?.text ?? ''
    const buttonId = reply?.id ?? m.button?.payload ?? null
    await handleInbound({ channel: 'WHATSAPP', from: `+${m.from.replace(/\D/g, '')}`, text, buttonId }).catch(e => console.error('WhatsApp entrant :', e))
  }
  return Response.json({ ok: true })
}
