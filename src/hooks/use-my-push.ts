'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPushPublicKey } from '@/server/actions/push'
import { isMyPushSubscribed, removeMyPushSubscription, saveMyPushSubscription } from '@/server/actions/notification-center'
import type { PushState } from '@/hooks/use-push'

const toKey = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

/** Notifications de la personne connectée sur cet appareil, même application fermée. */
export function useMyPush() {
  const [state, setState] = useState<PushState>('loading')

  const check = useCallback(async () => {
    const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!hasApi) return setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported')
    const vapid = await getPushPublicKey().catch(() => null)
    if (!vapid) return setState('unsupported')
    if (Notification.permission === 'denied') return setState('denied')
    const reg = await navigator.serviceWorker.register('/sw.js')
    const sub = await reg.pushManager.getSubscription()
    setState(sub && Notification.permission === 'granted' && await isMyPushSubscribed(sub.endpoint) ? 'subscribed' : 'default')
  }, [])

  useEffect(() => { check().catch(() => setState('unsupported')) }, [check])

  // À appeler depuis un appui de l'utilisateur (exigence des navigateurs)
  const enable = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'default'); return false }
      const vapid = await getPushPublicKey()
      if (!vapid) { setState('unsupported'); return false }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapid) })
      const res = await saveMyPushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } })
      setState(res.success ? 'subscribed' : 'default')
      return res.success
    } catch (error) {
      console.error('Push enable error:', error)
      setState('default')
      return false
    }
  }, [])

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await removeMyPushSubscription(sub.endpoint)
    setState('default')
  }, [])

  return { state, enable, disable }
}
