// Libellés et format du modèle économique, utilisables côté navigateur (sans accès à la base)

export const FEATURES = {
  TV: 'Écran d’appel (TV)',
  KIOSK: 'Borne de tickets',
  APPOINTMENTS: 'Prise de rendez-vous',
  SMS_ALERTS: 'Alertes SMS aux visiteurs',
  ANALYTICS: 'Statistiques avancées',
  TV_ADS: 'Annonces sur les écrans',
  MULTI_SITE: 'Plusieurs sites',
  NETWORK: 'Espace réseau (siège)',
  BRANDING: 'Couleurs et logo personnalisés',
  PRIORITY_SUPPORT: 'Support prioritaire'
} as const
export type Feature = keyof typeof FEATURES

export const PRODUCT_KINDS = { SMS_PACK: 'Pack SMS', FEATURED: 'Mise en avant', HARDWARE: 'Matériel', SETUP: 'Installation et formation', OTHER: 'Autre' } as const
export const PAYMENT_METHODS = {
  ORANGE_MONEY: 'Orange Money', MTN_MOMO: 'MTN Mobile Money', WAVE: 'Wave', MOOV_MONEY: 'Moov Money',
  BANK_TRANSFER: 'Virement bancaire', CHEQUE: 'Chèque', CASH: 'Espèces'
} as const

export const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ')} FCFA`

export const STATE_LABELS = {
  TRIAL: ['Essai', 'info'],
  ACTIVE: ['Actif', 'success'],
  GRACE: ['Paiement en retard', 'warning'],
  SUSPENDED: ['Suspendu', 'danger'],
  CANCELLED: ['Résilié', 'neutral']
} as const

export const INVOICE_STATUS = {
  DRAFT: ['Brouillon', 'neutral'],
  SENT: ['À payer', 'warning'],
  PAID: ['Payée', 'success'],
  VOID: ['Annulée', 'neutral']
} as const
