import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Building2, CalendarClock, Coins, Receipt, TrendingUp, Users, Wallet } from 'lucide-react'
import { getAdminOverview } from '@/server/actions/billing-admin'
import { Card, CardHeader, StatCard } from '@/components/ui'
import { PageHeader } from '@/components/billing/badges'
import { BarChart, Sparkline } from '@/components/charts/bar-chart'
import { fcfa } from '@/lib/billing-labels'

export const dynamic = 'force-dynamic'

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Tableau de bord de la startup : revenu récurrent, clients, encaissements et points d'attention. */
export default async function AdminOverviewPage() {
  const d = await getAdminOverview()
  if (!d) return null
  const totalActivity = d.activity.reduce((s, a) => s + a.n, 0)

  return (
    <div className="space-y-5">
      <PageHeader title="Vue d’ensemble" subtitle="Revenu, clients et activité de la plateforme"
        actions={<Link href="/admin/clients" className="inline-flex items-center gap-1.5 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600">Clients <ArrowUpRight size={15} /></Link>} />

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<TrendingUp size={18} className="text-brand" />} label="Revenu mensuel récurrent (HT)" value={fcfa(d.mrr)} hint={`${fcfa(d.arr)} / an`} />
        <StatCard icon={<Building2 size={18} className="text-brand" />} label="Clients payants" value={d.counts.ACTIVE + d.counts.GRACE} hint={`${d.counts.TRIAL} en essai`} />
        <StatCard icon={<Wallet size={18} className="text-brand" />} label="Encaissé ce mois-ci" value={fcfa(d.cashThisMonth)} hint={`panier moyen ${fcfa(d.arpa)}`} />
        <StatCard icon={<Receipt size={18} className="text-brand" />} label="Reste à encaisser" value={fcfa(d.unpaidTotal)} hint={d.overdueTotal ? `${fcfa(d.overdueTotal)} en retard` : 'aucun retard'} hintTone={d.overdueTotal ? 'bad' : 'good'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Encaissements" subtitle="12 derniers mois, paiements enregistrés" />
          <div className="p-5">
            <BarChart label="Encaissements par mois" data={d.months.map(m => ({ label: m.label, value: m.cash, hint: m.newClients ? `${m.newClients} nouveau${m.newClients > 1 ? 'x' : ''} client${m.newClients > 1 ? 's' : ''}` : undefined }))} unit="fcfa" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Clients par état" subtitle={`${d.clients} établissements`} />
          <ul className="space-y-3 p-5 text-sm">
            {([['ACTIVE', 'Actifs', 'bg-success'], ['TRIAL', 'En essai', 'bg-info'], ['GRACE', 'Paiement en retard', 'bg-warning'], ['SUSPENDED', 'Suspendus', 'bg-danger'], ['CANCELLED', 'Résiliés', 'bg-gray-400']] as const).map(([key, label, color]) => (
              <li key={key}>
                <div className="mb-1 flex justify-between"><span className="text-ink-muted">{label}</span><span className="font-semibold tabular-nums text-ink">{d.counts[key]}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${color} transition-[width] duration-700`} style={{ width: `${d.clients ? Math.max(d.counts[key] ? 3 : 0, (d.counts[key] / d.clients) * 100) : 0}%` }} /></div>
              </li>
            ))}
          </ul>
          {d.byPlan.length > 0 && (
            <div className="border-t border-surface-line p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Par forfait</p>
              <ul className="space-y-1.5 text-sm">
                {d.byPlan.map(p => <li key={p.name} className="flex justify-between gap-2"><span className="text-ink">{p.name} <span className="text-ink-subtle">· {p.clients}</span></span><span className="tabular-nums text-ink-muted">{fcfa(p.mrr)}/mois</span></li>)}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-danger" /> Factures en retard</span>} action={<Link href="/admin/invoices?status=OVERDUE" className="text-xs font-semibold text-brand">Tout voir</Link>} />
          {d.overdue.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Aucune facture en retard.</p> : (
            <ul className="divide-y divide-surface-line">
              {d.overdue.map(i => (
                <li key={i.id}><Link href={`/admin/invoices/${i.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="min-w-0"><span className="block truncate font-medium text-ink">{i.org.name}</span><span className="text-xs text-ink-subtle">{i.number} · échue le {date(i.dueAt)}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums text-danger">{fcfa(i.due)}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CalendarClock size={16} className="text-info" /> Essais qui se terminent</span>} subtitle="7 prochains jours" />
          {d.trialsEnding.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Aucun essai ne se termine cette semaine.</p> : (
            <ul className="divide-y divide-surface-line">
              {d.trialsEnding.map(t => (
                <li key={t.id}><Link href={`/admin/clients/${t.id}`} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm hover:bg-gray-50">
                  <span className="truncate font-medium text-ink">{t.name}</span>
                  <span className="shrink-0 text-xs font-semibold text-info-ink">{t.daysLeft <= 0 ? 'aujourd’hui' : `dans ${t.daysLeft} j`}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Coins size={16} className="text-success" /> Derniers paiements</span>} />
          {d.recentPayments.length === 0 ? <p className="p-5 text-sm text-ink-subtle">Aucun paiement enregistré pour l’instant.</p> : (
            <ul className="divide-y divide-surface-line">
              {d.recentPayments.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium text-ink">{p.org.name}</span><span className="text-xs text-ink-subtle">{date(p.receivedAt)} · {p.method}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums text-success-ink">+{fcfa(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Activité de la plateforme" subtitle={`${totalActivity.toLocaleString('fr-FR')} tickets sur 30 jours · ${d.users.toLocaleString('fr-FR')} comptes`} action={<Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Users size={14} /> Utilisateurs</Link>} />
        <div className="px-5 pb-4 pt-3"><Sparkline values={d.activity.map(a => a.n)} label={`Tickets par jour sur 30 jours, ${totalActivity} au total`} /></div>
      </Card>
    </div>
  )
}
