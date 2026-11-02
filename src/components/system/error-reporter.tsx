'use client'

import { useEffect } from 'react'

/** Envoie une erreur du navigateur au journal Lerena (sans bloquer la page, sans données personnelles). */
export function reportClientError(error: unknown) {
  try {
    const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inconnue')
    const body = JSON.stringify({ message: e.message, stack: e.stack, path: location.pathname })
    if (navigator.sendBeacon) navigator.sendBeacon('/api/errors', new Blob([body], { type: 'application/json' }))
    else fetch('/api/errors', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => null)
  } catch { /* le signalement ne doit jamais casser la page */ }
}

/** Écoute les erreurs JavaScript non rattrapées de toutes les pages. */
export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportClientError(e.error ?? e.message)
    const onRejection = (e: PromiseRejectionEvent) => reportClientError(e.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])
  return null
}
