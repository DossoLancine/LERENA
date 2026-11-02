import { recordError } from '@/lib/observability'
import { HOUR, rateLimit, requestIp } from '@/lib/rate-limit'

// Erreurs remontées par les navigateurs (pages d'erreur, erreurs JavaScript non rattrapées)
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const ip = requestIp()
  if (!(await rateLimit(`err:${ip ?? 'inconnu'}`, 30, HOUR))) return new Response(null, { status: 429 })
  const body = await req.json().catch(() => null) as { message?: unknown; stack?: unknown; path?: unknown } | null
  if (!body || typeof body.message !== 'string') return new Response(null, { status: 400 })
  await recordError({
    source: 'CLIENT',
    message: body.message.slice(0, 1000),
    stack: typeof body.stack === 'string' ? body.stack.slice(0, 4000) : null,
    path: typeof body.path === 'string' ? body.path.slice(0, 300) : null
  }).catch(() => null)
  return new Response(null, { status: 204 })
}
