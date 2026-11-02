'use client'

import { useEffect } from 'react'
import { reportClientError } from '@/components/system/error-reporter'

// Dernier filet de sécurité : remplace toute la page, donc sans dépendre de la mise en page ni du CSS
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { reportClientError(error) }, [error])
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb', color: '#111827' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Lerena a rencontré un problème</h1>
          <p style={{ color: '#6b7280', maxWidth: 360, marginTop: 8 }}>
            Votre ticket n&apos;est pas perdu. Réessayez dans un instant.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 24, background: '#c2410c', color: '#fff', border: 0, borderRadius: 14, padding: '14px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  )
}
