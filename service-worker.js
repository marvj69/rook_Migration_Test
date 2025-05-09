/* --------  service-worker.js  -------- */

const CACHE_NAME   = "rook-v1.4.501";      //  ←  bump on every release
const CORE_ASSETS  = [
  "/",                       // alias for index.html when online
  "/index.html",             // app shell
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

/* ----------  INSTALL  ---------- */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();                    // become the active SW immediately
});

/* ----------  ACTIVATE  ---------- */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();                  // control pages without reload
});

/* ----------  FETCH  ---------- */
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  /* ------ 1. Navigations (index.html) : network-first ------ */
  if (request.mode === "navigate" || url.pathname === "/index.html") {
    event.respondWith(
      fetch(request)                          // try live version first
        .then(response => {
          // put fresh copy in cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))   // offline fallback
    );
    return;                                   // done
  }

  /* ------ 2. Everything else : cache-first ------ */
  event.respondWith(
    caches.match(request).then(
      cached => cached || fetch(request).then(resp => {
        // update cache in background
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      })
    )
  );
});
