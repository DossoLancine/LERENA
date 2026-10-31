// Service worker ATTENDS : notifications push, même application fermée ou téléphone verrouillé.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

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
