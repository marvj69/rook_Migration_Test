const VERSION = '1.4.6-b6';
const STATIC_CACHE = 'rook-static-' + VERSION;
const RUNTIME_CACHE = 'rook-runtime-' + VERSION;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/assets/tailwind.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request));
    return;
  }

  const url = new URL(request.url);

  if (url.origin === location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirstWithTimeout(request, 3000));
});

async function handleNavigate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached =
    (await cache.match('/index.html', { ignoreSearch: true })) ||
    (await cache.match('index.html', { ignoreSearch: true }));

  const network = fetch(request)
    .then((resp) => {
      cache.put('/index.html', resp.clone());
      return resp;
    })
    .catch(() => null);

  return cached || (await network) ||
    new Response('<!doctype html><title>Offline</title><p>Offline</p>', {
      headers: { 'Content-Type': 'text/html' }
    });
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const resp = await fetch(request);
    caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, resp.clone()));
    return resp;
  } catch (e) {
    if (request.destination === 'style') {
      return caches.match('/assets/tailwind.min.css');
    }
    throw e;
  }
}

async function networkFirstWithTimeout(request, timeoutMs) {
  const cache = await caches.open(RUNTIME_CACHE);
  const timer = new Promise((resolve) =>
    setTimeout(async () => {
      const cached = await cache.match(request);
      if (cached) resolve(cached);
    }, timeoutMs)
  );

  const network = fetch(request)
    .then((resp) => {
      if (request.method === 'GET' && resp.status === 200) {
        cache.put(request, resp.clone());
      }
      return resp;
    })
    .catch(async () => {
      const cached = await cache.match(request);
      if (cached) return cached;
      return new Response('', { status: 504 });
    });

  return Promise.race([network, timer]).then((result) => result || network);
}
