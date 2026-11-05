import { prisma } from '@/lib/prisma'
import { decryptSecret, encryptSecret } from '@/lib/totp'
import { integrationDefinition, providerDefinition, type IntegrationKind, type IntegrationMode } from '@/lib/integration-catalog'

// Configuration des connecteurs : réglée dans la console (table Integration, clés chiffrées), sinon reprise des
// anciennes variables d'environnement. Module serveur uniquement. Les secrets ne sortent jamais vers le navigateur.

export interface ResolvedIntegration {
  kind: IntegrationKind
  provider: string
  /** LIVE seulement si le mode est « production » ET que tous les champs obligatoires sont remplis. */
  live: boolean
  mode: IntegrationMode
  values: Record<string, string>
  source: 'console' | 'environment' | 'none'
  missing: string[]
}

const TTL_MS = 30_000
const cache = new Map<IntegrationKind, { at: number; value: ResolvedIntegration }>()

/** Anciennes variables d'environnement : les réglages déjà en place continuent de fonctionner. */
function fromEnvironment(kind: IntegrationKind): { provider: string; values: Record<string, string> } | null {
  const env = process.env
  const pick = (map: Record<string, string | undefined>) => Object.fromEntries(Object.entries(map).filter(([, v]) => !!v)) as Record<string, string>
  switch (kind) {
    case 'EMAIL':
      if (env.SMTP_HOST) return { provider: 'smtp', values: pick({ host: env.SMTP_HOST, port: env.SMTP_PORT || '587', user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.EMAIL_FROM }) }
      if (env.RESEND_API_KEY) return { provider: 'resend', values: pick({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM || 'Lerena <onboarding@resend.dev>' }) }
      return null
    case 'SMS':
      if (env.SMS_PROVIDER === 'orange') return { provider: 'orange', values: pick({ clientId: env.ORANGE_CLIENT_ID, clientSecret: env.ORANGE_CLIENT_SECRET, senderPhone: env.ORANGE_SENDER_PHONE, senderName: env.ORANGE_SENDER_NAME }) }
      if (env.SMS_PROVIDER === 'http') return { provider: 'http', values: pick({ url: env.SMS_HTTP_URL, authHeader: env.SMS_HTTP_AUTH, sender: env.SMS_HTTP_SENDER }) }
      return null
    case 'PUSH':
      if (env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) return { provider: 'vapid', values: pick({ publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }) }
      return null
    case 'AI':
      if (env.ANTHROPIC_API_KEY) return { provider: 'anthropic', values: { apiKey: env.ANTHROPIC_API_KEY } }
      return null
    default:
      return null
  }
}

function resolve(kind: IntegrationKind, provider: string, mode: IntegrationMode, values: Record<string, string>, source: ResolvedIntegration['source']): ResolvedIntegration {
  const def = providerDefinition(kind, provider)
  const missing = (def?.fields ?? []).filter(f => f.required && !values[f.key]?.trim()).map(f => f.label)
  return { kind, provider, mode, values, source, missing, live: mode === 'LIVE' && !!def && missing.length === 0 }
}

/** Connecteur prêt à l'emploi (mis en cache 30 secondes). */
export async function getIntegration(kind: IntegrationKind): Promise<ResolvedIntegration> {
  const hit = cache.get(kind)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  let value: ResolvedIntegration
  const row = await prisma.integration.findUnique({ where: { kind } }).catch(() => null)
  if (row) {
    let secrets: Record<string, string> = {}
    try { secrets = row.secrets ? JSON.parse(decryptSecret(row.secrets)) : {} } catch { secrets = {} }
    value = resolve(kind, row.provider, row.mode as IntegrationMode, { ...(row.settings as Record<string, string>), ...secrets }, 'console')
  } else {
    const env = fromEnvironment(kind)
    value = env
      ? resolve(kind, env.provider, 'LIVE', env.values, 'environment')
      : resolve(kind, integrationDefinition(kind).providers[0].id, 'SIMULATION', {}, 'none')
  }
  cache.set(kind, { at: Date.now(), value })
  return value
}

export const isLive = async (kind: IntegrationKind) => (await getIntegration(kind)).live

/** Pour le bouton « Tester » : le connecteur tel que réglé, utilisable même en simulation si ses champs sont complets. */
export async function getIntegrationForTest(kind: IntegrationKind): Promise<ResolvedIntegration> {
  clearIntegrationCache(kind)
  const c = await getIntegration(kind)
  return { ...c, live: c.missing.length === 0 && !!providerDefinition(kind, c.provider) }
}

export function clearIntegrationCache(kind?: IntegrationKind) {
  if (kind) cache.delete(kind)
  else cache.clear()
}

/**
 * Enregistre un connecteur. Les secrets laissés vides gardent leur valeur actuelle ;
 * changer de prestataire efface les anciens réglages et secrets.
 */
export async function saveIntegration(kind: IntegrationKind, input: { provider: string; mode: IntegrationMode; values: Record<string, string> }, updatedBy: string | null) {
  const def = providerDefinition(kind, input.provider)
  if (!def) throw new Error('Prestataire inconnu')
  const current = await prisma.integration.findUnique({ where: { kind } })
  let previousSecrets: Record<string, string> = {}
  if (current?.secrets && current.provider === input.provider) {
    try { previousSecrets = JSON.parse(decryptSecret(current.secrets)) } catch { previousSecrets = {} }
  }
  const settings: Record<string, string> = {}
  const secrets: Record<string, string> = { ...previousSecrets }
  for (const field of def.fields) {
    const raw = typeof input.values[field.key] === 'string' ? input.values[field.key].trim().slice(0, 4000) : ''
    if (field.secret) { if (raw) secrets[field.key] = raw }
    else if (raw) settings[field.key] = raw
  }
  const data = {
    provider: input.provider,
    mode: input.mode === 'LIVE' ? 'LIVE' : 'SIMULATION',
    settings,
    secrets: Object.keys(secrets).length ? encryptSecret(JSON.stringify(secrets)) : null,
    updatedBy,
    ...(current?.provider !== input.provider ? { lastTestAt: null, lastTestOk: null, lastError: null } : {})
  }
  await prisma.integration.upsert({ where: { kind }, update: data, create: { kind, ...data } })
  clearIntegrationCache(kind)
}

export async function recordIntegrationTest(kind: IntegrationKind, ok: boolean, error?: string) {
  await prisma.integration.updateMany({ where: { kind }, data: { lastTestAt: new Date(), lastTestOk: ok, lastError: ok ? null : (error ?? 'Échec').slice(0, 300) } })
}

/** Vue de la console : réglages visibles, secrets seulement signalés (jamais renvoyés). */
export async function describeIntegrations() {
  const rows = await prisma.integration.findMany()
  const kinds: IntegrationKind[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'AI', 'PAYMENT', 'AUTH', 'AUTH_MICROSOFT']
  return Promise.all(kinds.map(async kind => {
    clearIntegrationCache(kind)
    const r = await getIntegration(kind)
    const row = rows.find(x => x.kind === kind)
    const def = providerDefinition(kind, r.provider)
    return {
      kind, provider: r.provider, mode: r.mode, live: r.live, source: r.source, missing: r.missing,
      settings: Object.fromEntries((def?.fields ?? []).filter(f => !f.secret).map(f => [f.key, r.values[f.key] ?? ''])),
      secretsSet: Object.fromEntries((def?.fields ?? []).filter(f => f.secret).map(f => [f.key, !!r.values[f.key]])),
      lastTestAt: row?.lastTestAt ?? null, lastTestOk: row?.lastTestOk ?? null, lastError: row?.lastError ?? null, updatedAt: row?.updatedAt ?? null
    }
  }))
}
