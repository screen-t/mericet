const CACHE = 'mericet-v1';

// Static shell to precache on install
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests on the same origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Skip API calls — always go to the network
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first, fall back to cached index.html (SPA shell)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first, update in the background
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          // Clone BEFORE returning so the body isn't consumed when the async cache.put runs
          const toCache = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, toCache));
        }
        return response;
      }).catch(() => cached); // If network fails, fall back to cached version (may be undefined)
      return cached || network;
    })
  );
});
