// Modèles WhatsApp à faire valider par Meta (hors de la fenêtre de 24 h ouverte par un message du visiteur,
// WhatsApp n'accepte que des modèles approuvés). Utilisable côté navigateur (console) et serveur (envoi).
// Chaque modèle a deux paramètres : {{1}} = nom de l'établissement, {{2}} = le message.

export interface WhatsAppTemplateDef {
  name: string
  category: 'UTILITY' | 'MARKETING'
  label: string
  purposes: string[]
  body: string
  sample: [string, string]
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplateDef[] = [
  {
    name: 'lerena_rendez_vous', category: 'UTILITY', label: 'Rendez-vous (confirmation, rappel, annulation, absence)',
    purposes: ['APPOINTMENT_CONFIRMED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_MISSED'],
    body: 'Message de {{1}} au sujet de votre rendez-vous : {{2}}\n\nRépondez MENU pour voir ou annuler votre rendez-vous.',
    sample: ['Hôpital Mère-Enfant', 'rappel de votre rendez-vous demain à 09:30 (Consultation).']
  },
  {
    name: 'lerena_tour_proche', category: 'UTILITY', label: 'Ticket bientôt appelé',
    purposes: ['TURN_SOON'],
    body: '{{1}} : votre tour approche. {{2}}\n\nMerci de vous rapprocher du guichet.',
    sample: ['Hôpital Mère-Enfant', 'Ticket A012, encore 2 personnes avant vous.']
  },
  {
    name: 'lerena_suivi', category: 'UTILITY', label: 'Suivi, réponse de l’équipe, achat',
    purposes: ['FOLLOW_UP', 'DIRECT', 'COMPLAINT_REPLY', 'SHOP_ORDER', 'CONVERSATION'],
    body: 'Message de {{1}} : {{2}}\n\nVous pouvez répondre à ce message pour joindre l’accueil.',
    sample: ['Hôpital Mère-Enfant', 'vos résultats sont prêts, vous pouvez passer les retirer.']
  },
  {
    name: 'lerena_information', category: 'MARKETING', label: 'Campagnes et informations',
    purposes: ['CAMPAIGN', 'ANNOUNCEMENT'],
    body: 'Information de {{1}} : {{2}}\n\nRépondez STOP pour ne plus recevoir ces messages.',
    sample: ['Hôpital Mère-Enfant', 'campagne de vaccination gratuite du 12 au 16 novembre.']
  },
  {
    name: 'lerena_alerte', category: 'UTILITY', label: 'Alertes et rapports de l’équipe',
    purposes: ['ALERT', 'REPORT'],
    body: 'Lerena, {{1}} : {{2}}',
    sample: ['Hôpital Mère-Enfant', 'attente de 52 min au Siège Principal.']
  }
]

export const templateForPurpose = (purpose: string) => WHATSAPP_TEMPLATES.find(t => t.purposes.includes(purpose)) ?? null

/** Paramètre accepté par WhatsApp : sans retour à la ligne ni tabulation, ni plus de 4 espaces de suite, 1 024 caractères au plus. */
export const templateParam = (v: string) => v.replace(/[\r\n\t]+/g, ' · ').replace(/ {4,}/g, '   ').trim().slice(0, 1000) || '-'
