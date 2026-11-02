import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'État du service — Lerena' }

async function check<T>(fn: () => Promise<T>) {
  const t0 = Date.now()
  try { await fn(); return { ok: true, ms: Date.now() - t0 } } catch { return { ok: false, ms: Date.now() - t0 } }
}

/** Page publique d'état du service : à partager aux établissements en cas de doute sur une panne. */
export default async function StatusPage() {
  const db = await check(() => prisma.$queryRaw`SELECT 1`)
  const job = db.ok ? await prisma.jobRun.findUnique({ where: { id: 'appointments' }, select: { lastRunAt: true } }).catch(() => null) : null
  const jobsOk = !!job && job.lastRunAt > new Date(Date.now() - 26 * 3600_000)
  const components = [
    { name: 'Application et prise de tickets', ok: db.ok, detail: db.ok ? 'Opérationnel' : 'Indisponible' },
    { name: 'Base de données', ok: db.ok, detail: db.ok ? `Réponse en ${db.ms} ms` : 'Ne répond pas' },
    { name: 'Écrans en temps réel', ok: !!process.env.NEXT_PUBLIC_SUPABASE_URL, detail: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Opérationnel' : 'Mode dégradé (actualisation périodique)' },
    { name: 'Rappels et tâches automatiques', ok: jobsOk, detail: job ? `Dernier passage le ${job.lastRunAt.toLocaleString('fr-FR', { timeZone: 'UTC' })} (UTC)` : 'En attente' }
  ]
  const allOk = components.every(c => c.ok)

  return (
    <main className="min-h-screen bg-surface-sunken px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"><ArrowLeft size={15} /> Lerena</Link>
        <div className={`animate-pop-in rounded-card p-6 text-center shadow-card ${allOk ? 'bg-success-soft text-success-ink' : 'bg-warning-soft text-warning-ink'}`}>
          {allOk ? <CheckCircle2 size={40} className="mx-auto" /> : <AlertTriangle size={40} className="mx-auto" />}
          <h1 className="mt-2 text-xl font-bold">{allOk ? 'Tous les services fonctionnent' : 'Service perturbé'}</h1>
          <p className="mt-1 text-sm opacity-80">Vérifié le {new Date().toLocaleString('fr-FR', { timeZone: 'UTC' })} (UTC)</p>
        </div>
        <ul className="stagger divide-y divide-surface-line overflow-hidden rounded-card border border-surface-line bg-white shadow-card">
          {components.map(c => (
            <li key={c.name} className="flex items-center gap-3 px-5 py-3.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? 'bg-success' : 'bg-warning animate-pulse'}`} aria-hidden="true" />
              <span className="flex-1 text-sm font-medium text-ink">{c.name}</span>
              <span className="text-xs text-ink-muted">{c.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
