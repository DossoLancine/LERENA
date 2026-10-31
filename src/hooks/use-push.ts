'use client'

import { useCallback, useEffect, useState } from 'react'
import { isPushSubscribed, savePushSubscription } from '@/server/actions/push'

export type PushState =
  | 'loading'
  | 'unsupported'    // navigateur sans notifications web
  | 'ios-install'    // iPhone : il faut d'abord ajouter l'app à l'écran d'accueil
  | 'default'        // pas encore activé
  | 'denied'         // refusé dans les réglages du navigateur
  | 'subscribed'

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

/** Abonnement de cet appareil aux alertes push d'un ticket. */
export function usePush(ticketId: string) {
  const [state, setState] = useState<PushState>('loading')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      if (!vapid) return setState('unsupported')
      if (!hasApi) return setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported')
      if (Notification.permission === 'denied') return setState('denied')

      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      const subscribed = !!sub && Notification.permission === 'granted' && await isPushSubscribed(ticketId, sub.endpoint)
      if (!cancelled) setState(subscribed ? 'subscribed' : 'default')
    }
    check().catch(() => !cancelled && setState('unsupported'))
    return () => { cancelled = true }
  }, [ticketId])

  // Doit être appelé depuis un appui de l'utilisateur (exigence des navigateurs)
  const enable = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'default')
        return false
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
      })
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      const res = await savePushSubscription(ticketId, json)
      setState(res.success ? 'subscribed' : 'default')
      return res.success
    } catch (error) {
      console.error('Push enable error:', error)
      setState('default')
      return false
    }
  }, [ticketId])

  return { state, enable }
}
