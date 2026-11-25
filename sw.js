const VERSION = 'sema-v1.5.3';
const SHELL_CACHE = `${VERSION}-shell`;
const TILE_CACHE = `${VERSION}-tiles`;
const TILE_LIMIT = 160;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/data.js',
  './assets/js/firebase-config.js',
  './assets/js/icons.js',
  './assets/js/ink.js',
  './assets/js/aquarium.js',
  './assets/js/notes.js',
  './assets/js/release.js',
  './assets/js/reminders.js',
  './assets/js/state.js',
  './assets/js/sync.js',
  './assets/js/tilemap.js',
  './assets/js/time.js',
  './assets/js/utils.js',
  './assets/js/weather.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './assets/fonts/caveat-400-latin.woff2',
  './assets/fonts/caveat-400-latin-ext.woff2',
  './assets/fonts/caveat-600-latin.woff2',
  './assets/fonts/caveat-600-latin-ext.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(
          APP_SHELL.map((url) => new Request(new URL(url, self.location.href), { cache: 'reload' })),
        ),
      )
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.warn('Sema cache install failed', error);
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sema-') && key !== SHELL_CACHE && key !== TILE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isTileRequest(url) {
  return (
    url.hostname.endsWith('basemaps.cartocdn.com') ||
    url.hostname.endsWith('tile.openstreetmap.org')
  );
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  if (keys.length <= TILE_LIMIT) return;
  await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((key) => cache.delete(key)));
}

async function handleTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response && (response.ok || response.type === 'opaque')) {
          return cache.put(request, response.clone()).then(() => trimTiles(cache));
        }
        return undefined;
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone()).then(() => trimTiles(cache));
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Tile unavailable' });
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('./index.html');
    if (fallback) return fallback;
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || fetchPromise || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request));
      return;
    }
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isTileRequest(url)) {
    event.respondWith(handleTile(request));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || '' };
  }
  const title = payload.title || 'Sema';
  const url = payload.url || './#bugun';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Ders yaklaşıyor.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: payload.tag || 'sema-reminder',
      renotify: false,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './#bugun', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          try {
            await client.navigate(target);
          } catch {
            // Bazı tarayıcılar navigate'i desteklemez; yalnız odakla.
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
