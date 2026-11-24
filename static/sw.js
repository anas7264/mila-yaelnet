const CACHE_NAME = "mila-yaelnet-v44";
const CORE_ASSETS = [
  "/",
  "/health",
  "/static/style.css",
  "/static/error-monitoring.js?v=1",
  "/static/catalog.js",
  "/static/word-index.js?v=1",
  "/static/expanded-vocabulary.js?v=1",
  "/static/academic-stage-data.js?v=1",
  "/static/stage-vocabulary.js?v=1",
  "/static/quiz-engine.js",
  "/static/storage.js",
  "/static/answer-journal.js?v=1",
  "/static/app.js",
  "/static/adaptive.css",
  "/static/adaptive-engine.js",
  "/static/adaptive-ui.js",
  "/manifest",
  "/static/icon.svg",
  "/sync-config.js",
  "/sync.js",
  "/sync-merge-core.mjs",
  "/sync-merge-core.mjs?v=3",
  "/sync-core.mjs",
  "/sync-settings-core.mjs",
  "/static/vendor/supabase.umd.js",
  "/static/adaptive-engine.js?v=2",
  "/static/adaptive-ui.js?v=2",
  "/sync-config.js?v=3",
  "/sync.js?v=10",
  "/sync.js?v=11",
  "/sync.js?v=12",
  "/sync-core.mjs?v=7",
  "/sync-settings-core.mjs?v=3"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("mila-yaelnet-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put("/", fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  if (CORE_ASSETS.includes(url.pathname) || url.pathname.startsWith("/static/") || url.pathname === "/manifest") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
