'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, BellRing, CheckCheck, Settings2, X } from 'lucide-react'
import { getMyNotifications, getUnreadNotificationsCount, markNotificationsRead } from '@/server/actions/notification-center'
import { usePolling } from '@/hooks/use-polling'
import { useMyPush } from '@/hooks/use-my-push'
import { cn } from '@/lib/cn'

type Data = NonNullable<Awaited<ReturnType<typeof getMyNotifications>>>

const ago = (d: Date | string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'à l’instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Cloche des interfaces professionnelles : compteur, liste, activation des notifications sur l'appareil. */
export function NotificationBell({ className, align = 'left' }: { className?: string; align?: 'left' | 'right' }) {
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Data | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const push = useMyPush()

  const refreshCount = useCallback(async () => setUnread(await getUnreadNotificationsCount().catch(() => 0)), [])
  usePolling(refreshCount, 30_000)
  const load = useCallback(async () => { const d = await getMyNotifications().catch(() => null); if (d) { setData(d); setUnread(d.unread) } }, [])
  useEffect(() => { if (open) load() }, [open, load])

  // Fermeture au clic extérieur et à Échap
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  const openItem = async (id: string, url: string | null) => {
    await markNotificationsRead([id])
    setOpen(false)
    refreshCount()
    if (url) router.push(url)
  }
  const readAll = async () => { await markNotificationsRead(); load() }

  return (
    <div ref={panel} className={cn('relative', className)}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={unread ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted hover:bg-gray-100 hover:text-ink">
        {unread ? <BellRing size={18} className="text-brand" /> : <Bell size={18} />}
        {unread > 0 && <span className="absolute right-1 top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white tabular-nums">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications"
          className={cn('fixed inset-x-2 top-16 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-surface-line bg-white shadow-2xl animate-rise-in sm:absolute sm:inset-x-auto sm:top-auto sm:w-[380px]',
            align === 'left' ? 'sm:bottom-12 sm:left-0' : 'sm:right-0 sm:top-12')}>
          <header className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <p className="font-semibold text-ink">Notifications</p>
            <div className="flex items-center gap-1">
              {!!data?.unread && <button onClick={readAll} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-gray-100"><CheckCheck size={14} /> Tout lu</button>}
              <Link href="/account/notifications" onClick={() => setOpen(false)} aria-label="Régler mes notifications" className="rounded-lg p-1.5 text-ink-muted hover:bg-gray-100"><Settings2 size={16} /></Link>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-ink-muted hover:bg-gray-100 sm:hidden"><X size={16} /></button>
            </div>
          </header>

          {/* Activation sur cet appareil */}
          {(push.state === 'default' || push.state === 'ios-install') && (
            <div className="border-b border-surface-line bg-brand-50/60 px-4 py-3 text-sm">
              {push.state === 'default' ? (
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-ink">Recevez les alertes même application fermée.</p>
                  <button onClick={() => push.enable()} className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white">Activer</button>
                </div>
              ) : (
                <p className="text-ink">Sur iPhone : touchez <strong>Partager</strong> puis <strong>Sur l’écran d’accueil</strong>, ouvrez Lerena depuis l’icône, puis activez les notifications.</p>
              )}
            </div>
          )}

          <ul className="flex-1 divide-y divide-surface-line overflow-y-auto">
            {!data && <li className="p-6"><div className="h-12 animate-pulse rounded-xl bg-gray-100" /></li>}
            {data?.items.length === 0 && <li className="px-6 py-10 text-center text-sm text-ink-subtle">Aucune notification pour l’instant.</li>}
            {data?.items.map(n => (
              <li key={n.id}>
                <button onClick={() => openItem(n.id, n.url)} className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-sunken/70', !n.isRead && 'bg-brand-50/40')}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand')} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{n.body}</span>
                    <span className="mt-1 block text-[11px] text-ink-subtle">{ago(n.updatedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
