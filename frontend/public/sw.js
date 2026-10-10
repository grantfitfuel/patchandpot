// Patch & Pot — minimal offline-capable service worker.
// Caches the app shell + read-mostly content API responses so users can
// pull up their region's guide even without connection.
// Bump VERSION on any cache-invalidating release.
const VERSION = "patchpot-v120";
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  "/",
  "/manifest.json",
];

// Endpoints that hold per-user, real-time state must NEVER be cached —
// stale data here directly causes user-visible bugs. Examples:
//   • /api/ask/usage — daily question counter (was showing yesterday's count)
//   • /api/ask/sessions, /api/ask/sessions/*/messages — chat history
//   • /api/grant/*    — membership status
//   • /api/billing/*  — Stripe state
//   • /api/checkout/* — Stripe state
//   • /api/admin/*    — never cache admin pages
// All other /api/* (guidance, plants, plant-image, share OG …) are still
// stale-while-revalidated because they're effectively static per-month.
const NEVER_CACHE_PATH_PREFIXES = [
  "/api/ask/",
  "/api/grant",
  "/api/billing",
  "/api/checkout",
  "/api/admin/",
  "/api/guide-pdf/",   // large binaries; always fresh from network
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from a prior VERSION.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      );
      // Belt-and-braces: also purge any stale per-user entries that may have
      // been written into the CURRENT version's runtime cache before this
      // never-cache list existed (i.e. on first activation after this fix).
      try {
        const runtime = await caches.open(RUNTIME_CACHE);
        const reqs = await runtime.keys();
        await Promise.all(
          reqs.map((r) => {
            const path = new URL(r.url).pathname;
            return NEVER_CACHE_PATH_PREFIXES.some((p) => path.startsWith(p))
              ? runtime.delete(r)
              : Promise.resolve();
          })
        );
      } catch { /* noop */ }
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/")) {
    // Pass through (no cache) for user-state endpoints.
    if (NEVER_CACHE_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

    // Stale-while-revalidate for read-mostly content endpoints.
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Same-origin navigations / assets: network-first, fall back to cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
  }
});
