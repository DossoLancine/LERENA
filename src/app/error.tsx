'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { WifiOff, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'
import { reportClientError } from '@/components/system/error-reporter'

// Erreur dans une page : l'utilisateur garde la main (réessayer ou revenir à l'accueil)
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page error:', error)
    reportClientError(error)
  }, [error])

  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-danger-soft text-danger">
        <WifiOff size={36} />
      </div>
      <h1 className="text-2xl font-black text-ink">
        {offline ? t('errors.offline.title') : t('errors.generic.title')}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">
        {offline ? t('errors.offline.description') : t('errors.generic.description')}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset} icon={<RotateCcw size={16} />}>{t('common.retry')}</Button>
        <Link href="/" className="btn-secondary">{t('common.backHome')}</Link>
      </div>
      {error.digest && <p className="mt-6 font-mono text-[11px] text-ink-subtle">Réf. {error.digest}</p>}
    </main>
  )
}
