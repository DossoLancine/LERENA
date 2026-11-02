// Démarrage du serveur : branche le journal d'erreurs intégré (voir src/lib/observability.ts)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { captureServerErrors } = await import('@/lib/observability')
    captureServerErrors()
  }
}
