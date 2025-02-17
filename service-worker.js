const CACHE_NAME = "rook-cache-v9";
const OFFLINE_URL = "/rook_Migration_Test/index.html";

// Cache both the folder root and the index file so navigation requests match.
const urlsToCache = [
  "/rook_Migration_Test/",
  "/rook_Migration_Test/index.html",
  "/rook_Migration_Test/manifest.json",
  "/rook_Migration_Test/service-worker.js",
  "/rook_Migration_Test/icons/icon-192x192.png",
  "/rook_Migration_Test/icons/icon-512x512.png",
  "https://cdn.tailwindcss.com"
];

// This flag ensures we only perform a network-first check on the first navigation.
let hasCheckedForUpdate = false;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Installing, caching:", urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const isNavigationRequest =
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept")?.includes("text/html"));

  if (isNavigationRequest) {
    if (!hasCheckedForUpdate) {
      // On the very first navigation, try network-first
      hasCheckedForUpdate = true;
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            console.log("[SW] Fetched (first nav) from network:", event.request.url);
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch((err) => {
            console.warn("[SW] First nav fetch failed, using offline fallback:", err);
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
      // Subsequent navigations: try cache, then network, then fallback.
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log("[SW] Serving navigation from cache:", event.request.url);
            return cachedResponse;
          }
          return fetch(event.request).catch((err) => {
            console.warn("[SW] Navigation fetch failed:", err);
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
    // For non-navigation requests, use a cache-first approach with background update.
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
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
            // If network fails, use cached response (if any)
          });
        return cachedResponse || fetchPromise;
      })
    );
  }
});

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
