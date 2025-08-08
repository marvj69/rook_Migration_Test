const CACHE_NAME = "rook-cache-v1.4.560";
const OFFLINE_URL = "index.html"; // Use relative path

const urlsToCache = [
  "./", // Root path
  "./index.html",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./service-worker.js",
  // External CDN resources for offline functionality (precache what is safe)
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  // Handle navigation requests (network-first with offline fallback)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put("./index.html", networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Runtime cache for external script resources incl. Firebase ESM modules
  const url = event.request.url;
  const shouldRuntimeCache = (
    url.includes('cdn.tailwindcss.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('www.gstatic.com/firebasejs')
  );

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (shouldRuntimeCache && networkResponse && networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If the request is for a runtime-cached library, try any cached version
          if (shouldRuntimeCache) {
            const cache = await caches.open(CACHE_NAME);
            const keys = await cache.keys();
            const match = keys.find((req) => req.url === url);
            if (match) return cache.match(match);
          }
          // As a last resort do nothing special; let it fail
          throw new Error('Network error and no cache match');
        });
    })
  );
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});
