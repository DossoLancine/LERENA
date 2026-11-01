import Link from 'next/link'
import { getAuditLog } from '@/server/actions/admin'
import { Card, CardHeader, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

// Libellés lisibles des actions enregistrées (une action inconnue s'affiche telle quelle)
const LABELS: Record<string, string> = {
  ORG_CREATED: 'Établissement mis en service',
  SITE_CREATED: 'Site créé par le réseau',
  ORG_NETWORK_CHANGED: 'Réseau modifié',
  NETWORK_CREATED: 'Réseau créé',
  MEMBER_ADDED: 'Membre ajouté',
  MEMBER_REMOVED: 'Membre retiré',
  TEMPLATE_APPLIED: 'Services du secteur appliqués',
  SECTOR_CREATED: 'Secteur créé',
  SECTOR_UPDATED: 'Secteur modifié',
  PLATFORM_SETTINGS_UPDATED: 'Réglages de la plateforme',
  QUEUE_RESET: 'File remise à zéro',
  DATA_EXPORTED: 'Données exportées',
  DEVICE_PAIRED: 'Appareil appairé'
}

export default async function AdminAuditPage({ searchParams }: { searchParams: { page?: string; action?: string } }) {
  const log = await getAuditLog(Number(searchParams.page) || 1, searchParams.action || undefined)
  if (!log) return null
  const href = (page: number) => `/admin/audit?page=${page}${searchParams.action ? `&action=${encodeURIComponent(searchParams.action)}` : ''}`

  return (
    <Card>
      <CardHeader
        title="Journal d’audit"
        subtitle={`${log.total.toLocaleString('fr-FR')} action${log.total > 1 ? 's' : ''} sensible${log.total > 1 ? 's' : ''} enregistrée${log.total > 1 ? 's' : ''}`}
        action={
          <form className="flex items-center gap-2">
            <label htmlFor="action" className="sr-only">Filtrer par action</label>
            <select id="action" name="action" defaultValue={searchParams.action ?? ''} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-ink">
              <option value="">Toutes les actions</option>
              {log.actions.map(a => <option key={a} value={a}>{LABELS[a] ?? a}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white">Filtrer</button>
          </form>
        }
      />
      {log.rows.length === 0 ? (
        <EmptyState title="Aucune action enregistrée" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Date</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Action</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Par</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Établissement</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {log.rows.map(r => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-5 py-2.5 tabular-nums text-ink-muted">{new Date(r.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-3 py-2.5 font-medium text-ink">{LABELS[r.action] ?? r.action}</td>
                  <td className="px-3 py-2.5 text-ink">{r.actorName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-ink">{r.orgName ?? '—'}</td>
                  <td className="px-5 py-2.5 text-ink-muted">{r.details ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {log.pages > 1 && (
        <nav aria-label="Pages du journal" className="flex items-center justify-between px-5 py-3 text-sm">
          {log.page > 1 ? <Link href={href(log.page - 1)} className="font-semibold text-brand">← Plus récentes</Link> : <span />}
          <span className="text-ink-muted">Page {log.page} / {log.pages}</span>
          {log.page < log.pages ? <Link href={href(log.page + 1)} className="font-semibold text-brand">Plus anciennes →</Link> : <span />}
        </nav>
      )}
    </Card>
  )
}
