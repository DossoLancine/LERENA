import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { getErrorEvents, getPlatformHealth } from '@/server/actions/admin'
import { PageHeader } from '@/components/billing/badges'
import { ErrorsCard } from './errors-card'
import { Card, CardHeader, StatCard } from '@/components/ui'

export const dynamic = 'force-dynamic'

// État de la plateforme au moment de l'ouverture de la page
export default async function AdminHealthPage() {
  const [health, errors] = await Promise.all([getPlatformHealth(), getErrorEvents()])
  if (!health || !errors) return null
  const c = health.counts

  return (
    <>
      <PageHeader title="Santé de la plateforme" subtitle="Services, erreurs et activité. Sonde publique pour la surveillance externe : /api/health" />
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Établissements" value={c.orgs} />
        <StatCard label="Comptes" value={c.users.toLocaleString('fr-FR')} />
        <StatCard label="Tickets aujourd’hui" value={c.ticketsToday.toLocaleString('fr-FR')} />
        <StatCard label="Tickets en cours" value={c.activeTickets} />
        <StatCard label="Écrans et bornes en ligne" value={`${c.devicesOnline}/${c.devices}`} />
      </div>

      <Card>
        <CardHeader title="Services" subtitle={`Vérifié le ${new Date(health.checkedAt).toLocaleString('fr-FR')}`} />
        <ul className="stagger divide-y divide-surface-line">
          {health.services.map(s => (
            <li key={s.name} className="flex items-center gap-3 px-5 py-3">
              {s.ok
                ? <CheckCircle2 size={20} className="shrink-0 text-success" aria-hidden="true" />
                : <AlertTriangle size={20} className="shrink-0 text-warning" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-ink-muted">{s.detail}</p>
              </div>
              <span className={s.ok ? 'text-sm font-semibold text-success-ink' : 'text-sm font-semibold text-warning-ink'}>
                {s.ok ? 'Opérationnel' : 'Non configuré'}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <ErrorsCard events={errors} />
    </>
  )
}
