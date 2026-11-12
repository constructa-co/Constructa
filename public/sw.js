// Constructa Service Worker — Sprint 49, A091 confidential cache repair.
//
// Pages are never stored or replayed. A signed-in page, a token link or any
// page that can differ by account must come from the network, so this worker
// keeps only a fixed set of public static files: the generic offline page and
// the app icons, fetched without cookies. A page that fails to load offline
// gets that generic page; every other request behaves as if there were no
// worker.
const CACHE_NAME = "constructa-static-v2";

// Exact names of earlier Constructa caches. constructa-v1 could hold signed-in
// pages, so it is removed and never read. Other caches on this origin are not
// ours and are left alone.
const OBSOLETE_CACHES = ["constructa-v1"];

const OFFLINE_URL = "/offline";
const STATIC_URLS = [OFFLINE_URL, "/icons/icon-192.svg", "/icons/icon-512.svg"];

// Only a plain, successful, shareable response may be stored.
function storable(response) {
  if (!response || response.status !== 200 || response.redirected) return false;
  if (response.type !== "basic" && response.type !== "default") return false;
  const control = (response.headers.get("Cache-Control") || "").toLowerCase();
  return !/\b(no-store|private)\b/.test(control);
}

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(STATIC_URLS.map(async (path) => {
    try {
      const response = await fetch(path, { credentials: "omit", cache: "no-store", redirect: "error" });
      if (storable(response)) await cache.put(path, response);
    } catch {
      // Not stored. The browser's own offline handling applies instead, and
      // the worker still installs so it replaces any older worker.
    }
  }));
}

async function fromOwnCache(path) {
  const cache = await caches.open(CACHE_NAME);
  return (await cache.match(path)) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all(OBSOLETE_CACHES.map((name) => caches.delete(name))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always the network. Offline, the generic page from this worker's
  // own cache, never a stored copy of the page itself.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => fromOwnCache(OFFLINE_URL)));
    return;
  }

  // The fixed public icons, from the network or this worker's own cache.
  if (!url.search && url.pathname !== OFFLINE_URL && STATIC_URLS.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => fromOwnCache(url.pathname)));
  }
  // Everything else (data, RSC, API, scripts) goes to the network unhandled.
});
