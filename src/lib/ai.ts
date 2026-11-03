import Anthropic from '@anthropic-ai/sdk'
import { getIntegration, type ResolvedIntegration } from '@/lib/integrations'

// Analyse avancée par l'API Claude (connecteur « IA » de la console). Facultative : sans clé, l'assistant d'analyse
// intégré travaille seul. N'envoyer ici que des textes anonymisés (aucun nom, numéro ni compte).

const DEFAULT_MODEL = 'claude-opus-5-5'

let client: { key: string; value: Anthropic } | null = null

function clientFor(apiKey: string) {
  if (client?.key !== apiKey) client = { key: apiKey, value: new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 }) }
  return client.value
}

export async function aiEnabled() {
  return (await getIntegration('AI')).live
}

export class AiUnavailableError extends Error { readonly expected = true }

/**
 * Une demande, une réponse texte. Le modèle peut refuser certaines demandes (stop_reason « refusal ») :
 * un second modèle prend alors le relais (repli côté serveur) ; si tous refusent, une erreur est levée.
 */
export async function aiComplete(input: { system: string; prompt: string; maxTokens?: number; effort?: 'low' | 'medium' | 'high' }, config?: ResolvedIntegration) {
  const c = config ?? await getIntegration('AI')
  if (!c.live) throw new AiUnavailableError('Analyse avancée non activée')
  const response = await clientFor(c.values.apiKey).beta.messages.create({
    model: c.values.model || DEFAULT_MODEL,
    max_tokens: input.maxTokens ?? 4000,
    system: input.system,
    output_config: { effort: input.effort ?? 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: input.prompt }]
  })
  if (response.stop_reason === 'refusal') throw new AiUnavailableError('Le modèle a refusé la demande')
  const text = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
  return { text, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
}
