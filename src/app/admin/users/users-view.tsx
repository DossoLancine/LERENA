'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { KeyRound, LogOut, Search, ShieldOff, Users } from 'lucide-react'
import { supportUserAction, type searchUsers } from '@/server/actions/billing-admin'
import { Badge, Card, EmptyState, useToast } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'

type User = NonNullable<Awaited<ReturnType<typeof searchUsers>>>[number]
const ROLES: Record<string, string> = { CLIENT: 'Visiteur', AGENT: 'Agent', RECEPTION: 'Accueil', MANAGER: 'Responsable', ORG_ADMIN: 'Admin réseau', VIEWER: 'Lecteur réseau', SUPER_ADMIN: 'Lerena' }
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'jamais')

/** Recherche de comptes sur toute la plateforme et actions de support. */
export function UsersView({ users, q }: { users: User[]; q: string }) {
  const router = useRouter()
  const toast = useToast()
  const [query, setQuery] = useState(q)

  const act = async (u: User, action: 'SIGN_OUT' | 'RESET_LINK' | 'RESET_2FA', ok: string) => {
    if (action === 'RESET_2FA' && !confirm(`Retirer la double authentification de ${u.name ?? u.email} ?`)) return
    const res = await supportUserAction(u.id, action)
    if (!res.success) return toast(res.error, 'error')
    toast(ok)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Utilisateurs" subtitle="Tous les comptes : visiteurs, équipes des établissements, réseaux. Chaque action est tracée." />
      <Card>
        <form onSubmit={e => { e.preventDefault(); router.push(`/admin/users?q=${encodeURIComponent(query)}`) }} className="border-b border-surface-line px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Rechercher un compte</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Nom, e-mail ou téléphone, puis Entrée" className="w-full rounded-control border border-gray-200 py-2 pl-9 pr-3 text-sm" />
          </label>
        </form>
        {users.length === 0 ? <EmptyState icon={<Users size={40} />} title="Aucun compte trouvé" /> : (
          <ul className="stagger divide-y divide-surface-line">
            {users.map(u => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">{(u.name ?? u.email ?? '?').charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">{u.name ?? '—'} <Badge tone={u.role === 'SUPER_ADMIN' ? 'brand' : 'neutral'}>{ROLES[u.role] ?? u.role}</Badge>{u.twoFactorEnabled && <Badge tone="success">2FA</Badge>}{u.mustChangePassword && <Badge tone="warning">Mot de passe provisoire</Badge>}</p>
                  <p className="truncate text-xs text-ink-subtle">
                    {[u.email, u.phone].filter(Boolean).join(' · ')} · inscrit le {date(u.createdAt)} · dernière connexion : {date(u.lastLoginAt)}
                    {u.orgs.length > 0 && <> · {u.orgs.map((o, i) => <span key={o.id}>{i ? ', ' : ''}<Link href={`/admin/clients/${o.id}`} className="text-brand hover:underline">{o.name}</Link></span>)}</>}
                    {u.role === 'CLIENT' && ` · ${u.tickets} tickets`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" title="Envoyer un lien de réinitialisation" aria-label={`Réinitialiser le mot de passe de ${u.name ?? u.email}`} onClick={() => act(u, 'RESET_LINK', 'Lien de réinitialisation envoyé')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><KeyRound size={16} /></button>
                  <button type="button" title={`Déconnecter partout (${u.sessions} session${u.sessions > 1 ? 's' : ''})`} aria-label={`Déconnecter ${u.name ?? u.email} partout`} onClick={() => act(u, 'SIGN_OUT', 'Sessions fermées')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><LogOut size={16} /></button>
                  {u.twoFactorEnabled && <button type="button" title="Retirer la double authentification" aria-label={`Retirer la double authentification de ${u.name ?? u.email}`} onClick={() => act(u, 'RESET_2FA', 'Double authentification retirée')} className="rounded-lg p-2 text-ink-muted hover:bg-gray-100"><ShieldOff size={16} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
