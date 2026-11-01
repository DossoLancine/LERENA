import {
  Stethoscope, Pill, Baby, Siren, HeartPulse, Hospital, Landmark, Banknote, Wallet, Building, Building2,
  FileText, Stamp, Info, Smartphone, Zap, Droplets, GraduationCap, Bus, Plane, Package, Ticket, CreditCard,
  Utensils, Scissors, Sparkles, Store, ShoppingBag, MessageCircle, UserPlus, ClipboardList, Scale, Shield, Mail,
  type LucideIcon
} from 'lucide-react'

// Bibliothèque d'icônes proposée dans l'administration pour les secteurs et les services.
// Les données (quel secteur utilise quelle icône) sont en base ; seul le dessin vit ici.
export const ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  stethoscope: { icon: Stethoscope, label: 'Consultation' },
  'heart-pulse': { icon: HeartPulse, label: 'Soins' },
  hospital: { icon: Hospital, label: 'Hôpital' },
  pill: { icon: Pill, label: 'Pharmacie' },
  baby: { icon: Baby, label: 'Enfants' },
  siren: { icon: Siren, label: 'Urgences' },
  landmark: { icon: Landmark, label: 'Banque' },
  banknote: { icon: Banknote, label: 'Caisse / paiement' },
  wallet: { icon: Wallet, label: 'Crédit / finances' },
  building: { icon: Building, label: 'Administration' },
  'building-2': { icon: Building2, label: 'Bureau' },
  'file-text': { icon: FileText, label: 'Document' },
  'id-card': { icon: CreditCard, label: 'Identité' },
  stamp: { icon: Stamp, label: 'Légalisation' },
  scale: { icon: Scale, label: 'Justice' },
  shield: { icon: Shield, label: 'Sécurité / police' },
  mail: { icon: Mail, label: 'Courrier / poste' },
  info: { icon: Info, label: 'Information' },
  clipboard: { icon: ClipboardList, label: 'Accueil' },
  smartphone: { icon: Smartphone, label: 'Téléphonie' },
  zap: { icon: Zap, label: 'Électricité' },
  droplets: { icon: Droplets, label: 'Eau' },
  'graduation-cap': { icon: GraduationCap, label: 'Éducation' },
  bus: { icon: Bus, label: 'Transport' },
  plane: { icon: Plane, label: 'Voyage' },
  package: { icon: Package, label: 'Colis / retrait' },
  ticket: { icon: Ticket, label: 'Ticket' },
  utensils: { icon: Utensils, label: 'Restauration' },
  scissors: { icon: Scissors, label: 'Coiffure' },
  sparkles: { icon: Sparkles, label: 'Beauté' },
  store: { icon: Store, label: 'Commerce' },
  'shopping-bag': { icon: ShoppingBag, label: 'Boutique' },
  message: { icon: MessageCircle, label: 'Service client' },
  'user-plus': { icon: UserPlus, label: 'Inscription' },
}

export function iconFor(key: string | null | undefined, fallback = 'ticket'): LucideIcon {
  return ICONS[key ?? '']?.icon ?? ICONS[fallback]?.icon ?? Ticket
}

/** Icône d'un secteur ou d'un service, choisie en base. */
export function DynamicIcon({ name, fallback, size = 20, className }: { name?: string | null; fallback?: string; size?: number; className?: string }) {
  const Icon = iconFor(name, fallback)
  return <Icon size={size} className={className} aria-hidden="true" />
}

// Couleurs proposées pour les secteurs : fond doux + texte, et teinte pleine pour la carte
export const SECTOR_COLORS: Record<string, { soft: string; hex: string; label: string }> = {
  orange: { soft: 'bg-orange-50 text-orange-600', hex: '#f97316', label: 'Orange' },
  blue: { soft: 'bg-blue-50 text-blue-600', hex: '#2563eb', label: 'Bleu' },
  green: { soft: 'bg-green-50 text-green-600', hex: '#16a34a', label: 'Vert' },
  teal: { soft: 'bg-teal-50 text-teal-600', hex: '#0d9488', label: 'Turquoise' },
  purple: { soft: 'bg-purple-50 text-purple-600', hex: '#9333ea', label: 'Violet' },
  pink: { soft: 'bg-pink-50 text-pink-600', hex: '#db2777', label: 'Rose' },
  red: { soft: 'bg-red-50 text-red-600', hex: '#dc2626', label: 'Rouge' },
  gray: { soft: 'bg-gray-100 text-gray-600', hex: '#4b5563', label: 'Gris' },
}

export function sectorColor(key: string | null | undefined) {
  return SECTOR_COLORS[key ?? ''] ?? SECTOR_COLORS.orange
}
