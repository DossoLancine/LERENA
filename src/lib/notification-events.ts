// Catalogue des événements notifiés à l'équipe (cloche, push, e-mail, WhatsApp) avec les préréglages par rôle.
// Utilisable côté navigateur (page de réglages) comme côté serveur (envoi).

export type NotificationChannel = 'APP' | 'PUSH' | 'EMAIL' | 'WHATSAPP'
export type NotifiedRole = 'MANAGER' | 'RECEPTION' | 'AGENT' | 'SUPER_ADMIN'

export const CHANNEL_LABELS: Record<NotificationChannel, string> = { APP: 'Application', PUSH: 'Téléphone', EMAIL: 'E-mail', WHATSAPP: 'WhatsApp' }

export interface NotificationEvent {
  id: string
  label: string
  description: string
  /** Rôles qui peuvent recevoir cet événement. */
  roles: NotifiedRole[]
  /** Canaux activés par défaut, par rôle. L'application (cloche) est toujours incluse. */
  defaults: Partial<Record<NotifiedRole, NotificationChannel[]>>
  /** Urgent : envoyé même pendant les heures de silence. */
  urgent?: boolean
  /** Étape du plan où l'événement commence à être émis (pour l'affichage « bientôt »). */
  since?: string
}

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  { id: 'APPOINTMENT_NEW', label: 'Nouveau rendez-vous', description: 'Un visiteur réserve en ligne.', roles: ['MANAGER', 'RECEPTION'], defaults: { MANAGER: ['APP', 'PUSH', 'EMAIL'], RECEPTION: ['APP', 'PUSH'] } },
  { id: 'COMPLAINT_NEW', label: 'Avis négatif', description: 'Note de 2 étoiles ou moins, ou motif d’insatisfaction.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH', 'EMAIL'] } },
  { id: 'COMPLAINT_OVERDUE', label: 'Avis non traité sous 48 h', description: 'Un avis négatif attend toujours une réponse.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH', 'EMAIL'] } },
  { id: 'FOLLOWUP_DUE', label: 'Suivis du jour', description: 'Chaque matin, les suivis prévus ou en retard.', roles: ['MANAGER', 'RECEPTION'], defaults: { MANAGER: ['APP', 'PUSH'], RECEPTION: ['APP', 'PUSH'] } },
  { id: 'WAIT_HIGH', label: 'Attente trop longue', description: 'L’attente dépasse le seuil réglé sur un site.', roles: ['MANAGER', 'RECEPTION'], defaults: { MANAGER: ['APP', 'PUSH'], RECEPTION: ['APP', 'PUSH'] }, urgent: true, since: 'N4' },
  { id: 'QUEUE_LONG', label: 'File trop longue', description: 'Trop de personnes en attente sur un site.', roles: ['MANAGER', 'RECEPTION'], defaults: { MANAGER: ['APP', 'PUSH'], RECEPTION: ['APP', 'PUSH'] }, urgent: true, since: 'N4' },
  { id: 'SITE_NO_COUNTER', label: 'Site sans guichet actif', description: 'Site ouvert sans aucun guichet actif depuis 20 minutes.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH'] }, urgent: true, since: 'N4' },
  { id: 'ORDER_NEW', label: 'Nouvelle commande boutique', description: 'Un visiteur réserve un produit ou un service.', roles: ['MANAGER', 'RECEPTION', 'AGENT'], defaults: { MANAGER: ['APP'], RECEPTION: ['APP', 'PUSH'], AGENT: ['APP'] }, since: 'N7' },
  { id: 'CAMPAIGN_DONE', label: 'Campagne terminée', description: 'Tous les SMS d’une campagne sont partis.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH'] } },
  { id: 'SMS_LOW', label: 'SMS bientôt épuisés', description: 'Il reste moins de 20 SMS (quota du mois et packs).', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH', 'EMAIL'] } },
  { id: 'INVOICE_DUE', label: 'Facture à payer', description: 'Une facture de l’abonnement est émise.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'EMAIL'] } },
  { id: 'ACCESS_REVIEW', label: 'Revue des accès', description: 'Chaque mois, les comptes inactifs depuis 60 jours.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'EMAIL'] } },
  { id: 'REPORT_READY', label: 'Rapport prêt', description: 'Le rapport de la semaine ou du mois est disponible.', roles: ['MANAGER'], defaults: { MANAGER: ['APP', 'PUSH', 'EMAIL'] }, since: 'N4' },
  { id: 'LEAD_NEW', label: 'Nouveau prospect', description: 'Un établissement demande un pilote ou un devis.', roles: ['SUPER_ADMIN'], defaults: { SUPER_ADMIN: ['APP', 'PUSH', 'EMAIL'] } },
  { id: 'ERROR_SPIKE', label: 'Incident technique', description: 'Une erreur se répète dans l’application.', roles: ['SUPER_ADMIN'], defaults: { SUPER_ADMIN: ['APP', 'PUSH'] }, urgent: true }
]

export const eventDefinition = (id: string) => NOTIFICATION_EVENTS.find(e => e.id === id)

/** Événements proposés à un rôle, avec ses canaux par défaut. */
export const eventsForRole = (role: string) => NOTIFICATION_EVENTS.filter(e => e.roles.includes(role as NotifiedRole))

export function defaultChannels(eventId: string, role: string): NotificationChannel[] {
  const e = eventDefinition(eventId)
  return e?.defaults[role as NotifiedRole] ?? ['APP']
}

/** Heures de silence (heure d'Abidjan = UTC) : de quietFrom à quietTo, éventuellement à cheval sur minuit. */
export function inQuietHours(quietFrom: number | null | undefined, quietTo: number | null | undefined, now = new Date()) {
  if (quietFrom == null || quietTo == null || quietFrom === quietTo) return false
  const h = now.getUTCHours()
  return quietFrom < quietTo ? h >= quietFrom && h < quietTo : h >= quietFrom || h < quietTo
}
