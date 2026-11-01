import { runAppointmentJobs } from '@/lib/appointments'

// Tâche planifiée (Vercel Cron) : rappels de rendez-vous et absences.
// Les mêmes tâches tournent aussi au fil de l'activité (au plus toutes les 5 minutes).
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Non autorisé', { status: 401 })
  const result = await runAppointmentJobs(true)
  return Response.json(result)
}
