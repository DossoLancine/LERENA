'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { InstallAppButton } from '@/components/pwa/install'
import { BarChart3, Bell, ChevronRight, Contrast, Headset, Heart, Languages, LogOut, Pencil, ShieldCheck, Ticket, Timer, Trash2, Type } from 'lucide-react'
import UserProfileForm from '@/components/profile/user-profile-form'
import { AnimatedNumber, Button, Dialog, BottomSheet, useToast } from '@/components/ui'
import { getMySummary, deleteMyAccount } from '@/server/actions/me'
import { readPreferences, savePreferences, type Preferences, type TextSize } from '@/lib/preferences'
import { cn } from '@/lib/cn'
import { haptics } from '@/lib/haptics'
import { t, type MessageKey } from '@/lib/i18n'
import { MyDataCard } from '@/components/account/my-data-card'
import { LegalLinks } from '@/components/legal/legal-links'

type Summary = Awaited<ReturnType<typeof getMySummary>>

const SIZES: { value: TextSize; label: MessageKey; sample: string }[] = [
  { value: 'normal', label: 'profile.sizeNormal', sample: 'text-sm' },
  { value: 'large', label: 'profile.sizeLarge', sample: 'text-base' },
  { value: 'xlarge', label: 'profile.sizeXLarge', sample: 'text-lg' },
]

/** Groupe de réglages façon application native : titre discret, lignes séparées, coins arrondis. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{title}</h2>
      <div className="divide-y divide-surface-line overflow-hidden rounded-[22px] bg-white shadow-card ring-1 ring-black/[0.03]">{children}</div>
    </section>
  )
}

function Row({ icon, label, hint, href, onClick, right, danger }: { icon: ReactNode; label: string; hint?: string; href?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  const body = (
    <>
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', danger ? 'bg-danger-soft text-danger' : 'bg-brand-50 text-brand')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', danger ? 'text-danger' : 'text-ink')}>{label}</span>
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </span>
      {right ?? ((href || onClick) && <ChevronRight size={17} className="shrink-0 text-ink-subtle" />)}
    </>
  )
  const cls = 'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50'
  if (href) return <Link href={href} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}

/** Profil : identité, temps gagné, réglages d'affichage, compte et données. */
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

  const name = session?.user?.name || t('profile.user')

  return (
    <div className="min-h-screen bg-surface-sunken pb-28">
      {/* En-tête : identité */}
      <header className="bg-gradient-to-b from-[#fde3cc] via-[#fff1e5] to-surface-sunken">
        <div className="mx-auto max-w-lg px-5 pb-4 pt-7">
          <h1 className="sr-only">{t('profile.title')}</h1>
          {status === 'loading' ? (
            <div className="h-20 rounded-[22px] shimmer" />
          ) : session?.user ? (
            <div className="flex items-center gap-4">
              <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#fb923c] to-brand font-display text-3xl font-extrabold text-white shadow-[0_12px_28px_-12px_rgba(194,65,12,0.7)]">
                {name[0]?.toUpperCase() || 'L'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-2xl font-extrabold tracking-tight text-ink">{name}</p>
                <p className="truncate text-sm text-ink-muted">{session.user.email || (session.user as { phone?: string }).phone || ''}</p>
              </div>
              <button type="button" onClick={() => setEditing(true)} aria-label={t('profile.edit')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm ring-1 ring-black/5"><Pencil size={16} /></button>
            </div>
          ) : (
            <div className="rounded-[24px] bg-white p-5 text-center shadow-card">
              <p className="font-display text-xl font-bold text-ink">Bienvenue sur Lerena</p>
              <p className="mt-1 text-sm text-ink-muted">{t('profile.loginPrompt')}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/auth/login" className="rounded-full bg-gradient-to-br from-[#fb923c] to-brand px-5 py-2.5 text-sm font-bold text-white shadow-md">{t('landing.login')}</Link>
                <Link href="/auth/register" className="rounded-full bg-gray-100 px-5 py-2.5 text-sm font-bold text-ink">{t('tickets.createAccount')}</Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-5 pt-1">
        {/* Le temps gagné : la fierté de l'usager */}
        {summary && (
          <section className="grid grid-cols-[1.4fr_1fr] gap-3">
            <div className="relative overflow-hidden rounded-[24px] bg-ink p-4 text-white">
              <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" aria-hidden="true" />
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><Timer size={14} /> Temps gagné hors de la file</p>
              <p className="mt-2 font-display text-4xl font-extrabold tabular-nums"><AnimatedNumber value={Number(summary.savedHours) || 0} decimals={1} /> <span className="text-lg font-bold text-white/70">h</span></p>
            </div>
            <div className="grid gap-3">
              <Link href="/tickets" className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2.5 shadow-card ring-1 ring-black/[0.03]">
                <Ticket size={16} className="text-brand" /><span className="font-display text-xl font-extrabold tabular-nums text-ink">{summary.tickets}</span><span className="text-xs text-ink-subtle">tickets</span>
              </Link>
              <Link href="/favorites" className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2.5 shadow-card ring-1 ring-black/[0.03]">
                <Heart size={16} className="text-brand" /><span className="font-display text-xl font-extrabold tabular-nums text-ink">{summary.favorites}</span><span className="text-xs text-ink-subtle">favoris</span>
              </Link>
            </div>
          </section>
        )}

        {/* Accès professionnels */}
        {(role === 'AGENT' || role === 'MANAGER') && (
          <Group title="Espace professionnel">
            <Row icon={<Headset size={18} />} label={t('profile.agentSpace')} href="/agent" />
            {role === 'MANAGER' && <Row icon={<BarChart3 size={18} />} label={t('dashboard.eyebrow')} href="/dashboard" />}
          </Group>
        )}

        <Group title="Affichage">
          <div className="px-4 py-3.5">
            <p className="mb-3 flex items-center gap-3 text-sm font-semibold text-ink"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand"><Type size={18} /></span>{t('profile.textSize')}</p>
            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1" role="radiogroup" aria-label={t('profile.textSize')}>
              {SIZES.map(size => (
                <button key={size.value} type="button" role="radio" aria-checked={prefs.textSize === size.value} onClick={() => updatePrefs({ ...prefs, textSize: size.value })}
                  className={cn('min-h-[40px] rounded-xl font-semibold transition-all', size.sample, prefs.textSize === size.value ? 'bg-white text-ink shadow-sm' : 'text-ink-muted')}>
                  {t(size.label)}
                </button>
              ))}
            </div>
          </div>
          <Row icon={<Contrast size={18} />} label={t('profile.highContrast')} hint="Texte plus foncé, contours renforcés"
            right={
              <button type="button" role="switch" aria-checked={prefs.highContrast} aria-label={t('profile.highContrast')} onClick={() => updatePrefs({ ...prefs, highContrast: !prefs.highContrast })}
                className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', prefs.highContrast ? 'bg-brand' : 'bg-gray-300')}>
                <span className={cn('absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 ease-spring', prefs.highContrast ? 'translate-x-[22px]' : 'translate-x-0.5')} />
              </button>
            } />
          <Row icon={<Languages size={18} />} label={t('profile.language')} right={<span className="text-sm text-ink-muted">Français</span>} />
        </Group>

        {session?.user && (
          <Group title="Compte">
            <Row icon={<Pencil size={18} />} label="Modifier mon profil" onClick={() => setEditing(true)} />
            <Row icon={<ShieldCheck size={18} />} label="Sécurité du compte" hint="Code, double authentification, appareils" href="/account/security" />
            <Row icon={<Bell size={18} />} label={t('profile.notifications')} hint="Activez-les sur l’écran de chaque ticket" />
          </Group>
        )}

        {session?.user && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Données</h2>
            <MyDataCard />
          </section>
        )}

        <InstallAppButton />

        {session?.user && (
          <Group title="Session">
            <Row icon={<LogOut size={18} />} label={t('common.logout')} onClick={() => signOut({ callbackUrl: '/' })} />
            {role === 'CLIENT' && <Row icon={<Trash2 size={18} />} label={t('profile.deleteAccount')} onClick={() => setConfirmDelete(true)} danger />}
          </Group>
        )}

        <div className="space-y-2 pb-4 pt-2 text-center">
          <p className="font-display text-sm font-bold text-ink-subtle">Lerena</p>
          <LegalLinks />
        </div>
      </main>

      <Dialog open={editing} onClose={() => setEditing(false)} title={t('profile.edit')}>
        <UserProfileForm theme="orange" />
      </Dialog>

      <BottomSheet open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)}>
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-danger"><Trash2 size={26} /></span>
          <h2 className="font-display text-2xl font-extrabold text-ink">{t('profile.deleteTitle')}</h2>
          <p className="mt-2 text-sm text-ink-muted">{t('profile.deleteText')}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setConfirmDelete(false)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="danger" fullWidth loading={deleting} onClick={handleDelete}>{t('profile.deleteConfirm')}</Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
