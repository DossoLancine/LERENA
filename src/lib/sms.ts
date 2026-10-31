// Envoi de SMS. Le fournisseur se choisit par la variable SMS_PROVIDER :
//   (vide)     → aucun SMS : les fonctions qui en dépendent passent en mode dégradé
//   console    → le SMS est écrit dans les journaux du serveur (développement)
// Un fournisseur réel (agrégateur couvrant Orange, MTN et Moov) s'ajoutera ici.

export function smsEnabled() {
  return !!process.env.SMS_PROVIDER
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER
  if (!provider) return false

  if (provider === 'console') {
    console.log(`[SMS → ${to}] ${text}`)
    return true
  }

  console.error(`Fournisseur SMS inconnu : ${provider}`)
  return false
}
