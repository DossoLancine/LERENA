'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Check, ChevronDown, Monitor, Server } from 'lucide-react'
import { resolveErrorEvent, type getErrorEvents } from '@/server/actions/admin'
import { Badge, Card, CardHeader, EmptyState, useToast } from '@/components/ui'
import { cn } from '@/lib/cn'

type Event = NonNullable<Awaited<ReturnType<typeof getErrorEvents>>>[number]
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`
}

/** Erreurs regroupées du serveur et des navigateurs, à marquer « réglé » une fois corrigées. */
export function ErrorsCard({ events }: { events: Event[] }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)

  const resolve = async (id: string) => {
    const res = await resolveErrorEvent(id)
    if (!res.success) return toast(res.error, 'error')
    toast('Marquée comme réglée')
    router.refresh()
  }

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Bug size={16} className="text-danger" /> Erreurs ouvertes ({events.length})</span>}
        subtitle="Serveur et navigateurs, regroupées ; un e-mail part à la première apparition" />
      {events.length === 0 ? <EmptyState icon={<Check size={36} />} title="Aucune erreur ouverte" description="Tout fonctionne normalement." /> : (
        <ul className="divide-y divide-surface-line">
          {events.map(e => (
            <li key={e.id} className="px-5 py-3">
              <div className="flex items-start gap-3">
                {e.source === 'SERVER' ? <Server size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-label="Serveur" /> : <Monitor size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-label="Navigateur" />}
                <button type="button" onClick={() => setOpen(o => (o === e.id ? null : e.id))} aria-expanded={open === e.id} className="min-w-0 flex-1 text-left">
                  <p className="line-clamp-2 break-words text-sm font-medium text-ink">{e.message}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">{e.path ? `${e.path} · ` : ''}vu {ago(e.lastSeen)} · première fois {ago(e.firstSeen)}</p>
                </button>
                <Badge tone={e.count >= 10 ? 'danger' : 'warning'}>×{e.count}</Badge>
                <ChevronDown size={16} className={cn('mt-0.5 shrink-0 text-ink-subtle transition-transform', open === e.id && 'rotate-180')} aria-hidden="true" />
                <button type="button" onClick={() => resolve(e.id)} className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-ink hover:bg-success-soft hover:text-success-ink">Réglé</button>
              </div>
              {open === e.id && e.stack && <pre className="mt-2 max-h-60 animate-rise-in overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] leading-relaxed text-gray-200">{e.stack}</pre>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
