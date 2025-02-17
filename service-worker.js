// Update your cache name whenever you change the service worker or want to force a refresh
const CACHE_NAME = "rook-cache-v8";

// Use the exact path to your index.html, matching how it’s served on GitHub Pages
const OFFLINE_URL = "/rook_Migration_Test/index.html";

// The files we want to cache ahead of time. Must match your GH Pages paths exactly.
const urlsToCache = [
  "/rook_Migration_Test/index.html",
  "/rook_Migration_Test/manifest.json",
  "/rook_Migration_Test/service-worker.js",
  "/rook_Migration_Test/icons/icon-192x192.png",
  "/rook_Migration_Test/icons/icon-512x512.png",
  "https://cdn.tailwindcss.com"
];

// Flag to ensure we only do a network-first check once
let hasCheckedForUpdate = false;

/**
 * INSTALL: Cache the specified resources and activate immediately.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Installing, caching:", urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

/**
 * FETCH:
 *   - On the *first* navigation request, do a network-first approach. If offline, serve OFFLINE_URL.
 *   - On subsequent navigation requests, serve from cache (fallback to network, then to OFFLINE_URL).
 *   - For non-navigation requests, do cache-first with background update.
 */
self.addEventListener("fetch", (event) => {
  const isNavigationRequest =
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept")?.includes("text/html"));

  if (isNavigationRequest) {
    // Only do the network-first approach once:
    if (!hasCheckedForUpdate) {
      hasCheckedForUpdate = true;
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            console.log("[SW] Fetched (first nav) from network:", event.request.url);
            // Cache the fresh version
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch((err) => {
            console.warn("[SW] First nav fetch failed, offline fallback:", err);
            // Return offline fallback
            return caches.match(OFFLINE_URL).then((cached) => {
              return (
                cached ||
                new Response("<h1>You are offline</h1>", {
                  headers: { "Content-Type": "text/html" },
                })
              );
            });
          })
      );
    } else {
      // Subsequent navigations => cache-first fallback to network => fallback to OFFLINE_URL
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log("[SW] Serving nav from cache:", event.request.url);
            return cachedResponse;
          }
          // Not in cache, try network
          return fetch(event.request).catch((err) => {
            console.warn("[SW] Subsequent nav fetch failed:", err);
            // Fallback to OFFLINE_URL
            return caches.match(OFFLINE_URL).then((fallback) => {
              return (
                fallback ||
                new Response("<h1>You are offline</h1>", {
                  headers: { "Content-Type": "text/html" },
                })
              );
            });
          });
        })
      );
    }
  } else {
    // For non-navigation requests => cache-first with background update
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Attempt a network fetch in the background
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // If the network fails, rely on the cached response
          });
        // Return cache or the network fetch promise
        return cachedResponse || fetchPromise;
      })
    );
  }
});

/**
 * ACTIVATE: Clean up old caches, claim clients so the SW controls pages immediately.
 */
self.addEventListener("activate", (event) => {
  self.clients.claim();
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});
