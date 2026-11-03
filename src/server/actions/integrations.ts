'use server'

import { prisma } from '@/lib/prisma'
import { getSuperAdmin } from '@/lib/session'
import { audit } from '@/lib/audit'
import { appUrl } from '@/lib/messaging'
import { describeIntegrations, getIntegrationForTest, recordIntegrationTest, saveIntegration } from '@/lib/integrations'
import { isIntegrationKind, providerDefinition, type IntegrationKind, type IntegrationMode } from '@/lib/integration-catalog'
import { deliverEmail } from '@/lib/email'
import { deliverSms } from '@/lib/sms'
import { deliverWhatsApp } from '@/lib/whatsapp'
import { aiComplete } from '@/lib/ai'
import { createPaymentLink } from '@/lib/payments'
import { checkPushKeys, generatePushKeys, sendPushToUser } from '@/lib/push'
import { normalizePhone } from '@/lib/phone'

// Console de la startup → Intégrations : réglage, test et activation des connecteurs (SUPER_ADMIN uniquement).

const denied = { success: false as const, error: 'Non autorisé' }
const CHANNEL: Partial<Record<IntegrationKind, string>> = { EMAIL: 'EMAIL', SMS: 'SMS', WHATSAPP: 'WHATSAPP' }

export async function getIntegrations() {
  const admin = await getSuperAdmin()
  if (!admin) return null
  const monthStart = new Date(new Date().toISOString().slice(0, 8) + '01T00:00:00Z')
  const [list, usage] = await Promise.all([
    describeIntegrations(),
    prisma.outboundMessage.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: monthStart } }, _count: { _all: true } })
  ])
  return list.map(i => {
    const channel = CHANNEL[i.kind]
    const n = (status: string) => usage.find(u => u.channel === channel && u.status === status)?._count._all ?? 0
    return { ...i, month: channel ? { sent: n('SENT'), simulated: n('SIMULATED'), failed: n('FAILED') } : null }
  })
}

export async function updateIntegration(kind: string, input: { provider: string; mode: IntegrationMode; values: Record<string, string> }) {
  const admin = await getSuperAdmin()
  if (!admin) return denied
  if (!isIntegrationKind(kind)) return { success: false as const, error: 'Connecteur inconnu' }
  if (!providerDefinition(kind, input.provider)) return { success: false as const, error: 'Prestataire inconnu' }
  try {
    await saveIntegration(kind, input, admin.name ?? admin.id)
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Enregistrement impossible' }
  }
  await audit({ action: 'INTEGRATION_UPDATED', targetType: 'Integration', targetId: kind, details: `${input.provider} · ${input.mode}` })
  return { success: true as const }
}

/** Nouvelle paire de clés pour les notifications push (enregistrée directement, en production). */
export async function generatePushIntegrationKeys() {
  const admin = await getSuperAdmin()
  if (!admin) return denied
  const keys = generatePushKeys()
  await saveIntegration('PUSH', { provider: 'vapid', mode: 'LIVE', values: { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: 'mailto:contact@lerena.ci' } }, admin.name ?? admin.id)
  await audit({ action: 'INTEGRATION_UPDATED', targetType: 'Integration', targetId: 'PUSH', details: 'nouvelles clés VAPID' })
  return { success: true as const }
}

/** Test réel du connecteur avec les identifiants enregistrés (possible avant de passer en production). */
export async function testIntegration(kind: string, target?: string) {
  const admin = await getSuperAdmin()
  if (!admin) return denied
  if (!isIntegrationKind(kind)) return { success: false as const, error: 'Connecteur inconnu' }
  const c = await getIntegrationForTest(kind)
  if (c.missing.length) return { success: false as const, error: `À compléter : ${c.missing.join(', ')}` }

  const stamp = new Date().toLocaleString('fr-FR', { timeZone: 'UTC' })
  const text = `Lerena : test du connecteur ${kind} (${c.provider}) le ${stamp}. Tout fonctionne.`
  let detail = ''
  try {
    switch (kind) {
      case 'EMAIL': {
        if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return { success: false as const, error: 'Adresse e-mail de test invalide' }
        await deliverEmail({ to: target, subject: 'Lerena : e-mail de test', text }, c)
        detail = `E-mail envoyé à ${target}`
        break
      }
      case 'SMS':
      case 'WHATSAPP': {
        const phone = normalizePhone(target)
        if (!phone) return { success: false as const, error: 'Numéro de test invalide (format +225…)' }
        if (kind === 'SMS') await deliverSms(phone, text, c)
        else await deliverWhatsApp(phone, text, c.provider === 'meta' ? { name: 'hello_world', language: 'en_US' } : undefined, c)
        detail = `Message envoyé au ${phone}`
        break
      }
      case 'PUSH': {
        checkPushKeys(c.values.publicKey, c.values.privateKey, c.values.subject)
        const devices = c.live ? await sendPushToUser(admin.id, { title: 'Lerena', body: 'Notification de test : tout fonctionne.', url: '/admin/integrations', tag: 'test' }) : 0
        detail = devices ? `Notification envoyée à ${devices} appareil${devices > 1 ? 's' : ''}` : 'Clés valides. Activez les notifications sur un appareil pour recevoir un test.'
        break
      }
      case 'AI': {
        const r = await aiComplete({ system: 'Tu réponds en français, en une phrase courte.', prompt: 'Confirme que la connexion fonctionne.', maxTokens: 200, effort: 'low' }, c)
        detail = `Réponse de ${r.model} : « ${r.text.slice(0, 160)} »`
        break
      }
      case 'PAYMENT': {
        const link = await createPaymentLink({ amount: 100, reference: `TEST${Date.now()}`, description: 'Test Lerena', returnUrl: `${appUrl()}/admin/integrations` }, c)
        detail = link ? `Lien de paiement créé (${link.provider}) : ${link.url}` : 'Aucun lien créé'
        break
      }
      case 'AUTH':
        detail = 'Identifiants complets. La connexion sera proposée à l’étape N9.'
        break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await recordIntegrationTest(kind, false, message)
    await audit({ action: 'INTEGRATION_TESTED', targetType: 'Integration', targetId: kind, details: `échec : ${message.slice(0, 200)}` })
    return { success: false as const, error: message.slice(0, 300) }
  }
  await recordIntegrationTest(kind, true)
  await audit({ action: 'INTEGRATION_TESTED', targetType: 'Integration', targetId: kind, details: detail.slice(0, 200) })
  return { success: true as const, detail }
}
