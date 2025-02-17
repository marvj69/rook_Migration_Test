const CACHE_NAME = "rook-cache-v6";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/service-worker.js",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "https://cdn.tailwindcss.com" // Tailwind CDN for offline caching
];

// This flag will ensure we only do a network-first check ONCE per SW "lifecycle."
let hasCheckedForUpdate = false;

// INSTALL: Cache specified resources, force waiting SW to become active
self.addEventListener("install", (event) => {
  self.skipWaiting(); // Immediately activate this SW
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

// FETCH: Single network-first attempt for the first navigation request;
//        after that, serve cached for navigation requests. Non-navigation
//        requests use a cache-first approach with background update.
self.addEventListener("fetch", (event) => {
  // Detect “navigation” by checking either the request mode or the Accept header
  const isNavigationRequest =
    event.request.mode === "navigate" ||
    (event.request.method === "GET" &&
      event.request.headers.get("accept") &&
      event.request.headers.get("accept").includes("text/html"));

  if (isNavigationRequest) {
    // If we haven't yet tried for an update, do a network-first approach
    if (!hasCheckedForUpdate) {
      hasCheckedForUpdate = true; // Mark that we tried
      event.respondWith(
        fetch(event.request)
          .then((networkResponse) => {
            // If successful, update the cache
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          })
          .catch((error) => {
            console.warn("Network fetch failed (first navigation). Using cache:", error);
            // Fall back to cached /index.html (or request) if offline
            return caches.match("/index.html");
          })
      );
    } else {
      // Subsequent navigations: just use the cached version
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          // If found in cache, serve it; if not, attempt network
          return (
            cachedResponse ||
            fetch(event.request).catch(() => {
              // Ultimately fallback to /index.html if nothing else
              return caches.match("/index.html");
            })
          );
        })
      );
    }
  } else {
    // For non-navigation (CSS, JS, images, etc.), do "cache-first with background update"
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // If valid, update the cache
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
            // If network fails, we rely on the cachedResponse (if any)
          });
        return cachedResponse || fetchPromise;
      })
    );
  }
});

// ACTIVATE: Clean up old caches and claim clients immediately
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
