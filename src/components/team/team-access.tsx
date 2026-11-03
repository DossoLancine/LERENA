'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { UserPlus, ShieldCheck, Clock, Ban, RotateCcw, Trash2, Pencil, Check, X, Copy, Map as MapIcon, KeyRound, Users } from 'lucide-react'
import {
  deleteCustomRole, deleteRegion, getTeam, inviteMember, removeMember, saveCustomRole, saveRegion, setMemberDisabled, updateMemberAccess
} from '@/server/actions/team'
import { ACCESS_ROLES, PERMISSION_GROUPS, ROLE_ORDER, permissionsOf, type AccessRole, type Permission } from '@/lib/access-catalog'
import { Badge, Button, Dialog, TextInput, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Team = NonNullable<Awaited<ReturnType<typeof getTeam>>>
type Member = Team['members'][number]
type Tab = 'members' | 'roles' | 'regions'

const day = (d: Date | string) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const daysAgo = (d: Date | string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400_000) : null)

/** Paramètres → Équipe et accès. */
export function TeamAccess() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('members')
  const [team, setTeam] = useState<Team | null | undefined>(undefined)
  const [editing, setEditing] = useState<Member | 'new' | null>(null)
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null)
  const load = useCallback(async () => setTeam(await getTeam().catch(() => null)), [])
  useEffect(() => { load() }, [load])

  if (team === undefined) return <div className="h-64 animate-pulse rounded-3xl bg-gray-100" />
  if (team === null) return <p className="rounded-card bg-white p-8 text-center text-sm text-ink-muted shadow-card">Votre rôle ne permet pas de gérer l’équipe.</p>

  const run = async (p: Promise<{ success: boolean; error?: string }>, ok: string) => {
    const res = await p
    if (!res.success) { toast(res.error ?? 'Action impossible', 'error'); return false }
    toast(ok, 'success'); await load(); return true
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-ink">Équipe et accès</h2>
          <p className="text-sm text-ink-muted">Chacun voit et fait exactement ce dont il a besoin, sur ses sites.</p>
        </div>
        <nav className="inline-flex rounded-xl bg-surface-sunken p-1 text-sm font-semibold" aria-label="Équipe et accès">
          {([['members', 'Membres', Users], ['roles', 'Rôles', KeyRound], ['regions', 'Régions', MapIcon]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5', tab === id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}><Icon size={14} /> {label}</button>
          ))}
        </nav>
      </header>

      {created && (
        <div role="status" className="rounded-2xl border border-green-200 bg-success-soft p-4 text-sm text-success-ink">
          <p className="font-semibold">Compte créé pour {created.name}. Transmettez ces identifiants : ils ne seront plus affichés (un e-mail est aussi envoyé).</p>
          <p className="mt-2 font-mono">{created.email}</p>
          <p className="font-mono text-base font-bold tracking-wider">{created.password}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => navigator.clipboard?.writeText(`${created.email}\n${created.password}`)}>Copier</Button>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>J’ai transmis</Button>
          </div>
        </div>
      )}

      {tab === 'members' && <MembersTab team={team} onEdit={setEditing} run={run} />}
      {tab === 'roles' && <RolesTab team={team} run={run} />}
      {tab === 'regions' && <RegionsTab team={team} run={run} />}

      {editing && (
        <AccessDialog team={team} member={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
          onSaved={async (res) => { setEditing(null); if (res) setCreated(res); await load() }} />
      )}
    </div>
  )
}

function scopeLabel(team: Team, m: { siteIds: string[]; regionIds: string[] }) {
  if (!m.siteIds.length && !m.regionIds.length) return 'Tous les sites'
  const parts = [
    ...team.regions.filter(r => m.regionIds.includes(r.id)).map(r => `Région ${r.name}`),
    ...team.sites.filter(s => m.siteIds.includes(s.id)).map(s => s.name)
  ]
  return parts.length ? parts.join(', ') : `${m.siteIds.length} site(s)`
}

function MembersTab({ team, onEdit, run }: { team: Team; onEdit: (m: Member | 'new') => void; run: (p: Promise<{ success: boolean; error?: string }>, ok: string) => Promise<boolean> }) {
  const inactive = team.members.filter(m => !m.disabledAt && (daysAgo(m.user.lastLoginAt) ?? 999) > 60 && (daysAgo(m.createdAt) ?? 0) > 60)
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{team.members.length} membre{team.members.length > 1 ? 's' : ''}{inactive.length ? ` · ${inactive.length} inactif${inactive.length > 1 ? 's' : ''} depuis 60 jours` : ''}</p>
        <Button icon={<UserPlus size={16} />} onClick={() => onEdit('new')}>Ajouter un membre</Button>
      </div>
      <ul className="divide-y divide-surface-line overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
        {team.members.map(m => {
          const role = ACCESS_ROLES[m.accessRole as AccessRole]
          const custom = team.customRoles.find(r => r.id === m.customRoleId)
          const expired = m.expiresAt && new Date(m.expiresAt).getTime() < Date.now()
          const idle = daysAgo(m.user.lastLoginAt)
          return (
            <li key={m.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3.5', (m.disabledAt || expired) && 'bg-surface-sunken/60 opacity-75')}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fb923c] to-brand text-sm font-bold text-white">{(m.user.name ?? '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">{m.user.name ?? m.user.email}</span>
                  {m.isMe && <Badge tone="neutral">Vous</Badge>}
                  <Badge tone={role.sensitive ? 'brand' : 'info'}>{custom ? custom.name : role.label}</Badge>
                  {m.disabledAt && <Badge tone="danger">Suspendu</Badge>}
                  {expired && <Badge tone="danger">Accès expiré</Badge>}
                  {!expired && m.expiresAt && <Badge tone="warning"><Clock size={11} /> jusqu’au {day(m.expiresAt)}</Badge>}
                  {role.sensitive && !m.user.twoFactorEnabled && <Badge tone="warning"><ShieldCheck size={11} /> sans double authentification</Badge>}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">{m.user.email} · {scopeLabel(team, m)} · {idle == null ? 'jamais connecté' : idle === 0 ? 'connecté aujourd’hui' : `dernière connexion il y a ${idle} j`}</p>
              </div>
              {!m.isMe && (
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => onEdit(m)}>Accès</Button>
                  {m.disabledAt
                    ? <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => run(setMemberDisabled(m.id, false), 'Accès rétabli')}>Rétablir</Button>
                    : <Button size="sm" variant="ghost" icon={<Ban size={14} />} onClick={() => run(setMemberDisabled(m.id, true), 'Accès suspendu, sessions fermées')}>Suspendre</Button>}
                  <button aria-label={`Retirer ${m.user.name ?? ''}`} onClick={() => window.confirm(`Retirer ${m.user.name ?? 'ce membre'} de l’équipe ?`) && run(removeMember(m.id), 'Membre retiré')} className="rounded-lg p-2 text-ink-subtle hover:bg-danger-soft hover:text-danger"><Trash2 size={14} /></button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AccessDialog({ team, member, onClose, onSaved }: { team: Team; member: Member | null; onClose: () => void; onSaved: (created: { name: string; email: string; password: string } | null) => Promise<void> }) {
  const toast = useToast()
  const allowedRoles = ROLE_ORDER.filter(r => (r !== 'OWNER' || team.me.accessRole === 'OWNER') && ACCESS_ROLES[r].permissions.every(p => team.me.permissions.includes(p)))
  const [role, setRole] = useState<AccessRole>((member?.accessRole as AccessRole) ?? (allowedRoles.includes('AGENT') ? 'AGENT' : allowedRoles[0]))
  const [customRoleId, setCustomRoleId] = useState<string>(member?.customRoleId ?? '')
  const [scope, setScope] = useState<'ALL' | 'REGIONS' | 'SITES'>(member ? (member.regionIds.length ? 'REGIONS' : member.siteIds.length ? 'SITES' : 'ALL') : team.me.scoped ? 'SITES' : 'ALL')
  const [siteIds, setSiteIds] = useState<string[]>(member?.siteIds ?? [])
  const [regionIds, setRegionIds] = useState<string[]>(member?.regionIds ?? [])
  const [temporary, setTemporary] = useState(!!member?.expiresAt)
  const [expiresAt, setExpiresAt] = useState(member?.expiresAt ? new Date(member.expiresAt).toISOString().slice(0, 10) : '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const customs = team.customRoles.filter(r => r.baseRole === role)
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const save = async () => {
    setBusy(true)
    const access = {
      accessRole: role, customRoleId: customRoleId || null,
      siteIds: scope === 'SITES' ? siteIds : [], regionIds: scope === 'REGIONS' ? regionIds : [],
      expiresAt: temporary && expiresAt ? `${expiresAt}T23:59:59Z` : null
    }
    const res = member ? await updateMemberAccess(member.id, access) : await inviteMember({ ...access, name, email, phone })
    setBusy(false)
    if (!res.success) return toast(res.error, 'error')
    toast(member ? 'Accès mis à jour (la personne est déconnectée pour appliquer ses nouveaux droits)' : 'Membre ajouté', 'success')
    // Nouveau compte : identifiants provisoires à transmettre (affichés une seule fois)
    const invited = !member ? (res as unknown as { tempPassword: string | null; name: string; email: string }) : null
    await onSaved(invited?.tempPassword ? { name: invited.name, email: invited.email, password: invited.tempPassword } : null)
  }

  return (
    <Dialog open onClose={onClose} title={member ? `Accès de ${member.user.name ?? member.user.email}` : 'Ajouter un membre'} size="lg">
      <div className="space-y-5">
        {!member && (
          <div className="grid gap-3 sm:grid-cols-3">
            <TextInput label="Nom" value={name} onChange={e => setName(e.target.value)} />
            <TextInput label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <TextInput label="Téléphone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+225…" />
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Rôle</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {allowedRoles.map(r => (
              <button key={r} onClick={() => { setRole(r); setCustomRoleId(''); setScope(ACCESS_ROLES[r].scope === 'ALL' || team.me.scoped ? (team.me.scoped ? 'SITES' : 'ALL') : ACCESS_ROLES[r].scope) }} aria-pressed={role === r}
                className={cn('rounded-2xl border-2 p-3 text-left', role === r ? 'border-brand bg-brand-50/50' : 'border-surface-line')}>
                <span className="block text-sm font-semibold text-ink">{ACCESS_ROLES[r].label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{ACCESS_ROLES[r].description}</span>
              </button>
            ))}
          </div>
          {customs.length > 0 && (
            <label className="mt-3 block text-xs font-semibold text-ink-muted">Variante sur mesure
              <select value={customRoleId} onChange={e => setCustomRoleId(e.target.value)} className="mt-1 h-10 w-full rounded-control border border-gray-200 bg-white px-3 text-sm font-normal text-ink">
                <option value="">{ACCESS_ROLES[role].label} (standard)</option>
                {customs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Périmètre</p>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'REGIONS', 'SITES'] as const).filter(s => !(team.me.scoped && s === 'ALL') && !(s === 'REGIONS' && !team.regions.length)).map(s => (
              <button key={s} onClick={() => setScope(s)} aria-pressed={scope === s} className={cn('rounded-xl border px-3 py-1.5 text-sm font-semibold', scope === s ? 'border-ink bg-ink text-white' : 'border-surface-line text-ink-muted')}>
                {s === 'ALL' ? 'Tout l’établissement' : s === 'REGIONS' ? 'Des régions' : 'Des sites'}
              </button>
            ))}
          </div>
          {scope === 'SITES' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {team.sites.map(s => (
                <button key={s.id} onClick={() => setSiteIds(l => toggle(l, s.id))} aria-pressed={siteIds.includes(s.id)}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold', siteIds.includes(s.id) ? 'border-brand bg-brand text-white' : 'border-surface-line text-ink-muted')}>
                  {siteIds.includes(s.id) && <Check size={12} />}{s.name}
                </button>
              ))}
            </div>
          )}
          {scope === 'REGIONS' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {team.regions.map(r => (
                <button key={r.id} onClick={() => setRegionIds(l => toggle(l, r.id))} aria-pressed={regionIds.includes(r.id)}
                  className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold', regionIds.includes(r.id) ? 'border-brand bg-brand text-white' : 'border-surface-line text-ink-muted')}>
                  {regionIds.includes(r.id) && <Check size={12} />}{r.name} · {r.sites} site{r.sites > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-surface-sunken p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={temporary} onChange={e => setTemporary(e.target.checked)} className="h-4 w-4 accent-[#c2410c]" /> Accès temporaire (intérim, stage)
          </label>
          {temporary && (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-muted">Coupé automatiquement le
              <input type="date" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={e => setExpiresAt(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-ink" />
            </label>
          )}
        </div>

        {ACCESS_ROLES[role].sensitive && <p className="flex items-start gap-2 text-xs text-ink-muted"><ShieldCheck size={14} className="mt-px shrink-0 text-brand" /> Ce rôle donne accès à des données sensibles : la double authentification lui sera demandée.</p>}
        <Button fullWidth loading={busy} disabled={!member && (!name.trim() || !email.trim())} onClick={save}>{member ? 'Enregistrer l’accès' : 'Ajouter et créer le compte'}</Button>
      </div>
    </Dialog>
  )
}

function RolesTab({ team, run }: { team: Team; run: (p: Promise<{ success: boolean; error?: string }>, ok: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<{ id?: string; name: string; baseRole: AccessRole; permissions: Permission[] } | null>(null)
  const roles = ROLE_ORDER
  return (
    <section className="space-y-4">
      <div className="overflow-x-auto rounded-card border border-surface-line bg-white shadow-card">
        <table className="w-full min-w-[860px] text-xs">
          <thead>
            <tr className="border-b border-surface-line">
              <th scope="col" className="sticky left-0 bg-white px-4 py-3 text-left font-semibold text-ink-muted">Droit</th>
              {roles.map(r => <th key={r} scope="col" className="w-20 px-1 py-3 text-center font-semibold text-ink">{ACCESS_ROLES[r].label}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map(g => (
              <FragmentRows key={g.module} module={g.module} items={g.items} roles={roles} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-card border border-surface-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">Rôles sur mesure</h3>
            <p className="text-xs text-ink-muted">Partez d’un rôle et retirez des droits (ex. « Accueil sans export »).</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setEditing({ name: '', baseRole: 'RECEPTION', permissions: ACCESS_ROLES.RECEPTION.permissions })}>Créer un rôle</Button>
        </div>
        <ul className="mt-3 divide-y divide-surface-line">
          {team.customRoles.length === 0 && <li className="py-4 text-sm text-ink-subtle">Aucun rôle sur mesure.</li>}
          {team.customRoles.map(r => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <span><strong className="text-ink">{r.name}</strong> <span className="text-ink-muted">· à partir de {ACCESS_ROLES[r.baseRole as AccessRole]?.label} · {r.permissions.length} droits</span></span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, baseRole: r.baseRole as AccessRole, permissions: r.permissions as Permission[] })}>Modifier</Button>
                <button aria-label={`Supprimer ${r.name}`} onClick={() => run(deleteCustomRole(r.id), 'Rôle supprimé')} className="rounded-lg p-2 text-ink-subtle hover:text-danger"><Trash2 size={14} /></button>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? 'Modifier le rôle' : 'Nouveau rôle sur mesure'} size="lg">
          <div className="space-y-4">
            <TextInput label="Nom" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ex. Accueil sans export" />
            {!editing.id && (
              <label className="block text-xs font-semibold text-ink-muted">À partir du rôle
                <select value={editing.baseRole} onChange={e => { const b = e.target.value as AccessRole; setEditing({ ...editing, baseRole: b, permissions: ACCESS_ROLES[b].permissions }) }} className="mt-1 h-10 w-full rounded-control border border-gray-200 bg-white px-3 text-sm font-normal text-ink">
                  {ROLE_ORDER.filter(r => r !== 'OWNER').map(r => <option key={r} value={r}>{ACCESS_ROLES[r].label}</option>)}
                </select>
              </label>
            )}
            <div className="space-y-3">
              {PERMISSION_GROUPS.map(g => {
                const items = g.items.filter(i => ACCESS_ROLES[editing.baseRole].permissions.includes(i.id))
                if (!items.length) return null
                return (
                  <div key={g.module}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.module}</p>
                    {items.map(i => (
                      <label key={i.id} className="mt-1 flex items-center gap-2 text-sm text-ink">
                        <input type="checkbox" checked={editing.permissions.includes(i.id)} className="h-4 w-4 accent-[#c2410c]"
                          onChange={e => setEditing({ ...editing, permissions: e.target.checked ? [...editing.permissions, i.id] : editing.permissions.filter(p => p !== i.id) })} />
                        {i.label}
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
            <Button fullWidth disabled={!editing.name.trim()} onClick={async () => { if (await run(saveCustomRole(editing), 'Rôle enregistré')) setEditing(null) }}>Enregistrer</Button>
          </div>
        </Dialog>
      )}
    </section>
  )
}

function FragmentRows({ module, items, roles }: { module: string; items: { id: Permission; label: string }[]; roles: AccessRole[] }) {
  return (
    <>
      <tr className="bg-surface-sunken/70"><th colSpan={roles.length + 1} scope="colgroup" className="sticky left-0 px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{module}</th></tr>
      {items.map(i => (
        <tr key={i.id} className="border-b border-surface-line last:border-0">
          <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-normal text-ink">{i.label}</th>
          {roles.map(r => (
            <td key={r} className="px-1 py-2 text-center">
              {permissionsOf(r).includes(i.id) ? <Check size={14} className="mx-auto text-success" aria-label="oui" /> : <X size={12} className="mx-auto text-gray-300" aria-label="non" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function RegionsTab({ team, run }: { team: Team; run: (p: Promise<{ success: boolean; error?: string }>, ok: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState<{ id?: string; name: string; siteIds: string[] } | null>(null)
  const unassigned = useMemo(() => team.sites.filter(s => !s.regionId), [team.sites])
  if (team.me.scoped) return <p className="rounded-card bg-white p-6 text-sm text-ink-muted shadow-card">Les régions sont gérées par la direction de l’établissement.</p>
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">Regroupez vos sites par région pour confier une région à un directeur régional.{unassigned.length ? ` ${unassigned.length} site${unassigned.length > 1 ? 's' : ''} sans région.` : ''}</p>
        <Button size="sm" onClick={() => setEditing({ name: '', siteIds: [] })}>Nouvelle région</Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {team.regions.length === 0 && <li className="rounded-card border border-dashed border-gray-300 p-6 text-center text-sm text-ink-subtle sm:col-span-2">Aucune région. Utile à partir de plusieurs sites.</li>}
        {team.regions.map(r => (
          <li key={r.id} className="rounded-card border border-surface-line bg-white p-4 shadow-card">
            <p className="flex items-center justify-between font-semibold text-ink">{r.name}
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, name: r.name, siteIds: team.sites.filter(s => s.regionId === r.id).map(s => s.id) })}>Modifier</Button>
                <button aria-label={`Supprimer la région ${r.name}`} onClick={() => run(deleteRegion(r.id), 'Région supprimée')} className="rounded-lg p-2 text-ink-subtle hover:text-danger"><Trash2 size={14} /></button>
              </span>
            </p>
            <p className="mt-1 text-xs text-ink-muted">{team.sites.filter(s => s.regionId === r.id).map(s => s.name).join(', ') || 'Aucun site'}</p>
          </li>
        ))}
      </ul>
      {editing && (
        <Dialog open onClose={() => setEditing(null)} title={editing.id ? 'Modifier la région' : 'Nouvelle région'}>
          <div className="space-y-4">
            <TextInput label="Nom" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Ex. Abidjan Nord" />
            <div className="flex flex-wrap gap-2">
              {team.sites.map(s => {
                const on = editing.siteIds.includes(s.id)
                return (
                  <button key={s.id} onClick={() => setEditing({ ...editing, siteIds: on ? editing.siteIds.filter(x => x !== s.id) : [...editing.siteIds, s.id] })} aria-pressed={on}
                    className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold', on ? 'border-brand bg-brand text-white' : 'border-surface-line text-ink-muted')}>
                    {on && <Check size={12} />}{s.name}
                  </button>
                )
              })}
            </div>
            <Button fullWidth disabled={!editing.name.trim()} onClick={async () => { if (await run(saveRegion(editing), 'Région enregistrée')) setEditing(null) }}>Enregistrer</Button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
