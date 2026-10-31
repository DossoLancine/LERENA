'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { LogOut, Type, Contrast, Languages, Bell, Trash2, BarChart3, Headset, Pencil } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { ClientNav } from '@/components/navigation/client-nav'
import { Button, Card, Dialog, BottomSheet, useToast } from '@/components/ui'
import { getMySummary, deleteMyAccount } from '@/server/actions/me'
import { readPreferences, savePreferences, type Preferences, type TextSize } from '@/lib/preferences'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'
import { t, type MessageKey } from '@/lib/i18n'

type Summary = Awaited<ReturnType<typeof getMySummary>>

const SIZES: { value: TextSize; label: MessageKey; sample: string }[] = [
  { value: 'normal', label: 'profile.sizeNormal', sample: 'text-sm' },
  { value: 'large', label: 'profile.sizeLarge', sample: 'text-base' },
  { value: 'xlarge', label: 'profile.sizeXLarge', sample: 'text-lg' },
]

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const toast = useToast()
  const [summary, setSummary] = useState<Summary>(null)
  const [prefs, setPrefs] = useState<Preferences>({ textSize: 'normal', highContrast: false })
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const role = (session?.user as { role?: string } | undefined)?.role

  useEffect(() => { setPrefs(readPreferences()) }, [])
  useEffect(() => { if (status === 'authenticated') getMySummary().then(setSummary) }, [status])

  const updatePrefs = (next: Preferences) => {
    haptics.tap()
    setPrefs(next)
    savePreferences(next)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const res = await deleteMyAccount()
    if (res.success) {
      await signOut({ callbackUrl: '/' })
      return
    }
    setDeleting(false)
    setConfirmDelete(false)
    toast(res.error ?? t('errors.generic.title'), 'error')
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <header className="border-b border-surface-line bg-white">
        <div className="mx-auto max-w-lg px-4 py-5">
          <h1 className="text-2xl font-bold text-ink">{t('profile.title')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        {/* Identité */}
        {status === 'loading' ? (
          <div className="h-28 animate-pulse rounded-card bg-gray-200/80" />
        ) : session?.user ? (
          <Card className="flex items-center gap-4 p-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-3xl font-bold text-white">
              {session.user.name?.[0]?.toUpperCase() || 'U'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold text-ink">{session.user.name || t('profile.user')}</p>
              {session.user.email && <p className="truncate text-sm text-ink-muted">{session.user.email}</p>}
            </div>
            <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>{t('profile.edit')}</Button>
          </Card>
        ) : (
          <Card className="p-5 text-center">
            <p className="text-sm text-ink-muted">{t('profile.loginPrompt')}</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/auth/login" className="btn-primary text-sm">{t('landing.login')}</Link>
              <Link href="/auth/register" className="btn-secondary text-sm">{t('tickets.createAccount')}</Link>
            </div>
          </Card>
        )}

        {/* Chiffres réels */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: summary.tickets, label: t('profile.statTickets'), tone: 'text-brand' },
              { value: summary.favorites, label: t('profile.statFavorites'), tone: 'text-info' },
              { value: `${summary.savedHours} h`, label: t('profile.statSaved'), tone: 'text-success' },
            ].map(s => (
              <Card key={s.label} className="p-3 text-center">
                <p className={cn('text-2xl font-black tabular-nums', s.tone)}>{s.value}</p>
                <p className="mt-1 text-xs text-ink-muted">{s.label}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Affichage et accessibilité */}
        <Card className="divide-y divide-surface-line">
          <div className="p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Type size={18} className="text-ink-muted" />{t('profile.textSize')}</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('profile.textSize')}>
              {SIZES.map(size => (
                <button
                  key={size.value}
                  role="radio"
                  aria-checked={prefs.textSize === size.value}
                  onClick={() => updatePrefs({ ...prefs, textSize: size.value })}
                  className={cn('min-h-touch rounded-xl border-2 font-semibold transition-all active:scale-95', size.sample,
                    prefs.textSize === size.value ? 'border-brand bg-brand-50 text-brand-700' : 'border-surface-line text-ink-muted')}
                >
                  {t(size.label)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-h-touch cursor-pointer items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Contrast size={18} className="text-ink-muted" />{t('profile.highContrast')}</span>
            <input type="checkbox" role="switch" className="h-6 w-11 cursor-pointer accent-brand" checked={prefs.highContrast}
              onChange={e => updatePrefs({ ...prefs, highContrast: e.target.checked })} />
          </label>

          <div className="flex min-h-touch items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink"><Languages size={18} className="text-ink-muted" />{t('profile.language')}</span>
            <span className="text-sm text-ink-muted">Français · <span className="text-ink-subtle">{t('profile.moreLanguages')}</span></span>
          </div>

          <div className="flex items-start gap-2 p-4 text-sm">
            <Bell size={18} className="mt-0.5 shrink-0 text-ink-muted" />
            <div>
              <p className="font-semibold text-ink">{t('profile.notifications')}</p>
              <p className="mt-0.5 text-ink-muted">{t('profile.notificationsText')}</p>
            </div>
          </div>
        </Card>

        {/* Accès professionnels */}
        {(role === 'AGENT' || role === 'MANAGER') && (
          <Card className="grid grid-cols-2 gap-2 p-3">
            <Link href="/agent" className="flex flex-col items-center gap-2 rounded-xl bg-info-soft p-3 text-info-ink active:scale-95">
              <Headset size={26} /><span className="text-xs font-semibold">{t('profile.agentSpace')}</span>
            </Link>
            {role === 'MANAGER' && (
              <Link href="/dashboard" className="flex flex-col items-center gap-2 rounded-xl bg-brand-50 p-3 text-brand-700 active:scale-95">
                <BarChart3 size={26} /><span className="text-xs font-semibold">{t('dashboard.eyebrow')}</span>
              </Link>
            )}
          </Card>
        )}

        {session?.user && (
          <div className="space-y-3">
            <Button variant="secondary" fullWidth icon={<LogOut size={16} />} onClick={() => signOut({ callbackUrl: '/' })}>{t('common.logout')}</Button>
            {role === 'CLIENT' && (
              <button onClick={() => setConfirmDelete(true)} className="flex w-full items-center justify-center gap-2 py-3 text-sm font-medium text-danger">
                <Trash2 size={15} /> {t('profile.deleteAccount')}
              </button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-ink-subtle">ATTENDS · {t('landing.title')}</p>
      </main>

      <Dialog open={editing} onClose={() => setEditing(false)} title={t('profile.edit')}>
        <UserProfileForm theme="orange" />
      </Dialog>

      <BottomSheet open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)}>
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"><Trash2 size={26} /></span>
          <h2 className="text-lg font-bold text-ink">{t('profile.deleteTitle')}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t('profile.deleteText')}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(false)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="danger" fullWidth loading={deleting} onClick={handleDelete}>{t('profile.deleteConfirm')}</Button>
          </div>
        </div>
      </BottomSheet>

      <ClientNav />
    </div>
  )
}
