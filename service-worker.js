const CACHE_NAME = "rook-cache-v1.4.552"; // Updated version to trigger re-install
const OFFLINE_URL = "index.html"; 

// Added all required Firebase modules to the cache list
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "./service-worker.js",
  // External CDN resources required for offline functionality
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache and caching assets");
      return cache.addAll(urlsToCache);
    }).catch(err => {
      console.error("Failed to cache assets during install:", err);
    })
  );
});

self.addEventListener("fetch", (event) => {
  // Handle navigation requests (e.g., loading the app itself) with a network-first strategy
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If the network is available, update the cache with the latest version
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If the network fails, serve the cached offline page
          console.log("Fetch failed; returning offline page from cache.");
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For all other requests (assets, scripts, etc.), use a cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If the resource is in the cache, return it
      if (cachedResponse) {
        return cachedResponse;
      }
      // Otherwise, fetch it from the network
      return fetch(event.request).then((networkResponse) => {
        // And cache the newly fetched resource for future offline use
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  // This claims control over the page immediately
  self.clients.claim();
  // This removes old, unused caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});
