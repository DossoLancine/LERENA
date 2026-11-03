import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

// Journal d'erreurs intégré (serveur et navigateur), sans service externe :
// les erreurs identiques sont regroupées par empreinte, comptées, et la première occurrence
// d'un nouveau problème est signalée par e-mail à l'équipe Lerena.

type Source = 'SERVER' | 'CLIENT'

// Erreurs attendues ou bruit de navigateur : pas des incidents
const IGNORED = [
  /ResizeObserver loop/i, /NEXT_REDIRECT/, /NEXT_NOT_FOUND/, /AbortError/i, /Load failed/i, /NetworkError/i, /Failed to fetch/i,
  /^UNAUTHORIZED$/, /^SESSION_EXPIRED$/, /^GPS_REQUIRED$/, /^CODE_INVALID$/, /chrome-extension:|moz-extension:/,
  // Avertissements de Node sur une bibliothèque (fonction ancienne encore utilisée) : pas un incident
  /DeprecationWarning/
]

/** Message ramené à sa forme générale : les identifiants et nombres ne créent pas de nouveaux problèmes. */
const normalize = (s: string) => s.replace(/\b[a-z0-9]{20,}\b/gi, '<id>').replace(/\d+/g, '<n>').slice(0, 300)

const firstFrame = (stack?: string | null) => stack?.split('\n').find(l => /\s+at\s/.test(l))?.replace(/:\d+:\d+\)?$/, '').trim() ?? ''

// Limite par instance : une même erreur en boucle n'écrit en base qu'une fois par minute
const recent = new Map<string, number>()

export function isExpectedError(error: unknown) {
  return !!error && typeof error === 'object' && (error as { expected?: boolean }).expected === true
}

export async function recordError(input: { source: Source; message: string; stack?: string | null; path?: string | null }) {
  const message = (input.message || 'Erreur sans message').slice(0, 1000)
  if (IGNORED.some(r => r.test(message))) return
  const fingerprint = createHash('sha1').update(`${input.source}|${normalize(message)}|${firstFrame(input.stack)}`).digest('hex')
  const last = recent.get(fingerprint)
  if (last && Date.now() - last < 60_000) return
  recent.set(fingerprint, Date.now())
  if (recent.size > 500) recent.clear()

  const existing = await prisma.errorEvent.findUnique({ where: { fingerprint }, select: { id: true, resolvedAt: true } })
  if (existing) {
    await prisma.errorEvent.update({
      where: { id: existing.id },
      data: { count: { increment: 1 }, lastSeen: new Date(), resolvedAt: null, path: input.path?.slice(0, 300) ?? undefined, ...(existing.resolvedAt ? { notifiedAt: null } : {}) }
    })
  } else {
    await prisma.errorEvent.create({
      data: { fingerprint, source: input.source, message, stack: input.stack?.slice(0, 4000) ?? null, path: input.path?.slice(0, 300) ?? null }
    })
  }
  await alertIfNew(fingerprint)
}

/** Premier signalement (ou retour d'un problème réglé) : un e-mail, une seule fois. */
async function alertIfNew(fingerprint: string) {
  const claim = await prisma.errorEvent.updateMany({ where: { fingerprint, notifiedAt: null }, data: { notifiedAt: new Date() } })
  if (claim.count === 0) return
  const [event, config] = await Promise.all([
    prisma.errorEvent.findUnique({ where: { fingerprint } }),
    prisma.platformConfig.findUnique({ where: { id: 'default' }, select: { companyEmail: true } })
  ])
  const to = process.env.ALERT_EMAIL || config?.companyEmail
  if (!event || !to) return
  const { sendEmail, appUrl } = await import('@/lib/messaging')
  const { notify } = await import('@/lib/notifications')
  await notify({ event: 'ERROR_SPIKE', url: '/admin/health', groupKey: 'error', title: `Erreur ${event.source === 'SERVER' ? 'serveur' : 'navigateur'}`, groupTitle: n => `${n} nouvelles erreurs`, body: event.message.slice(0, 140) }).catch(() => null)
  await sendEmail({
    to, purpose: 'ANNOUNCEMENT',
    subject: `[Lerena] Nouvelle erreur ${event.source === 'SERVER' ? 'serveur' : 'navigateur'} : ${event.message.slice(0, 80)}`,
    text: `${event.message}\n\nPage : ${event.path ?? '—'}\n\n${event.stack ?? ''}\n\nTableau des erreurs : ${appUrl()}/admin/health`
  })
}

let installed = false
let inside = false

/**
 * Côté serveur : chaque console.error (blocs catch des actions, erreurs de rendu) alimente aussi le journal.
 * Appelé une fois au démarrage par instrumentation.ts.
 */
export function captureServerErrors() {
  if (installed) return
  installed = true
  const original = console.error.bind(console)
  console.error = (...args: unknown[]) => {
    original(...args)
    if (inside) return
    const error = args.find((a): a is Error => a instanceof Error)
    if (error && isExpectedError(error)) return
    const message = error?.message ?? args.map(a => (typeof a === 'string' ? a : '')).join(' ').trim()
    if (!message) return
    const context = typeof args[0] === 'string' && error ? `${args[0]} ${message}` : message
    inside = true
    recordError({ source: 'SERVER', message: context, stack: error?.stack }).catch(() => null).finally(() => { inside = false })
  }
}
