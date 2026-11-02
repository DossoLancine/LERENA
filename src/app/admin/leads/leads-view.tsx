'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Inbox, Mail, MapPin, Phone, Plus } from 'lucide-react'
import { updateLead, type getLeads } from '@/server/actions/leads'
import { Card, EmptyState, useToast } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'
import { cn } from '@/lib/cn'

type Lead = NonNullable<Awaited<ReturnType<typeof getLeads>>>[number]
const STATUS = {
  NEW: ['Nouveau', 'bg-info-soft text-info-ink'],
  CONTACTED: ['Contacté', 'bg-gray-100 text-ink'],
  DEMO: ['Démo prévue', 'bg-warning-soft text-warning-ink'],
  WON: ['Gagné', 'bg-success-soft text-success-ink'],
  LOST: ['Perdu', 'bg-danger-soft text-danger-ink']
} as const
type Status = keyof typeof STATUS

/** Prospects venus de la page Tarifs : suivi du premier appel jusqu'à la mise en service. */
export function LeadsView({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const toast = useToast()
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL')
  const counts = useMemo(() => leads.reduce<Record<string, number>>((c, l) => ({ ...c, [l.status]: (c[l.status] ?? 0) + 1 }), {}), [leads])
  const shown = filter === 'ALL' ? leads : leads.filter(l => l.status === filter)

  const save = async (id: string, data: { status?: string; notes?: string }, ok?: string) => {
    const res = await updateLead(id, data)
    if (!res.success) return toast(res.error, 'error')
    if (ok) toast(ok)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Prospects" subtitle="Demandes de démonstration envoyées depuis la page publique /tarifs"
        actions={<Link href="/tarifs" target="_blank" className="text-sm font-semibold text-brand">Voir la page Tarifs</Link>} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par étape">
        {(['ALL', 'NEW', 'CONTACTED', 'DEMO', 'WON', 'LOST'] as const).map(f => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
            className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-all', filter === f ? 'bg-ink text-white' : 'bg-white text-ink-muted ring-1 ring-surface-line hover:text-ink')}>
            {f === 'ALL' ? 'Tous' : STATUS[f][0]} <span className="opacity-60">{f === 'ALL' ? leads.length : counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card><EmptyState icon={<Inbox size={40} />} title="Aucun prospect" description="Les demandes de démonstration arriveront ici, avec un e-mail à chaque nouvelle demande." /></Card>
      ) : (
        <div className="stagger grid gap-3 lg:grid-cols-2">
          {shown.map(l => (
            <Card key={l.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-ink"><Building2 size={16} className="shrink-0 text-brand" /><span className="truncate">{l.organization}</span></p>
                  <p className="text-sm text-ink-muted">{l.contactName}{l.sector ? ` · ${l.sector}` : ''}{l.sites ? ` · ${l.sites} site${l.sites > 1 ? 's' : ''}` : ''}</p>
                </div>
                <label className="sr-only" htmlFor={`st-${l.id}`}>Étape</label>
                <select id={`st-${l.id}`} value={l.status} onChange={e => save(l.id, { status: e.target.value }, 'Étape mise à jour')}
                  className={cn('shrink-0 rounded-full border-0 px-3 py-1 text-xs font-semibold', STATUS[l.status as Status]?.[1])}>
                  {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1.5 font-medium text-brand"><Phone size={14} />{l.phone}</a>
                {l.email && <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"><Mail size={14} />{l.email}</a>}
                {l.city && <span className="inline-flex items-center gap-1.5 text-ink-muted"><MapPin size={14} />{l.city}</span>}
              </div>
              {l.message && <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-ink">{l.message}</p>}
              <label className="mt-3 block">
                <span className="sr-only">Notes internes</span>
                <textarea defaultValue={l.notes ?? ''} rows={2} placeholder="Notes : appel, démo, objections…" onBlur={e => e.target.value !== (l.notes ?? '') && save(l.id, { notes: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-ink" />
              </label>
              <div className="mt-2 flex items-center justify-between text-xs text-ink-subtle">
                <span>Reçu le {new Date(l.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                {l.status !== 'LOST' && <Link href="/admin/clients" className="inline-flex items-center gap-1 font-semibold text-brand"><Plus size={13} /> Mettre en service</Link>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
