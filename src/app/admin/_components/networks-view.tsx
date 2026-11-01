'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, UserPlus, Network } from 'lucide-react'
import { createNetwork, addNetworkMember, type getAdminNetworks } from '@/server/actions/admin'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, SelectInput, TextInput, useToast } from '@/components/ui'
import { CredentialsNotice } from '@/components/admin/credentials-notice'

type Networks = NonNullable<Awaited<ReturnType<typeof getAdminNetworks>>>

const text = (f: FormData, k: string) => String(f.get(k) ?? '')

export function NetworksView({ networks }: { networks: Networks }) {
  const router = useRouter()
  const toast = useToast()
  const [showNew, setShowNew] = useState(false)
  const [memberFor, setMemberFor] = useState<Networks[number] | null>(null)
  const [busy, setBusy] = useState(false)
  const [credentials, setCredentials] = useState<{ email: string; password: string | null } | null>(null)

  const done = (res: { success: true; email: string; tempPassword: string | null } | { success: false; error: string }) => {
    setBusy(false)
    if (!res.success) { toast(res.error, 'error'); return false }
    setCredentials({ email: res.email, password: res.tempPassword })
    router.refresh()
    return true
  }

  const submitNetwork = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    if (done(await createNetwork({ name: text(f, 'name'), sector: text(f, 'sector'), admin: { name: text(f, 'adminName'), email: text(f, 'adminEmail') } }))) setShowNew(false)
  }

  const submitMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!memberFor) return
    const f = new FormData(e.currentTarget)
    setBusy(true)
    if (done(await addNetworkMember(memberFor.id, { name: text(f, 'name'), email: text(f, 'email'), role: text(f, 'role') as 'ORG_ADMIN' | 'VIEWER' }))) setMemberFor(null)
  }

  return (
    <>
      {credentials && <CredentialsNotice email={credentials.email} password={credentials.password} onDone={() => setCredentials(null)} />}

      <Card>
        <CardHeader
          title="Réseaux"
          subtitle="Groupes d’établissements pilotés par un même administrateur (banque, ministère, chaîne…)"
          action={<Button size="sm" icon={<Plus size={16} />} onClick={() => setShowNew(true)}>Nouveau réseau</Button>}
        />
        {networks.length === 0 ? (
          <EmptyState icon={<Network size={40} />} title="Aucun réseau" description="Créez un réseau puis rattachez-y ses établissements depuis l’onglet Établissements." />
        ) : (
          <ul className="divide-y divide-surface-line">
            {networks.map(n => (
              <li key={n.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{n.name}</p>
                  <p className="text-xs text-ink-muted">{[n.sector, `${n.sites} site${n.sites > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {n.members.map(m => (
                      <li key={m.id} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-ink">
                        {m.name || m.email}
                        <Badge tone={m.role === 'ORG_ADMIN' ? 'brand' : 'neutral'}>{m.role === 'ORG_ADMIN' ? 'Admin' : 'Lecture'}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button size="sm" variant="secondary" icon={<UserPlus size={15} />} onClick={() => setMemberFor(n)} aria-label={`Ajouter un membre à ${n.name}`}>Membre</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={showNew} onClose={() => setShowNew(false)} title="Nouveau réseau">
        <form onSubmit={submitNetwork} className="space-y-4">
          <TextInput name="name" label="Nom du réseau" required maxLength={80} placeholder="Ex : Banque Atlantique" />
          <TextInput name="sector" label="Activité (facultatif)" maxLength={60} />
          <TextInput name="adminName" label="Nom de l’administrateur" required maxLength={80} />
          <TextInput name="adminEmail" type="email" label="E-mail de l’administrateur" required hint="Un mot de passe provisoire sera affiché une seule fois." />
          <Button type="submit" fullWidth loading={busy}>Créer le réseau</Button>
        </form>
      </Dialog>

      <Dialog open={!!memberFor} onClose={() => setMemberFor(null)} title={`Membre — ${memberFor?.name ?? ''}`}>
        <form onSubmit={submitMember} className="space-y-4">
          <TextInput name="name" label="Nom complet" required maxLength={80} />
          <TextInput name="email" type="email" label="E-mail" required />
          <SelectInput name="role" label="Accès" defaultValue="VIEWER" hint="Lecture : consulte les sites et rapports sans rien modifier.">
            <option value="VIEWER">Lecture seule (direction, tutelle)</option>
            <option value="ORG_ADMIN">Administrateur du réseau</option>
          </SelectInput>
          <Button type="submit" fullWidth loading={busy}>Ajouter</Button>
        </form>
      </Dialog>
    </>
  )
}
