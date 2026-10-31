import Link from 'next/link'
import { Compass } from 'lucide-react'
import { t } from '@/lib/i18n'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-sunken px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-100 text-brand-600">
        <Compass size={40} />
      </div>
      <p className="text-sm font-bold uppercase tracking-wider text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-black text-ink">{t('errors.notFound.title')}</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-muted">{t('errors.notFound.description')}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/explore" className="btn-primary">{t('errors.notFound.explore')}</Link>
        <Link href="/" className="btn-secondary">{t('common.backHome')}</Link>
      </div>
    </main>
  )
}
