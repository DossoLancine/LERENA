'use client'

import { useRouter } from 'next/navigation'
import { Printer } from 'lucide-react'
import type { getNetworkMonthlyReport } from '@/server/actions/network'
import { Button, Card, CardHeader, EmptyState } from '@/components/ui'

type Report = NonNullable<Awaited<ReturnType<typeof getNetworkMonthlyReport>>>

const fr = (n: number | null, suffix = '') => (n == null ? '—' : `${n.toLocaleString('fr-FR')}${suffix}`)
const rate = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : '—')

/** Rapport mensuel du réseau : un tableau par site, prêt à imprimer ou à enregistrer en PDF. */
export function ReportView({ report }: { report: Report }) {
  const router = useRouter()
  const t = report.totals

  return (
    <Card>
      <CardHeader
        title={`Rapport mensuel — ${report.label}`}
        subtitle={`${report.networkName} · ${report.rows.length} site${report.rows.length > 1 ? 's' : ''}`}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <label htmlFor="month" className="sr-only">Mois</label>
            <input id="month" type="month" value={report.month}
              onChange={e => e.target.value && router.push(`/org-admin/report?month=${e.target.value}`)}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-ink" />
            <Button size="sm" variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Imprimer</Button>
          </div>
        }
      />

      {report.rows.length === 0 ? (
        <EmptyState title="Aucun site dans ce réseau" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Indicateurs par site pour {report.label}</caption>
            <thead>
              <tr className="border-b border-surface-line text-left text-xs uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">Site</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Tickets</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Servis</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Absents</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Attente moy.</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Traitement moy.</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Satisfaction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-line">
              {report.rows.map(r => (
                <tr key={r.id}>
                  <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">{r.name}{r.city && <span className="block text-xs font-normal text-ink-muted">{r.city}</span>}</th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fr(r.tickets)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fr(r.served)} <span className="text-xs text-ink-muted">({rate(r.served, r.tickets)})</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fr(r.absent)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fr(r.avgWaitMin, ' min')}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fr(r.avgServiceMin, ' min')}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fr(r.satisfaction, ' / 5')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-line font-bold text-ink">
                <th scope="row" className="px-5 py-3 text-left">Total réseau</th>
                <td className="px-3 py-3 text-right tabular-nums">{fr(t.tickets)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fr(t.served)} <span className="text-xs font-normal text-ink-muted">({rate(t.served, t.tickets)})</span></td>
                <td className="px-3 py-3 text-right tabular-nums">{fr(t.absent)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fr(t.avgWaitMin, ' min')}</td>
                <td className="px-3 py-3 text-right tabular-nums">{fr(t.avgServiceMin, ' min')}</td>
                <td className="px-5 py-3 text-right tabular-nums">{fr(t.satisfaction, ' / 5')}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-xs text-ink-subtle">Attente : de la prise du ticket à l’appel. Traitement : du début à la fin du service. Satisfaction : moyenne des notes laissées par les clients.</p>
    </Card>
  )
}
