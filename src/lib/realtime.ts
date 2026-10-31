// Signaux temps réel envoyés par le serveur via Supabase Realtime (Broadcast).
// Le message ne contient aucune donnée : il dit seulement « cette organisation a changé ».
// Les écrans abonnés rechargent alors leurs données via les actions serveur, qui
// appliquent le contrôle d'accès habituel. Rien de sensible ne transite par le canal.

export const orgTopic = (orgId: string) => `org:${orgId}`
export const ORG_CHANGED_EVENT = 'changed'

export async function notifyOrg(orgId: string | null | undefined) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!orgId || !url || !key) return

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: orgTopic(orgId), event: ORG_CHANGED_EVENT, payload: { at: Date.now() } }]
      }),
      // Un signal perdu n'est pas grave : le rafraîchissement de secours prend le relais
      signal: AbortSignal.timeout(2000),
      cache: 'no-store'
    })
  } catch (error) {
    console.error('Realtime notify error:', error)
  }
}
