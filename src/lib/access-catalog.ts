// Rôles et droits de l'équipe d'un établissement. Utilisable côté navigateur (pages Équipe et Rôles) et serveur.
// Chaque rôle a une « classe d'accès » (écrans autorisés : tableau de bord, accueil, guichet) et une liste de droits.

export type Permission =
  | 'queue.serve' | 'queue.manage' | 'tickets.issue'
  | 'appointments.view' | 'appointments.book'
  | 'visitors.view' | 'visitors.edit' | 'visitors.export' | 'visitors.import'
  | 'campaigns.manage' | 'feedback.manage'
  | 'shop.manage' | 'shop.sell'
  | 'stats.view' | 'stats.export'
  | 'team.manage' | 'billing.view' | 'billing.manage' | 'settings.manage' | 'audit.view'

export const PERMISSION_GROUPS: { module: string; items: { id: Permission; label: string }[] }[] = [
  { module: 'File d’attente', items: [
    { id: 'queue.serve', label: 'Appeler et servir au guichet' },
    { id: 'tickets.issue', label: 'Émettre et corriger des tickets (accueil)' },
    { id: 'queue.manage', label: 'Ouvrir, fermer, remettre la file à zéro' }
  ] },
  { module: 'Rendez-vous', items: [
    { id: 'appointments.view', label: 'Voir l’agenda' },
    { id: 'appointments.book', label: 'Prendre, déplacer, annuler, accueillir' }
  ] },
  { module: 'Visiteurs', items: [
    { id: 'visitors.view', label: 'Voir les fiches, suivis et avis' },
    { id: 'visitors.edit', label: 'Modifier : notes, étiquettes, suivis, SMS' },
    { id: 'visitors.export', label: 'Exporter le fichier' },
    { id: 'visitors.import', label: 'Importer, fusionner les doublons' },
    { id: 'campaigns.manage', label: 'Campagnes SMS' },
    { id: 'feedback.manage', label: 'Traiter les avis négatifs' }
  ] },
  { module: 'Boutique', items: [
    { id: 'shop.sell', label: 'Encaisser, remettre, annuler une commande' },
    { id: 'shop.manage', label: 'Gérer le catalogue et les prix' }
  ] },
  { module: 'Pilotage', items: [
    { id: 'stats.view', label: 'Statistiques et rapports' },
    { id: 'stats.export', label: 'Exporter les statistiques' },
    { id: 'audit.view', label: 'Journal d’audit' }
  ] },
  { module: 'Administration', items: [
    { id: 'settings.manage', label: 'Services, guichets, sites, horaires, réglages' },
    { id: 'team.manage', label: 'Équipe et accès' },
    { id: 'billing.view', label: 'Voir l’abonnement et les factures' },
    { id: 'billing.manage', label: 'Changer de forfait, commander, payer' }
  ] }
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.id))

export type AccessRole = 'OWNER' | 'DG' | 'REGIONAL' | 'SITE_MANAGER' | 'RECEPTION' | 'AGENT' | 'CASHIER' | 'ACCOUNTANT' | 'AUDITOR'
export type AccessClass = 'MANAGER' | 'RECEPTION' | 'AGENT'
export type ScopeKind = 'ALL' | 'REGIONS' | 'SITES'

const MANAGE_SITE: Permission[] = [
  'queue.serve', 'queue.manage', 'tickets.issue', 'appointments.view', 'appointments.book',
  'visitors.view', 'visitors.edit', 'visitors.export', 'visitors.import', 'campaigns.manage', 'feedback.manage',
  'shop.manage', 'shop.sell', 'stats.view', 'stats.export', 'team.manage', 'settings.manage'
]

export const ACCESS_ROLES: Record<AccessRole, { label: string; description: string; accessClass: AccessClass; scope: ScopeKind; permissions: Permission[]; sensitive?: boolean }> = {
  OWNER: { label: 'Propriétaire', description: 'Tout, y compris abonnement, factures et transfert de propriété.', accessClass: 'MANAGER', scope: 'ALL', permissions: ALL_PERMISSIONS, sensitive: true },
  DG: { label: 'Directeur général', description: 'Tout voir et piloter sur tous les sites ; gère les responsables.', accessClass: 'MANAGER', scope: 'ALL', permissions: ALL_PERMISSIONS.filter(p => p !== 'billing.manage'), sensitive: true },
  REGIONAL: { label: 'Directeur régional', description: 'Pilote les sites de sa région.', accessClass: 'MANAGER', scope: 'REGIONS', permissions: MANAGE_SITE, sensitive: true },
  SITE_MANAGER: { label: 'Responsable de site', description: 'Gère son site : équipe, services, guichets, visiteurs, boutique.', accessClass: 'MANAGER', scope: 'SITES', permissions: MANAGE_SITE, sensitive: true },
  RECEPTION: { label: 'Accueil', description: 'Tickets, rendez-vous, fichier visiteurs, suivis, commandes.', accessClass: 'RECEPTION', scope: 'SITES', permissions: ['tickets.issue', 'appointments.view', 'appointments.book', 'visitors.view', 'visitors.edit', 'shop.sell'] },
  AGENT: { label: 'Agent de guichet', description: 'Appelle, sert ; voit les étiquettes et la commande du visiteur appelé.', accessClass: 'AGENT', scope: 'SITES', permissions: ['queue.serve', 'shop.sell'] },
  CASHIER: { label: 'Caissier ou vendeur', description: 'Commandes de la boutique : encaisser, remettre, annuler.', accessClass: 'RECEPTION', scope: 'SITES', permissions: ['shop.sell'] },
  ACCOUNTANT: { label: 'Comptable', description: 'Factures, ventes, statistiques ; aucune donnée de visiteur.', accessClass: 'MANAGER', scope: 'ALL', permissions: ['billing.view', 'billing.manage', 'stats.view', 'stats.export'] },
  AUDITOR: { label: 'Auditeur', description: 'Tout en lecture seule, journal d’audit compris.', accessClass: 'MANAGER', scope: 'ALL', permissions: ['appointments.view', 'visitors.view', 'stats.view', 'billing.view', 'audit.view'] }
}

export const ROLE_ORDER: AccessRole[] = ['OWNER', 'DG', 'REGIONAL', 'SITE_MANAGER', 'RECEPTION', 'AGENT', 'CASHIER', 'ACCOUNTANT', 'AUDITOR']
export const isAccessRole = (r: unknown): r is AccessRole => typeof r === 'string' && Object.prototype.hasOwnProperty.call(ACCESS_ROLES, r)

/** Rôle détaillé d'un membre, d'après son ancien rôle si besoin (comptes créés avant les rôles détaillés). */
export function effectiveRole(accessRole: string | null | undefined, legacyRole: string): AccessRole {
  if (isAccessRole(accessRole)) return accessRole
  return legacyRole === 'MANAGER' ? 'OWNER' : legacyRole === 'RECEPTION' ? 'RECEPTION' : 'AGENT'
}

/** Droits d'un membre : ceux du rôle sur mesure s'il en a un (bornés à son rôle de base), sinon ceux du rôle. */
export function permissionsOf(role: AccessRole, custom?: { baseRole: string; permissions: string[] } | null): Permission[] {
  if (custom && isAccessRole(custom.baseRole)) {
    const base = new Set(ACCESS_ROLES[custom.baseRole].permissions)
    return custom.permissions.filter((p): p is Permission => base.has(p as Permission))
  }
  return ACCESS_ROLES[role].permissions
}

/** Lecture seule : aucun droit de modification. */
export const isReadOnly = (perms: Permission[]) => perms.every(p => ['appointments.view', 'visitors.view', 'stats.view', 'billing.view', 'audit.view', 'stats.export'].includes(p))

/** Droit demandé par chaque entrée du menu du tableau de bord (absent = visible pour tous). */
export const MENU_PERMISSIONS: Record<string, Permission> = {
  '/dashboard/agenda': 'appointments.view',
  '/dashboard/visitors': 'visitors.view',
  '/dashboard/followups': 'visitors.view',
  '/dashboard/campaigns': 'campaigns.manage',
  '/dashboard/feedback': 'visitors.view',
  '/dashboard/analytics': 'stats.view',
  '/dashboard/reports': 'stats.view',
  '/dashboard/direction': 'stats.view',
  '/dashboard/assistant': 'stats.view',
  '/dashboard/services': 'settings.manage',
  '/dashboard/counters': 'settings.manage',
  '/dashboard/planning': 'settings.manage',
  '/dashboard/promotions': 'settings.manage',
  '/dashboard/billing': 'billing.view',
  '/dashboard/settings': 'settings.manage'
}
