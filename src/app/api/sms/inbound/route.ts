import { normalizePhone } from '@/lib/phone'
import { handleInbound } from '@/lib/inbox'

// SMS reçus (à brancher chez le fournisseur SMS) : « STOP » retire l'accord du numéro dans tous les établissements
// (le numéro d'envoi est commun) ; les autres réponses rejoignent la conversation de l'établissement concerné,
// avec le menu automatique. Protégé par SMS_INBOUND_SECRET.
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
  if (!from) return Response.json({ ok: true })

  const conv = await handleInbound({ channel: 'SMS', from, text })
  return Response.json({ ok: true, conversation: !!conv })
}
