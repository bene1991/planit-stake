/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Use with precache injection
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'ValueTips',
    body: 'Nova notificação',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {} as Record<string, unknown>,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const isGoalNotification = data.data?.type === 'goal';

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: isGoalNotification ? 'valuetips-goal' : 'valuetips-notification',
    renotify: true,
    requireInteraction: true,
    // Vibração especial para gol! 🎉
    vibrate: isGoalNotification 
      ? [300, 100, 300, 100, 300, 100, 500] // Padrão de comemoração
      : [200],
    data: {
      url: self.location.origin,
      type: data.data?.type,
      ...data.data,
    },
  } as NotificationOptions;

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            return;
          }
        }
        // Otherwise, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(self.location.origin);
        }
      })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  // The subscription needs to be renewed
  // This will be handled by the frontend when it detects the change
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
