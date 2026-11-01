// Service worker ATTENDS : application installable, écran hors ligne, et notifications push
// même application fermée ou téléphone verrouillé.

const VERSION = 'attends-v3'
const STATIC_CACHE = `${VERSION}-static`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  // Supprime les caches des versions précédentes
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Pages : toujours le réseau (données en temps réel).
  // L'écran hors ligne n'apparaît que si l'appareil est vraiment déconnecté ; sinon on réessaie la page,
  // en transmettant une éventuelle redirection au navigateur.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        if (self.navigator.onLine !== false) {
          try {
            const retry = await fetch(request.url, { credentials: 'include' })
            return retry.redirected ? Response.redirect(retry.url, 302) : retry
          } catch {}
        }
        return caches.match(OFFLINE_URL)
      })
    )
    return
  }

  // Fichiers de l'application versionnés (JS, CSS, polices) et icônes : cache d'abord, ils ne changent jamais
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
      )
    )
  }
  // Tout le reste (données, actions) passe directement par le réseau
})

self.addEventListener('push', (event) => {
  let data = { title: 'ATTENDS', body: 'Votre file avance.', url: '/tickets' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'attends',
      renotify: true,
      requireInteraction: !!data.urgent,
      vibrate: data.urgent ? [300, 120, 300, 120, 600] : [40, 80, 40],
      data: { url: data.url }
    })
  )
})

// Toucher la notification ouvre le ticket (ou ramène l'application au premier plan)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/tickets'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
