// Numéros de téléphone au format international sans espaces : +2250701020304

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, '')
  const withPlus = digits.startsWith('+') ? digits : `+${digits}`
  // Indicatif + numéro : 8 à 15 chiffres au total (norme E.164)
  return /^\+\d{8,15}$/.test(withPlus) ? withPlus : null
}

// Affichage masqué pour les écrans publics et les confirmations : +225 07 •• •• 04
export function maskPhone(phone: string) {
  return phone.length > 6 ? `${phone.slice(0, 7)} •• •• ${phone.slice(-2)}` : phone
}
