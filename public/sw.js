// Wanderglobe service worker — network-first with offline fallback
const CACHE = 'wanderglobe-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(['/', '/globe/', OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Skip cross-origin requests (Supabase, Nominatim, etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          if (e.request.mode === 'navigate') return caches.match(OFFLINE_URL);
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        })
      )
  );
});
