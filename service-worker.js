const CACHE_NAME = 'rook-cache-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/service-worker.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdn.tailwindcss.com'  // Tailwind CDN for offline caching
];

// Install Event: Cache specified resources and force waiting SW to become active
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become active
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache during install');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache during install:', error);
      })
  );
});

// Fetch Event: Uses a network-first strategy for navigation requests
// and a cache-first with background update for other requests.
self.addEventListener('fetch', (event) => {
  // If this is a navigation request (i.e. the user opening the app)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update the cache with the latest version
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch((error) => {
          console.warn('Network fetch failed, serving cached content:', error);
          return caches.match(event.request);
        })
    );
  } else {
    // For non-navigation requests, use the cached version immediately if available.
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // If the response is valid, update the cache.
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // In case of network error, just let the cached version stand.
            });
          // Return the cached response immediately, or the network response if not cached.
          return cachedResponse || fetchPromise;
        })
    );
  }
});

// Activate Event: Cleans up old caches and claims clients immediately.
self.addEventListener('activate', (event) => {
  // Claim any clients immediately so that the SW starts controlling pages
  self.clients.claim();
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ))
  );
});
