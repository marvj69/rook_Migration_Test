const CACHE_NAME = "rook-cache-v1.562";
const OFFLINE_URL = "index.html"; // Use relative path

const urlsToCache = [
  "./", // Root path
  "./index.html",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./service-worker.js",
  // External CDN resources for offline functionality
  "https://cdn.tailwindcss.com/3.4.16",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Handle navigation requests
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cachedResponse) => {
        if (cachedResponse) {
          // Serve cached version immediately
          // Update cache in background (stale-while-revalidate)
          fetch(event.request)
            .then((networkResponse) => {
              return caches.open(CACHE_NAME).then((cache) => {
                cache.put("./index.html", networkResponse.clone());
              });
            })
            .catch(() => {}); // Ignore network errors when updating cache
          
          return cachedResponse;
        }
        
        // If not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put("./index.html", networkResponse.clone());
              return networkResponse;
            });
          })
          .catch(() => caches.match("./index.html")); // Final fallback
      })
    );
  } else {
    // Handle other assets (including external CDN resources)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request).then((networkResponse) => {
          // Cache external resources for offline use
          if (event.request.url.includes('cdn.tailwindcss.com') || 
              event.request.url.includes('cdn.jsdelivr.net')) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
              // Also cache the base tailwind URL to handle redirects
              if (event.request.url === 'https://cdn.tailwindcss.com') {
                cache.put('https://cdn.tailwindcss.com/3.4.16', responseClone.clone());
              }
            });
          }
          return networkResponse;
        });
      })
    );
  }
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });
