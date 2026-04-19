// JT-MP3 Service Worker - Power PWA Features
const CACHE_NAME = 'jt-mp3-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.webmanifest',
];

// Installation: Cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Cache-First Strategie für App, Network-First für API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API Calls: Network-First mit Timeout
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          return new Response(JSON.stringify({ error: 'offline' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // Audio/Video Streams: Nur Network
  if (url.pathname.startsWith('/api/stream/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Statische Assets: Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});

// Hintergrund-Synchronisation für Uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'upload-sync') {
    event.waitUntil(handleBackgroundUpload());
  }
});

async function handleBackgroundUpload() {
  // Uploads aus IndexedDB holen und senden
  console.log('Background sync triggered');
}

// Push Benachrichtigungen (optional für zukünftige Features)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'JT-MP3', {
      body: data.body ?? 'Neue Musik im Raum',
      icon: '/icon.svg',
      badge: '/icon.svg',
      requireInteraction: false,
      data: data,
    })
  );
});
