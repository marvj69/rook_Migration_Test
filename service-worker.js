const CACHE_NAME = "rook-cache-v9";
const OFFLINE_URL = "/rook_Migration_Test/index.html";

// Put all your important files here so they're cached at install.
const urlsToCache = [
  "/rook_Migration_Test/",
  "/rook_Migration_Test/index.html",
  "/rook_Migration_Test/manifest.json",
  "/rook_Migration_Test/service-worker.js",
  "/rook_Migration_Test/icons/icon-192x192.png",
  "/rook_Migration_Test/icons/icon-512x512.png",
  "https://cdn.tailwindcss.com" // Example external resource
];

// ─────────────────────────────────────────────────────────────────────────────
// 1) INSTALL EVENT: Precache all your core resources
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
// 2) FETCH EVENT: Serve pages with a cache-fallback-to-network approach
//    so the site works offline on first visit. Other requests use a
//    cache-first approach with background updates.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const isHTMLRequest =
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept")?.includes("text/html"));

  if (isHTMLRequest) {
    // For navigations (HTML pages), try cache, then network, then offline fallback.
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("[SW] Serving navigation from cache:", event.request.url);
          return cachedResponse;
        }
        // If not in cache, try the network.
        return fetch(event.request).catch((err) => {
          console.warn("[SW] Navigation fetch failed; returning offline page:", err);
          return caches.match(OFFLINE_URL).then((offlinePage) => {
            return (
              offlinePage ||
              new Response("<h1>You are offline</h1>", {
                headers: { "Content-Type": "text/html" },
              })
            );
          });
        });
      })
    );
  } else {
    // For non-HTML (CSS, JS, images, fonts), do a "cache-first" approach with background update.
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Always fetch in the background to update the cache if possible.
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // If OK, update the cache behind the scenes.
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
            // If the network fails, we don't want to break everything —
            // just rely on the existing cachedResponse if present.
          });

        // If we have something cached, return that first, else wait for fetchPromise.
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) ACTIVATE EVENT: Clean up old caches if you change CACHE_NAME
// ─────────────────────────────────────────────────────────────────────────────
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
