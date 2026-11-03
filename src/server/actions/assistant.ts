'use server'

import { prisma } from '@/lib/prisma'
import { getManagerContext } from '@/lib/session'
import { audit } from '@/lib/audit'
import { getAnalysis, recentComments } from '@/lib/analysis'
import { suggestReply } from '@/lib/feedback-themes'
import { aiComplete, AiUnavailableError } from '@/lib/ai'
import { isLive } from '@/lib/integrations'
import { firstNameOf } from '@/lib/campaign-text'

// Assistant d'analyse : intégré (toujours disponible), analyse avancée par l'IA (si le connecteur est branché).

const scopeKey = (siteIds: string[] | null) => (siteIds ? [...siteIds].sort().join(',') : 'all')
const PER_DAY = 3

export interface AdvancedInsight {
  summary: string
  themes: { label: string; share: number; sentiment: 'negative' | 'positive'; quote: string }[]
  recommendations: string[]
}

export async function getAssistant() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return null
  const [analysis, aiLive, last] = await Promise.all([
    getAnalysis(ctx.orgId, ctx.siteIds),
    isLive('AI'),
    prisma.aiInsight.findFirst({ where: { organizationId: ctx.orgId, scopeKey: scopeKey(ctx.siteIds) }, orderBy: { createdAt: 'desc' }, select: { content: true, createdAt: true, model: true } })
  ])
  return { ...analysis, advanced: { available: aiLive, last: last ? { ...last, content: last.content as unknown as AdvancedInsight } : null } }
}

/** Analyse avancée des commentaires par l'IA (textes anonymisés), 3 fois par jour au plus. */
export async function runAdvancedAnalysis() {
  const ctx = await getManagerContext('stats.view')
  if (!ctx) return { success: false as const, error: 'Non autorisé' }
  if (!(await isLive('AI'))) return { success: false as const, error: 'L’analyse avancée n’est pas activée (Console → Intégrations → IA).' }
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  if ((await prisma.aiInsight.count({ where: { organizationId: ctx.orgId, createdAt: { gte: today } } })) >= PER_DAY) return { success: false as const, error: `${PER_DAY} analyses par jour au plus : réessayez demain.` }
  const comments = (await recentComments(ctx.orgId, ctx.siteIds)).slice(0, 300)
  if (comments.length < 5) return { success: false as const, error: 'Pas assez de commentaires sur les 8 dernières semaines (5 au minimum).' }

  const list = comments.map((c, i) => `${i + 1}. [${c.rating}/5] ${c.comment.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n')
  try {
    const res = await aiComplete({
      system: 'Tu analyses les commentaires laissés par les visiteurs d’un établissement en Côte d’Ivoire (hôpital, administration, banque…). Les textes sont anonymisés. Réponds uniquement par un objet JSON valide, en français, sans texte autour.',
      prompt: `Voici ${comments.length} commentaires des 8 dernières semaines, avec la note donnée :\n\n${list}\n\nRenvoie ce JSON :\n{"summary": "3 phrases au plus : ce que disent les visiteurs", "themes": [{"label": "thème court", "share": pourcentage entier des commentaires, "sentiment": "negative" ou "positive", "quote": "citation courte tirée des commentaires"}], "recommendations": ["3 actions concrètes au plus, réalistes pour l’établissement"]}\nAu plus 6 thèmes, du plus fréquent au moins fréquent.`,
      maxTokens: 2000,
      effort: 'medium'
    })
    const json = res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1)
    const parsed = JSON.parse(json) as AdvancedInsight
    const content: AdvancedInsight = {
      summary: String(parsed.summary ?? '').slice(0, 800),
      themes: (Array.isArray(parsed.themes) ? parsed.themes : []).slice(0, 6).map(t => ({ label: String(t.label).slice(0, 60), share: Math.max(0, Math.min(100, Math.round(Number(t.share) || 0))), sentiment: t.sentiment === 'positive' ? 'positive' : 'negative', quote: String(t.quote ?? '').slice(0, 200) })),
      recommendations: (Array.isArray(parsed.recommendations) ? parsed.recommendations : []).slice(0, 3).map(r => String(r).slice(0, 300))
    }
    await prisma.aiInsight.create({ data: { organizationId: ctx.orgId, scopeKey: scopeKey(ctx.siteIds), content: content as object, model: res.model, inputTokens: res.inputTokens, outputTokens: res.outputTokens, createdById: ctx.userId } })
    await audit({ action: 'AI_ANALYSIS', targetType: 'Organization', targetId: ctx.orgId, organizationId: ctx.orgId, details: `${comments.length} commentaires anonymisés · ${res.inputTokens}+${res.outputTokens} jetons` })
    return { success: true as const }
  } catch (error) {
    if (error instanceof AiUnavailableError) return { success: false as const, error: error.message }
    if (error instanceof SyntaxError) return { success: false as const, error: 'Réponse de l’IA illisible : réessayez.' }
    console.error('AI analysis error:', error)
    return { success: false as const, error: 'L’analyse avancée a échoué : réessayez plus tard.' }
  }
}

/** Réponse proposée à un avis négatif (modèle selon le motif ou le thème), à relire avant l'envoi. */
export async function getSuggestedReply(complaintId: string) {
  const ctx = await getManagerContext('feedback.manage')
  if (!ctx) return null
  const c = await prisma.complaint.findFirst({
    where: { id: complaintId, organizationId: ctx.orgId },
    select: { reason: true, comment: true, rating: true, customer: { select: { name: true } }, ticket: { select: { guestName: true } }, organization: { select: { name: true } } }
  })
  if (!c) return null
  return suggestReply({ reason: c.reason, comment: c.comment, rating: c.rating, orgName: c.organization.name, firstName: firstNameOf(c.customer?.name ?? c.ticket.guestName ?? null) })
}
