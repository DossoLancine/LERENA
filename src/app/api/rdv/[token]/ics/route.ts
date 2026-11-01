import { getAppointmentByToken } from '@/server/actions/appointments'

// Fichier calendrier (.ics) du rendez-vous : s'ajoute à Google Agenda, Outlook ou l'agenda du téléphone
export const dynamic = 'force-dynamic'

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const esc = (s: string) => s.replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n')

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const appt = await getAppointmentByToken(params.token)
  if (!appt || appt.status !== 'CONFIRMED') return new Response('Rendez-vous introuvable', { status: 404 })
  const start = new Date(appt.scheduledDate)
  const end = new Date(start.getTime() + 30 * 60_000)
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ATTENDS//RDV//FR', 'BEGIN:VEVENT',
    `UID:${stamp(start)}-${appt.code ?? 'rdv'}@attends`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${appt.serviceName} — ${appt.orgName}`)}`,
    `LOCATION:${esc([appt.siteName, appt.address].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc(`Code d'arrivée : ${appt.code ?? ''}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous dans 1 heure', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n')
  return new Response(body, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="rendez-vous.ics"', 'Cache-Control': 'no-store' }
  })
}
