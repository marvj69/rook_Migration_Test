const CACHE_NAME = "rook-cache-v7";

// IMPORTANT: Use a relative path if your site is not at domain root.
// If hosting at GitHub Pages under a subfolder, e.g. /myProject/,
// then set OFFLINE_URL = "./index.html" and ensure your code caches "./index.html".
const OFFLINE_URL = "./index.html";

// List all files to pre-cache. Remove "/" if it doesn’t match your GH Pages path.
const urlsToCache = [
  // "/",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./icons/icon-192x192.png",
  "./icons/icon-512x512.png",
  "https://cdn.tailwindcss.com"
];

// This flag ensures we only do a network-first check ONCE per SW lifecycle
let hasCheckedForUpdate = false;

/**
 * INSTALL: Cache the specified resources, force this SW to activate immediately.
 */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache during install");
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error("Failed to cache during install:", error);
      })
  );
});

/**
 * FETCH: For the first navigation request, do a network-first attempt.
 *        If offline, fallback to cached OFFLINE_URL. After that first attempt,
 *        we serve navigations from cache. Non-HTML requests use a cache-first
 *        with background update approach.
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
            // If we got a valid response, update the cache
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch((err) => {
            console.warn("Network fetch failed (first nav). Using cache:", err);
            // If offline, serve the fallback
            return caches.match(OFFLINE_URL).then((res) => {
              // If the fallback also isn't in the cache, return a minimal offline response
              return (
                res ||
                new Response("<h1>You are offline</h1>", {
                  headers: { "Content-Type": "text/html" },
                })
              );
            });
          })
      );
    } else {
      // Subsequent navigations: serve from cache if available; if not, try network
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If not in cache, attempt network, fallback to OFFLINE_URL
          return fetch(event.request).catch(() => {
            return caches.match(OFFLINE_URL).then((res) => {
              return (
                res ||
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
    // Non-navigation requests: cache-first with background update
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
            // If the network fails, we rely on the cached response
          });
        return cachedResponse || fetchPromise;
      })
    );
  }
});

/**
 * ACTIVATE: Clean up old caches, claim clients so the SW starts controlling pages immediately.
 */
self.addEventListener("activate", (event) => {
  self.clients.claim();
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
});
