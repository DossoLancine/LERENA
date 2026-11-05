import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import type { Provider } from 'next-auth/providers/index'
import { prisma } from '@/lib/prisma'
import { getIntegration } from '@/lib/integrations'
import { codeChannel, testEnvironment } from '@/lib/otp'

// Méthodes de connexion (N9) : chacune n'apparaît que si son connecteur est branché
// (en environnement de test, codes et liens sont simulés et lisibles dans Console → Messages).

import type { SignInMethod } from '@/lib/auth-method-labels'
export { METHOD_LABELS, passwordlessAllowed, ssoAllowed, type SignInMethod } from '@/lib/auth-method-labels'


export async function availableSignInMethods() {
  const [channel, email, google, microsoft] = await Promise.all([codeChannel(), getIntegration('EMAIL'), getIntegration('AUTH'), getIntegration('AUTH_MICROSOFT')])
  return {
    phoneCode: channel ? { channel, simulated: !(await getIntegration(channel)).live } : null,
    emailLink: email.live || testEnvironment() ? { simulated: !email.live } : null,
    google: google.live,
    microsoft: microsoft.live
  }
}

/** Fournisseurs Google et Microsoft réglés dans la console (lus à chaque requête de connexion). */
export async function oauthProviders(): Promise<Provider[]> {
  const [g, m] = await Promise.all([getIntegration('AUTH'), getIntegration('AUTH_MICROSOFT')])
  const list: Provider[] = []
  if (g.live) list.push(GoogleProvider({ clientId: g.values.clientId, clientSecret: g.values.clientSecret, authorization: { params: { prompt: 'select_account' } } }))
  if (m.live) {
    list.push(AzureADProvider({
      clientId: m.values.clientId, clientSecret: m.values.clientSecret, tenantId: m.values.tenantId || 'common',
      authorization: { params: { scope: 'openid profile email User.Read' } },
      // Certains comptes d'entreprise n'ont pas de « mail » : l'identifiant de connexion est alors l'adresse
      profile(p: { sub: string; name?: string; email?: string; preferred_username?: string }) {
        return { id: p.sub, name: p.name ?? null, email: (p.email || p.preferred_username || '').toLowerCase() || null, image: null }
      }
    }))
  }
  return list
}

/** Session d'un appareil (listée et révocable dans « Sécurité du compte »), avec la méthode de connexion. */
export async function openSession(userId: string, method: SignInMethod, info: { userAgent?: string | null; ip?: string | null }) {
  const [session] = await Promise.all([
    prisma.authSession.create({ data: { userId, method, userAgent: info.userAgent?.slice(0, 200) ?? null, ip: info.ip ?? null }, select: { id: true } }),
    prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
  ])
  return session.id
}
