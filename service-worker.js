const CACHE_NAME = "rook-cache-v11"; // Bump this if you want to force an update
const OFFLINE_URL = "/rook_Migration_Test/index.html";

// List all critical URLs you want pre-cached here:
const urlsToCache = [
  "/rook_Migration_Test/",
  "/rook_Migration_Test/index.html",
  "/rook_Migration_Test/manifest.json",
  "/rook_Migration_Test/service-worker.js",
  "/rook_Migration_Test/icons/icon-192x192.png",
  "/rook_Migration_Test/icons/icon-512x512.png",
  "https://cdn.tailwindcss.com"
];

// ─────────────────────────────────────────────────────────────────────────────
// 1) INSTALL: Pre-cache critical assets, including the offline fallback page
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Installing, caching:", urlsToCache);
      return cache.addAll(urlsToCache);
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2) FETCH: For HTML requests (navigations), do:
//    - cache match (ignoreSearch) → if not found, fetch → if fetch fails, offline fallback.
//    For non-HTML, do a cache-first with background update.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const isHTMLRequest =
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept")?.includes("text/html"));

  if (isHTMLRequest) {
    // Navigation requests
    event.respondWith(
      caches
        .match(request, { ignoreSearch: true })
        .then((cachedResponse) => {
          if (cachedResponse) {
            console.log("[SW] Serving HTML from cache:", request.url);
            return cachedResponse;
          }
          // If not in cache, try the network.
          return fetch(request).then(
            (networkResponse) => {
              // If successful, update cache in background for next time:
              if (
                networkResponse &&
                networkResponse.ok &&
                networkResponse.type === "basic"
              ) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
              return networkResponse;
            },
            (error) => {
              console.warn("[SW] HTML fetch failed, returning offline page:", error);
              // Fallback to your offline HTML.
              return caches.match(OFFLINE_URL, { ignoreSearch: true }).then((offline) => {
                // If for some reason the offline page isn't in the cache, show a minimal message.
                return (
                  offline ||
                  new Response("<h1>You are offline</h1>", {
                    headers: { "Content-Type": "text/html" },
                  })
                );
              });
            }
          );
        })
    );
  } else {
    // Non-HTML requests (CSS, JS, images, etc.)
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Always attempt a background update from the network:
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // If network fails, we rely on the existing cachedResponse.
          });

        // Return cached response if available, else wait for fetch.
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) ACTIVATE: Clean up older caches when a new service worker activates
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  self.clients.claim();
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((oldCache) => {
          if (!cacheWhitelist.includes(oldCache)) {
            console.log("[SW] Deleting old cache:", oldCache);
            return caches.delete(oldCache);
          }
        })
      )
    )
  );
});
