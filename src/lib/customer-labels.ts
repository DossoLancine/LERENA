// Libellés du CRM visiteurs, partagés entre le serveur et les écrans.

export const TAG_COLORS = ['#c2410c', '#b45309', '#15803d', '#0f766e', '#1d4ed8', '#7c3aed', '#be185d', '#475569'] as const

export const SEGMENT_LABELS = {
  all: { label: 'Tous', hint: 'Tous les visiteurs connus' },
  new: { label: 'Nouveaux', hint: 'Premier passage il y a moins de 30 jours' },
  regular: { label: 'Habitués', hint: '3 passages et plus' },
  lapsed: { label: 'À relancer', hint: 'Pas revenus depuis 90 jours' },
  noshow: { label: 'Absents répétés', hint: '2 absences et plus' },
  unhappy: { label: 'Mécontents', hint: 'Dernière note de 2 étoiles ou moins' }
} as const

export const SOURCE_LABELS: Record<string, string> = { APP: 'application', GUEST: 'en ligne', RECEPTION: 'accueil' }

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmé', COMPLETED: 'Honoré', CANCELLED: 'Annulé', NO_SHOW: 'Absent'
}
