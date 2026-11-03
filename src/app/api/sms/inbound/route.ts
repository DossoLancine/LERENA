import { normalizePhone } from '@/lib/phone'
import { optOutCustomers } from '@/lib/campaigns'

// SMS reçus (à brancher chez le fournisseur SMS) : une réponse « STOP » retire l'accord du numéro
// dans tous les établissements (le numéro d'envoi est commun). Protégé par SMS_INBOUND_SECRET.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.SMS_INBOUND_SECRET
  const given = req.headers.get('x-lerena-secret') ?? new URL(req.url).searchParams.get('secret')
  if (!secret || given !== secret) return new Response('Non autorisé', { status: 401 })

  // JSON ou formulaire, selon le fournisseur : expéditeur et texte sous leurs noms usuels
  let fields: Record<string, string> = {}
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) fields = await req.json().catch(() => ({}))
  else fields = Object.fromEntries((await req.formData().catch(() => new FormData())).entries()) as Record<string, string>
  const from = normalizePhone(String(fields.from ?? fields.From ?? fields.sender ?? fields.msisdn ?? ''))
  const text = String(fields.text ?? fields.Text ?? fields.message ?? fields.Body ?? fields.body ?? '')

  if (!from || !/^\s*(stop|arr[eê]t|desabonner|désabonner)\b/i.test(text)) return Response.json({ ok: true, optedOut: 0 })
  const optedOut = await optOutCustomers({ phone: from })
  return Response.json({ ok: true, optedOut })
}
