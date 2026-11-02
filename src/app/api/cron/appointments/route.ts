import { runAppointmentJobs } from '@/lib/appointments'
import { runBillingJobs } from '@/lib/billing'
import { runRetentionJobs } from '@/lib/retention'

// Tâche planifiée quotidienne (Vercel Cron) : rappels de rendez-vous, absences, clôture des tickets
// de la veille, factures de renouvellement des abonnements, purge et anonymisation (durées de conservation).
// Les tâches de rendez-vous tournent aussi au fil de l'activité (au plus toutes les 5 minutes).
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Non autorisé', { status: 401 })
  const [appointments, billing, retention] = await Promise.all([
    runAppointmentJobs(true),
    runBillingJobs().catch(e => ({ billingError: String(e) })),
    runRetentionJobs().catch(e => ({ retentionError: String(e) }))
  ])
  return Response.json({ ...appointments, ...billing, ...retention })
}
